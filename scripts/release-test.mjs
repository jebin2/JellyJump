/**
 * The release helpers (scripts/release.mjs, plan S5): which commit subjects
 * make the changelog, and reading and writing its sections.
 *
 *   node scripts/release-test.mjs
 */
import { usefulSubjects, formatSection, extractSection, insertSection } from './release.mjs';

let pass = 0, fail = 0;
const check = (ok, label) => {
    if (ok) { pass++; console.log(`  PASS  ${label}`); }
    else { fail++; console.log(`  FAIL  ${label}`); }
};

console.log('\nsubjects');
{
    const got = usefulSubjects([
        'Merge pull request #9 from a/b', 'Build: Update release artifacts from main [skip ci]',
        'Fix seeking', '', 'Fix seeking', 'Bump vite from 8.0.1 to 8.0.2',
    ]);
    check(got.join('|') === 'Fix seeking|Bump vite from 8.0.1 to 8.0.2', `merges, deploy commits, blanks and repeats left out (${got.join('|')})`);
}

console.log('\na section');
{
    const s = formatSection('0.6.0', '2026-12-01', ['Fix seeking', 'Bump vite from 8.0.1 to 8.0.2', 'Add Diagnostics']);
    check(s.startsWith('## 0.6.0 — 2026-12-01\n\n- Fix seeking\n- Add Diagnostics\n'), 'heading with the date, then the changes');
    check(/Dependencies: 1 update \(vite from 8\.0\.1 to 8\.0\.2\)\./.test(s), 'dependency bumps summed up in one line');
    check(formatSection('0.6.1', 'x', []).includes('- No changes.'), 'an empty release says so');
}

console.log('\nthe file');
{
    let c = '';
    c = insertSection(c, '0.5.1', formatSection('0.5.1', 'd1', ['A']));
    c = insertSection(c, '0.5.1-beta', formatSection('0.5.1-beta', 'd0', ['Beta']));
    c = insertSection(c, '0.6.0', formatSection('0.6.0', 'd2', ['B', 'C']));
    check(c.startsWith('# Changelog'), 'starts with the heading');
    check(c.indexOf('## 0.6.0') < c.indexOf('## 0.5.1-beta') && c.indexOf('## 0.5.1-beta') < c.indexOf('## 0.5.1 '), 'newest first');
    check(extractSection(c, 'v0.6.0') === '- B\n- C\n', 'a version\'s notes, asked for by tag');
    check(extractSection(c, '0.5.1') === '- A\n', 'the last section too; 0.5.1 does not match 0.5.1-beta');
    check(extractSection(c, '0.4.0') === null, 'a version not there: null');
    const again = insertSection(c, '0.6.0', formatSection('0.6.0', 'd3', ['D']));
    check(extractSection(again, '0.6.0') === '- D\n' && (again.match(/## 0\.6\.0/g) || []).length === 1, 'preparing a version twice replaces its section');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
