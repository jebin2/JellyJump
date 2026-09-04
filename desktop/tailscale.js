/**
 * Tailscale integration.
 *
 * Sharing only works when the machine is on a tailnet with HTTPS enabled, and
 * that is deliberate rather than a limitation. Tailscale supplies the three
 * things this would otherwise need infrastructure for: it reaches a laptop
 * behind NAT, it restricts access to the tailnet, and — through MagicDNS certs
 * — it serves a publicly trusted HTTPS certificate. That last one is what
 * allows a page on https://jellyjump.voidall.com to talk to the laptop at all.
 *
 * `tailscale serve` is used rather than Funnel: serve keeps it on the tailnet,
 * Funnel would publish it to the open internet.
 */
const { execFile } = require('child_process');

const TAILSCALE_TIMEOUT_MS = 10_000;

function run(args) {
    return new Promise((resolve) => {
        execFile('tailscale', args, { timeout: TAILSCALE_TIMEOUT_MS }, (error, stdout, stderr) => {
            resolve({
                ok: !error,
                stdout: (stdout || '').trim(),
                stderr: (stderr || '').trim(),
                error: error ? (error.message || String(error)) : null,
            });
        });
    });
}

/**
 * What Tailscale can currently offer.
 * Every failure is reported as a reason rather than an exception: "no tailnet"
 * is an ordinary state for this app, not an error.
 *
 * @returns {Promise<{available: boolean, reason?: string, dnsName?: string, magicDnsEnabled?: boolean}>}
 */
async function status() {
    const result = await run(['status', '--json']);
    if (!result.ok) {
        const notInstalled = /ENOENT|not found/i.test(result.error || '');
        return {
            available: false,
            reason: notInstalled ? 'Tailscale is not installed' : 'Tailscale is not running',
        };
    }

    let parsed;
    try {
        parsed = JSON.parse(result.stdout);
    } catch {
        return { available: false, reason: 'Could not read Tailscale status' };
    }

    if (parsed.BackendState !== 'Running') {
        return { available: false, reason: `Tailscale is ${parsed.BackendState || 'not connected'}` };
    }

    // Trailing dot comes straight from the DNS name; it is valid in a URL but
    // looks wrong to a user copying the link.
    const dnsName = (parsed.Self?.DNSName || '').replace(/\.$/, '');
    if (!dnsName) {
        return { available: false, reason: 'This machine has no MagicDNS name' };
    }

    // Without HTTPS certs there is no trusted certificate, so an https:// page
    // could never reach the server — sharing would be broken rather than merely
    // insecure.
    const certDomains = parsed.CertDomains || [];
    if (!certDomains.includes(dnsName)) {
        return {
            available: false,
            dnsName,
            reason: 'HTTPS is not enabled for this tailnet (enable it in the Tailscale admin console)',
        };
    }

    return { available: true, dnsName, magicDnsEnabled: true };
}

/**
 * Front the local server with HTTPS on the tailnet.
 * A dedicated port rather than 443, so this never clobbers another `serve`
 * mapping the user already has.
 */
async function startServe({ localPort, httpsPort = 8443 }) {
    const result = await run([
        'serve', '--bg', `--https=${httpsPort}`, `http://127.0.0.1:${localPort}`,
    ]);
    if (!result.ok) {
        return { ok: false, error: result.stderr || result.error || 'tailscale serve failed' };
    }
    return { ok: true, httpsPort };
}

async function stopServe({ httpsPort = 8443 } = {}) {
    const result = await run(['serve', '--https=' + httpsPort, 'off']);
    return { ok: result.ok, error: result.ok ? null : (result.stderr || result.error) };
}

/** Whether `tailscale serve` can run without sudo, so the app can say why not. */
async function canServeWithoutSudo() {
    const result = await run(['debug', 'prefs']);
    if (!result.ok) return false;
    try {
        const prefs = JSON.parse(result.stdout);
        return !!prefs.OperatorUser;
    } catch {
        return false;
    }
}

/**
 * Whether `tailscale serve` is currently fronting the given port, and what it
 * points at. Read from Tailscale rather than from app state, so it stays true
 * even for a mapping the app did not create or failed to clean up.
 */
async function serveStatus(httpsPort) {
    const result = await run(['serve', 'status', '--json']);
    if (!result.ok) return { active: false };

    try {
        const config = JSON.parse(result.stdout);
        const key = Object.keys(config.Web || {}).find((k) => k.endsWith(`:${httpsPort}`));
        if (!key) return { active: false };
        const handlers = config.Web[key]?.Handlers || {};
        const target = Object.values(handlers)[0]?.Proxy || null;
        return { active: true, target };
    } catch {
        return { active: false };
    }
}

/** Whether something is listening on the local port a serve mapping targets. */
function isLocalPortListening(proxyTarget) {
    let port;
    try {
        port = Number(new URL(proxyTarget).port);
    } catch {
        return Promise.resolve(false);
    }
    if (!port) return Promise.resolve(false);

    return new Promise((resolve) => {
        const socket = new (require('net').Socket)();
        const done = (value) => { socket.destroy(); resolve(value); };
        socket.setTimeout(1500);
        socket.once('connect', () => done(true));
        socket.once('timeout', () => done(false));
        socket.once('error', () => done(false));
        socket.connect(port, '127.0.0.1');
    });
}

function shareUrl({ dnsName, httpsPort, token }) {
    return `https://${dnsName}:${httpsPort}/?token=${token}`;
}

module.exports = {
    status, startServe, stopServe, canServeWithoutSudo, shareUrl,
    serveStatus, isLocalPortListening,
};
