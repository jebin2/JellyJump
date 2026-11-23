/**
 * Release helpers (ARCHITECTURE_PLAN.md S5; docs/runbooks/release.md).
 *
 *   node scripts/release.mjs prepare 0.6.0
 *       Sets the version in package.json and desktop/package.json and adds a
 *       "## 0.6.0" section to CHANGELOG.md from the commit subjects since the
 *       last release tag. Commit that in a pull request, merge, then tag.
 *
 *   node scripts/release.mjs notes v0.6.0
 *       Prints that version's CHANGELOG.md section, for the release page; if
 *       there is none, the commit subjects between the previous tag and it.
 *
 * The tag stays the source of truth: the release job stamps its version into
 * the builds whatever the files say. `prepare` keeps the files in step so a
 * build from main says the same.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const CHANGELOG = join(ROOT, 'CHANGELOG.md');
const HEADER = '# Changelog\n\nWhat changed in each release, from the commit subjects. Newest first.\n';

/** Subjects that say nothing to someone reading what changed. */
const NOISE = [/^Merge (pull request|branch)/, /^Build: /, /\[skip ci\]/];

/**
 * @param {string[]} subjects - newest first, as git log gives them
 * @returns {string[]}
 */
export function usefulSubjects(subjects) {
    const seen = new Set();
    return subjects
        .map((s) => s.trim())
        .filter((s) => s && !NOISE.some((re) => re.test(s)))
        .filter((s) => !seen.has(s) && seen.add(s));
}

/**
 * @param {string} version - without the v
 * @param {string} date - YYYY-MM-DD
 * @param {string[]} subjects
 */
export function formatSection(version, date, subjects) {
    const deps = subjects.filter((s) => /^(Bump|build\(deps)/i.test(s));
    const rest = subjects.filter((s) => !deps.includes(s));
    const lines = [`## ${version} — ${date}`, ''];
    if (!rest.length && !deps.length) lines.push('- No changes.');
    for (const s of rest) lines.push(`- ${s}`);
    if (deps.length) lines.push('', `Dependencies: ${deps.length} update${deps.length === 1 ? '' : 's'} (${deps.map((s) => s.replace(/^Bump /i, '')).join('; ')}).`);
    return lines.join('\n') + '\n';
}

/**
 * The body of one version's section, without its heading; null if absent.
 * @param {string} changelog
 * @param {string} version - with or without the v
 */
export function extractSection(changelog, version) {
    const v = version.replace(/^v/, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = new RegExp(`^## ${v}(?: |$)[^\\n]*\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm').exec(changelog);
    return match ? match[1].trim() + '\n' : null;
}

/**
 * Put a section after the header, replacing one for the same version.
 * @param {string} changelog
 * @param {string} version
 * @param {string} section
 */
export function insertSection(changelog, version, section) {
    const body = changelog.startsWith('# Changelog') ? changelog : HEADER;
    const v = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const without = body.replace(new RegExp(`^## ${v}(?: |$)[^\\n]*\\n[\\s\\S]*?(?=^## |(?![\\s\\S]))`, 'm'), '');
    const firstSection = without.search(/^## /m);
    if (firstSection === -1) return `${without.trimEnd()}\n\n${section}`;
    return `${without.slice(0, firstSection)}${section}\n${without.slice(firstSection)}`;
}

const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();

/** The release tag before `ref` (a tag or a commit), or null for the first. */
function previousTag(ref) {
    try { return git('describe', '--tags', '--match', 'v[0-9]*', '--abbrev=0', `${ref}^`); } catch { return null; }
}

/** @param {string|null} from @param {string} to */
function subjectsBetween(from, to) {
    const range = from ? `${from}..${to}` : to;
    return usefulSubjects(git('log', '--no-merges', '--format=%s', range).split('\n'));
}

function setVersion(file, version) {
    const path = join(ROOT, file);
    const json = JSON.parse(readFileSync(path, 'utf8'));
    json.version = version;
    writeFileSync(path, JSON.stringify(json, null, 2) + '\n');
    const lock = path.replace(/package\.json$/, 'package-lock.json');
    if (existsSync(lock)) {
        const l = JSON.parse(readFileSync(lock, 'utf8'));
        l.version = version;
        if (l.packages?.['']) l.packages[''].version = version;
        writeFileSync(lock, JSON.stringify(l, null, 2) + '\n');
    }
}

const isMain = process.argv[1] && import.meta.filename === process.argv[1];
if (isMain) {
    const [command, arg] = process.argv.slice(2);
    if (command === 'prepare' && /^\d+\.\d+\.\d+(-[\w.]+)?$/.test(arg ?? '')) {
        // The newest release tag this commit is built on.
        const last = (() => { try { return git('describe', '--tags', '--match', 'v[0-9]*', '--abbrev=0', 'HEAD'); } catch { return null; } })();
        const subjects = subjectsBetween(last, 'HEAD');
        const date = new Date().toISOString().slice(0, 10);
        const changelog = existsSync(CHANGELOG) ? readFileSync(CHANGELOG, 'utf8') : HEADER;
        writeFileSync(CHANGELOG, insertSection(changelog, arg, formatSection(arg, date, subjects)));
        setVersion('package.json', arg);
        setVersion('desktop/package.json', arg);
        console.log(`Version ${arg}; CHANGELOG.md has ${subjects.length} change(s) since ${last ?? 'the start'}. Review it, commit, merge, then tag v${arg}.`);
    } else if (command === 'notes' && arg) {
        const changelog = existsSync(CHANGELOG) ? readFileSync(CHANGELOG, 'utf8') : '';
        const section = extractSection(changelog, arg);
        if (section) {
            process.stdout.write(section);
        } else {
            const subjects = subjectsBetween(previousTag(arg), arg);
            process.stdout.write(formatSection(arg.replace(/^v/, ''), '', subjects).split('\n').slice(2).join('\n'));
        }
    } else {
        console.error('Usage: node scripts/release.mjs prepare <x.y.z> | notes <vX.Y.Z>');
        process.exit(2);
    }
}
