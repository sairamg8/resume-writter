// R4-SW-B-04: the Epic panel's "Create epic" composer prompted 'What needs to be done?', the issue
// composer's wording, though it makes only epics. Now it reads 'What is this epic?'; a backlog
// section's (and a board column's) composer keeps 'What needs to be done?'. Its accessible name,
// still 'Summary of the new issue', waits for the deferred accessibility pass.
// The real Backlog page over tests/pdf/fake-dom.mjs (104-r5-brd-helpers.mjs).
// Run: node --test tests/pdf/104-r5-brd-sw-b-04-epic-composer-prompt.test.mjs
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown } from './harness.mjs';
import { load, mountBacklog, project } from './104-r5-brd-helpers.mjs';

before(async () => { await setup(); await load(); });
after(teardown);

it('the Epic panel\'s composer asks for an epic; the backlog\'s still asks what needs to be done', async () => {
  const page = mountBacklog(project({ mode: 'scrum' }));
  try {
    const field = (node) => page.all(node).find((el) => el.tagName === 'TEXTAREA');
    page.click(page.button('Epic panel'));
    const panel = page.byLabel('Epics');
    page.click(page.button('Create epic', panel));
    assert.ok(field(panel), 'the epic composer is open');
    assert.equal(field(panel).getAttribute('placeholder'), 'What is this epic?');

    const backlog = page.section('backlog');
    page.click(page.button('Create issue', backlog));
    assert.equal(field(backlog).getAttribute('placeholder'), 'What needs to be done?');
  } finally { await page.close(); }
});
