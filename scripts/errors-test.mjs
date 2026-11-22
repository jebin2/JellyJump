/**
 * Tests the error type, the codes, the log kept in memory, and the bug
 * report built from them (assets/js/shared/errors, shared/utils/Logger.js).
 *
 *   node scripts/errors-test.mjs
 */
import { AppError } from '../assets/js/shared/errors/AppError.js';
import { ERROR_CODES } from '../assets/js/shared/errors/codes.js';
import { buildReport } from '../assets/js/shared/errors/ErrorReporter.js';
import { Logger } from '../assets/js/shared/utils/Logger.js';

let pass = 0, fail = 0;
const check = (ok, label) => {
    if (ok) { pass++; console.log(`  PASS  ${label}`); }
    else { fail++; console.log(`  FAIL  ${label}`); }
};

console.log('\ncodes');
check(Object.values(ERROR_CODES).every((m) => typeof m === 'string' && m.length > 5), 'every code has a message for the user');

console.log('\nAppError');
{
    const e = new AppError('STORAGE_FULL', { context: { id: 'a' } });
    check(e instanceof Error && e.code === 'STORAGE_FULL', 'is an Error with a code');
    check(e.userMessage === ERROR_CODES.STORAGE_FULL, 'its user message comes from the codes');
    check(e.context.id === 'a' && e.recoverable === true, 'keeps context; recoverable by default');
    const unknown = new AppError(/** @type {any} */ ('NOT_A_CODE'));
    check(unknown.code === 'INTERNAL', 'an unknown code becomes INTERNAL');
    const own = new AppError('NETWORK', { userMessage: 'Server down' });
    check(own.userMessage === 'Server down', 'a user message can be given');
}

console.log('\nAppError.from');
const from = (err) => AppError.from(err).code;
const named = (name, message = '') => Object.assign(new Error(message), { name });
check(from(new AppError('CORS')) === 'CORS', 'an AppError stays as it is');
check(from(named('AbortError')) === 'CANCELLED', 'AbortError -> CANCELLED');
check(from(named('ConversionCanceledError')) === 'CANCELLED', 'a cancelled conversion -> CANCELLED');
check(from(named('QuotaExceededError')) === 'STORAGE_FULL', 'QuotaExceededError -> STORAGE_FULL');
check(from(named('NotAllowedError')) === 'PERMISSION_DENIED', 'NotAllowedError -> PERMISSION_DENIED');
check(from(named('TimeoutError')) === 'TIMEOUT', 'TimeoutError -> TIMEOUT');
check(from(new TypeError('Failed to fetch')) === 'NETWORK', 'fetch failure -> NETWORK');
check(from(new Error('boom')) === 'INTERNAL', 'anything else -> INTERNAL');
check(from('a string') === 'INTERNAL' && AppError.from('a string').message === 'a string', 'a thrown string keeps its text');
check(from(null) === 'INTERNAL', 'even null');
const wrapped = AppError.from(new TypeError('Failed to fetch'));
check(wrapped.cause instanceof TypeError, 'keeps the original as its cause');

console.log('\nthe log kept in memory');
Logger.clearEntries();
Logger.log('[Player] loaded', 3, { big: 'object' });
Logger.warn('[Storage] slow', { ms: 1200 });
Logger.error('[Job] failed', new AppError('DECODE_FAILED'));
let entries = Logger.entries();
check(entries.length === 3 && entries.map((e) => e.level).join() === 'log,warn,error', 'every level is kept, in order');
check(entries[0].scope === 'Player' && entries[0].message === '[Player] loaded 3 [Object]', 'a log line keeps text and names its objects, not their contents');
check(entries[1].message.includes('{"ms":1200}'), 'a warning keeps a rendering of its objects');
check(entries[2].message.includes('AppError [DECODE_FAILED]'), 'an error keeps its code');
Logger.clearEntries();
for (let i = 0; i < 1005; i++) Logger.log(`line ${i}`);
entries = Logger.entries();
check(entries.length === 1000 && entries[0].message === 'line 5' && entries[999].message === 'line 1004', 'keeps the last 1,000, oldest first');
check(Logger.entries(3).map((e) => e.message).join() === 'line 1002,line 1003,line 1004', 'entries(n) gives the newest n');
const circular = {}; circular.self = circular;
Logger.warn('circular', circular);
check(Logger.entries(1)[0].message === 'circular [Object]', 'an object that cannot be rendered is named instead');

console.log('\ntrace ids');
Logger.clearEntries();
Logger.log('before');
Logger.setTrace('load', 7);
Logger.log('loading');
Logger.setTrace('job', 3);
Logger.warn('both');
Logger.setTrace('load', null);
Logger.log('job only');
Logger.setTrace('job', null);
Logger.log('after');
const traces = Logger.entries().map((e) => JSON.stringify(e.trace ?? null));
check(traces.join(' ') === 'null {"load":7} {"load":7,"job":3} {"job":3} null', `entries carry the load and job in progress (${traces.join(' ')})`);
Logger.setTrace('job', 3);
Logger.log('in a job');
check(buildReport(new AppError('INTERNAL')).includes('(job 3) in a job'), 'the report shows them');
Logger.setTrace('job', null);

console.log('\nthe bug report');
Logger.clearEntries();
Logger.log('Loading https://example.com/secret/video.mp4 from blob:http://localhost/abc');
const report = buildReport(AppError.from(new TypeError('Failed to fetch https://example.com/a.m3u8')));
check(report.startsWith('JellyJump ') && report.includes('Error: NETWORK'), 'says the version and the error code');
check(!report.includes('example.com') && !report.includes('blob:') && report.includes('<url>'), 'addresses are replaced');
check(report.includes('Recent log:') && report.includes('Loading <url> from <url>'), 'includes the recent log');

console.log('\nsecrets in log lines');
{
    Logger.clearEntries();
    Logger.log('[Player] Loading media: https://box.ts.net/api/stream/abc?sig=0123456789abcdef0123456789abcdef');
    Logger.warn('[Library] probe', 'https://box.ts.net/?token=' + 'f'.repeat(64) + '&x=1');
    const text = Logger.entries().map((e) => e.message).join('\n');
    check(!/0123456789abcdef0123|ffffffff/.test(text), 'a token or a file key in a URL is not kept in the log');
    check(/sig=…/.test(text) && /token=…&x=1/.test(text), 'the rest of the line is');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
