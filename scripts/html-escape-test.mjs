/**
 * Tests the html`` template and escapeHtml (assets/js/shared/utils/html.js).
 *
 * Titles, track names, device labels and error messages come from files,
 * playlists and other machines; put into innerHTML as they are, a name like
 * `<img src=x>` becomes markup. These check that every value is text, that
 * templates nest, and that lists join.
 *
 *   node scripts/html-escape-test.mjs
 */
import { html, escapeHtml, SafeHtml } from '../assets/js/shared/utils/html.js';

let pass = 0, fail = 0;
const check = (ok, label) => {
    if (ok) { pass++; console.log(`  PASS  ${label}`); }
    else { fail++; console.log(`  FAIL  ${label}`); }
};

console.log('\nescapeHtml');
check(escapeHtml('<img src=x onerror=alert(1)>') === '&#60;img src=x onerror=alert(1)&#62;', 'angle brackets become entities');
check(escapeHtml(`"quoted" & 'single' \`tick\``) === '&#34;quoted&#34; &#38; &#39;single&#39; &#96;tick&#96;', 'quotes, ampersand and backtick too');
check(escapeHtml(null) === '' && escapeHtml(undefined) === '', 'nothing becomes an empty string');
check(escapeHtml(42) === '42', 'numbers are text');

console.log('\nhtml``');
const name = '<b id="pwn">x</b>';
const out = html`<span class="name">${name}</span>`;
check(out instanceof SafeHtml, 'returns SafeHtml');
check(String(out) === '<span class="name">&#60;b id=&#34;pwn&#34;&#62;x&#60;/b&#62;</span>', 'a value is text, the template is markup');
check(String(html`<option value="${'a" onclick="x'}">y</option>`) === '<option value="a&#34; onclick=&#34;x">y</option>', 'a value cannot break out of a quoted attribute');
check(String(html`<p>${html`<b>${'<i>'}</b>`}</p>`) === '<p><b>&#60;i&#62;</b></p>', 'templates nest, the inner value still escaped');
check(String(html`<ul>${['<a>', html`<li>ok</li>`]}</ul>`) === '<ul>&#60;a&#62;<li>ok</li></ul>', 'lists join, each item escaped unless markup');
check(String(html`${0} ${false} ${''}`) === '0 false ', 'falsy values are text, not dropped');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
