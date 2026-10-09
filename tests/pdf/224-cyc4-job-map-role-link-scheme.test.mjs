// The Job Map's rows come from crawled job boards and are shared by every allowed account. A role's
// posting address went straight into the row's href, so one of javascript:, data: or file: became a link
// a click ran or opened. roleHref lets through an http(s) address only; any other row is not a link.
// Run: node --test tests/pdf/224-cyc4-job-map-role-link-scheme.test.mjs
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { setup, teardown, loadModule } from './harness.mjs';

let roleHref;
before(async () => {
  await setup();
  ({ roleHref } = await loadModule('/src/utils/jobMapData.js'));
});
after(teardown);

it('a posting address of http or https is the link', () => {
  assert.equal(roleHref('https://jobs.example.com/roles/1'), 'https://jobs.example.com/roles/1');
  assert.equal(roleHref('http://jobs.example.com/roles/1'), 'http://jobs.example.com/roles/1');
});

it('a bare address gets https', () => {
  assert.equal(roleHref('jobs.example.com/roles/1'), 'https://jobs.example.com/roles/1');
});

it('javascript:, data:, vbscript:, file: and blank addresses are no link', () => {
  for (const bad of ['javascript:alert(1)', ' JavaScript:alert(1)', 'java\tscript:alert(1)', 'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)', 'file:///etc/passwd', '', undefined, null, 42, {}]) {
    assert.equal(roleHref(bad), null, String(bad));
  }
});

it('an address that is not for the web (mailto:, tel:) is no posting link', () => {
  assert.equal(roleHref('mailto:jobs@example.com'), null);
  assert.equal(roleHref('tel:+15550100'), null);
});

it('the page links each row through roleHref and opens it with noopener noreferrer', () => {
  const s = fs.readFileSync(new URL('../../src/pages/JobMap.jsx', import.meta.url), 'utf8');
  // The row's card (RoleRow) links only with an address (cyc8: a row without one is a plain card, not an <a> with no href).
  assert.match(s, /<RoleRow href=\{roleHref\(r\[ROW\.url\]\)\}>/);
  assert.match(s, /rel="noopener noreferrer"/);
  assert.ok(!/href=\{r\[ROW\.url\]\}/.test(s), 'no row address goes into href as it is');
});
