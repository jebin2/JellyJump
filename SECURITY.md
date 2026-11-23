# Security

## Reporting a problem

Report a vulnerability privately: on GitHub, the repository's **Security**
tab → **Report a vulnerability**. Please do not open a public issue for it.
Say what an attacker can do, and how to reproduce it (a file, a link, steps).
You will get an answer within a week; a fix for anything serious ships as
soon as it is ready, and you are credited in the release notes unless you
would rather not be.

Supported: the live site (always the latest build) and the latest desktop
release.

## What the app is, for security

JellyJump is local-first. Media is opened, played, edited and exported on
the user's device; nothing is uploaded unless the user shares it (Watch
Party, a shared library, the Hugging Face uploader). There are no accounts
and no server of ours that holds user data.

## Threat model

What we defend against:

| Threat | Defence |
|---|---|
| A crafted media file (as video, subtitles, metadata, or a carrier's header) | Decoding in WebCodecs/MediaBunny; every value put into HTML goes through the escaping `html` template (an ESLint rule refuses `innerHTML` with `${…}` otherwise); a decrypted file keeps its type only if it is a media type |
| A crafted playlist, link list or M3U from the internet | Parsed as data, shown as text; network requests through one policy (`shared/net/fetchWithPolicy.js`) |
| A shared library on another machine | Its listing is data; its server is reached with a token it issued |
| URL parameters on the embed page | Read as data, never as HTML |
| Script injected into a page | A Content-Security-Policy on every page, generated from one module (`shared/config/csp.js`): scripts from the site and YouTube only, no plugins, no `<base>` changes |
| Desktop: code in the window reaching the system | Electron with `contextIsolation`, no `nodeIntegration`, `webSecurity`, a navigation guard and a window-open handler; IPC calls check the sender; `read-file` reads only files the user picked, the library folders and what a scan found (`desktop/read-grants.js`); the app writes only to its own folder |
| Desktop: someone on the network reaching a shared library | The library server listens on 127.0.0.1 only and is reached through Tailscale; a token is required, compared in constant time, and sent in an `Authorization` header; stream links carry a per-file key (an HMAC of the file id), not the token; tokens and keys are removed from logs |
| A vulnerable dependency | `npm audit` (high and above, shipped code) in CI for the site and the desktop app; Dependabot for npm and GitHub Actions; actions pinned to commit SHAs; the vendored libraries' hashes are checked (`npm run verify:libs`) |
| Someone without the password opening an encrypted carrier | AES-256-CTR with HMAC-SHA-256 and PBKDF2; design and review in `docs/adr/0011-encryption-format.md` |

Not in scope: an attacker who controls the user's device or browser, or
their unlocked desktop session; a malicious browser extension; what a
platform does with a carrier the user uploads to it.

Known open items: the encryption header is not covered by the HMAC and the
PBKDF2 round count is low (ADR 0011, findings F1–F3).

## Data the app keeps, and where

**In the browser** (this site's storage; cleared with the site's data):

| What | Where |
|---|---|
| The playlist, and local files added to it, so they play after a reload | IndexedDB (`JellyJumpDB`). A file is deleted when its item is removed; files nothing refers to are swept after each load |
| Edited copies the edit panel's Undo can go back to | IndexedDB, same database |
| Preferences: speed, control bar position, debug logging, Undo history, saved library links, where each of the last 200 videos was left | `localStorage`, keys starting `jj:` |
| The subtitle model, once downloaded | the browser's cache |
| The last 1,000 log lines, for "Copy details" | memory only; gone when the page closes |

**In the desktop app** (the app's data folder):

| What | Where |
|---|---|
| Settings, library folders, the share token | `jellyjump.json` |
| Which files the user picked | `read-grants.json` |
| Edited copies | `copies/` |
| What a library scan found | memory only, rebuilt by the next scan |

The user's own files are read where they are and never changed.

**Sent elsewhere** — only these, each started by the user except the first:

| What | To |
|---|---|
| One visit count per page load, naming the project only | Supabase (`public/js/analytics-embed.js`) |
| A YouTube link's video | YouTube (the no-cookie player) |
| The subtitle model download | Hugging Face |
| An HLS export, with the user's own token (not stored) | the user's Hugging Face repository |
| Watch Party video and the connection offer | the other viewer, directly (WebRTC); STUN servers at Cloudflare and Google see the two addresses |
| A shared library's files | the viewers the user gave the link to |

No error reports, telemetry or crash data leave the device on their own
(`docs/adr/0010-no-telemetry-by-default.md`); a bug report is what the user
copies and chooses to send. Every outside address the code uses is listed in
`assets/js/shared/config/services.js`.

## Repository settings

Secret scanning and push protection are on for this repository, and `main`
accepts changes only through pull requests whose tests passed.
