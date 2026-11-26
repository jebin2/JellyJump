/**
 * Metrics, the player's timings, redaction and the Diagnostics report
 * (plan P3, P4). The browser half (opening the view, copying it, real
 * numbers from a real video) is in smoke-test.
 *
 *   node scripts/diagnostics-test.mjs
 */
import { Metrics, KEEP } from '../assets/js/shared/diagnostics/Metrics.js';
import { PlayerTiming } from '../assets/js/core/PlayerTiming.js';
import { redact } from '../assets/js/shared/diagnostics/redact.js';
import { collectDiagnostics, formatDiagnostics, formatLog, formatDiagnosticsWithLog } from '../assets/js/shared/diagnostics/Diagnostics.js';
import { Logger } from '../assets/js/shared/utils/Logger.js';
import { JobQueue } from '../assets/js/shared/services/JobQueue.js';

// The job queue listens on window for what a job added to the playlist.
globalThis.window ??= /** @type {any} */ (new EventTarget());

let pass = 0, fail = 0;
const check = (ok, label) => {
    if (ok) { pass++; console.log(`  PASS  ${label}`); }
    else { fail++; console.log(`  FAIL  ${label}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

console.log('\nmetrics');
{
    Metrics.clear();
    for (let i = 1; i <= 100; i++) Metrics.record('x', i);
    const s = Metrics.summary().values.x;
    check(s.count === KEEP && s.last === 100 && s.max === 100, `keeps the last ${KEEP} values (${s.count}, last ${s.last})`);
    check(s.median === 76 && s.p95 === 98, `median and 95th percentile of what is kept (${s.median}, ${s.p95})`);
    Metrics.record('x', NaN);
    check(Metrics.summary().values.x.count === KEEP && Metrics.summary().values.x.last === 100, 'a value that is not a number is ignored');
    Metrics.count('c'); Metrics.count('c', 2);
    check(Metrics.summary().counters.c === 3, 'counters add up');
    const stop = Metrics.start('t');
    await sleep(30);
    const took = stop();
    check(took >= 25 && Metrics.summary().values.t.last === took, `start() times it (${took.toFixed(0)} ms)`);
}

console.log('\nthe player\'s timings');
{
    Metrics.clear();
    const t = new PlayerTiming();
    t.loadStarted();
    await sleep(20);
    t.lateFrame();
    t.framePresented();
    let s = Metrics.summary();
    check(s.values.firstFrame?.count === 1 && s.values.firstFrame.last >= 15, `load to first frame (${s.values.firstFrame?.last.toFixed(0)} ms)`);
    check(!s.counters.droppedFrames, 'frames skipped while loading are not dropped frames');

    t.seekStarted(); await sleep(5);
    t.seekStarted(); await sleep(10);
    t.framePresented();
    s = Metrics.summary();
    check(s.values.seek?.count === 1 && s.values.seek.last < 14, `a second seek before the frame replaces the first; timed from the last (${s.values.seek?.last.toFixed(0)} ms)`);

    t.lateFrame();
    check(!Metrics.summary().counters.droppedFrames, 'nor the catch-up right after a seek');
    await sleep(520);
    t.lateFrame(); t.lateFrame();
    check(Metrics.summary().counters.droppedFrames === 2, 'late frames in steady playback are counted');

    t.loadStarted();
    t.seekStarted(); // the restore-position seek of a load
    t.framePresented();
    s = Metrics.summary();
    check(s.values.firstFrame.count === 2 && s.values.seek.count === 1, 'a seek during a load counts toward the load, not as a seek');
    check(s.counters.framesShown === 3, 'frames shown are counted');
}

console.log('\nredaction');
{
    const text = redact('Failed https://lib.example.ts.net/api/stream/ab?sig=1 and blob:http://x/1 for /home/ana/Videos/Our Trip.mp4 '
        + 'and C:\\Users\\ana\\clip.mkv, item holiday_2024.MOV, subs.srt');
    check(!/lib\.example|blob:|ana|Trip|clip|holiday|subs/.test(text), `addresses, paths and file names gone: "${text}"`);
    check(text.includes('<url>') && text.includes('<path>') && text.includes('<file>'), 'replaced by markers, so the report still reads');
    check(redact('decode failed at 12.5s in Player.js') === 'decode failed at 12.5s in Player.js', 'ordinary text is left alone');
}

console.log('\nthe report');
{
    Metrics.clear();
    Metrics.record('firstFrame', 120);
    Metrics.record('storageUsed', 5_400_000, 'bytes');
    Metrics.count('droppedFrames', 4);
    Logger.error('Could not open /home/ana/Videos/secret-plan.mp4 from https://nas.local/x');
    const { finished } = JobQueue.add({ name: 'Cut', subject: 'secret-plan.mp4', work: async () => { await sleep(5); return 1; } });
    await finished;
    const data = await collectDiagnostics();
    const text = formatDiagnostics(data);
    check(/^JellyJump \S+ \(build \S+\)/.test(text), 'starts with the version and build');
    check(/Codecs \(decode \/ encode\):\n {2}H\.264: (yes|no) \/ (yes|no)/.test(text), 'lists codec support');
    check(/firstFrame: 120 ms/.test(text) && /storageUsed: 5\.4 MB/.test(text) && /droppedFrames: 4/.test(text), 'shows the metrics in their units');
    check(/Cut: done, \d+(\.\d)? s/.test(text), 'lists the job by tool, with its time');
    check(!/secret|ana|nas\.local/.test(text), 'no file name, path or address anywhere, from the errors or the jobs');
    check(text.includes('Could not open <path>'), 'the error itself is there');
}

console.log('\nthe log');
{
    Logger.clearEntries();
    check(formatLog() === '  none', 'an empty log says so');
    Logger.setTrace('load', 3);
    Logger.log('[Buffer] Playing url:https://nas.local/api/stream/7?token=abc Our Trip.mp4 through the buffer', { big: 'object' });
    Logger.setTrace('load', null);
    Logger.warn('[Buffering] Waiting for data at 12.000s');
    const lines = formatLog().split('\n');
    check(lines.length === 2, `one line per entry (${lines.length})`);
    check(/^\d\d:\d\d:\d\d\.\d{3} LOG {3}\[Buffer\] Playing /.test(lines[0]) && /^\d\d:\d\d:\d\d\.\d{3} WARN {2}\[Buffering\] Waiting for data at 12\.000s$/.test(lines[1]),
        `the time, the level and the message: "${lines[0]}" / "${lines[1]}"`);
    check(lines[0].endsWith('{load 3}'), 'with the load it belongs to');
    check(!/nas\.local|token|abc|Trip/.test(lines[0]) && lines[0].includes('<url>'), `no address, token or file name: "${lines[0]}"`);
    const full = formatDiagnosticsWithLog(await collectDiagnostics());
    check(/^JellyJump \S+/.test(full) && /\n\nLog \(2 lines, oldest first, in this device's time\):\n\d\d:/.test(full), 'the report, then the log');
    for (let i = 0; i < 3500; i++) Logger.log(`[Test] line ${i}`);
    const kept = Logger.entries();
    check(kept.length === 3000 && kept.at(-1).message === '[Test] line 3499', `the newest 3000 entries are kept (${kept.length})`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
