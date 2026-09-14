// Template headers: the header rule and the header controls, checked on real PDFs.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, render, read } from './harness.mjs';

before(setup);
after(teardown);

const ACCENT = '#e11d48';

/** Does the header print its accent rule? No sections and no contacts: the rule is the only accent stroke. */
async function headerRule(template, settings) {
  const pages = await read(await render(resume({ template, settings: { accentColor: ACCENT, ...settings } })));
  return pages[0].strokes.has(ACCENT);
}

describe('header rule', () => {
  it('executive: no rule unless the toggle turns it on — not for older résumés without the setting (FIDA-18)', async () => {
    assert.equal(await headerRule('executive', { showHeaderBorder: undefined }), false, 'unset');
    assert.equal(await headerRule('executive', { showHeaderBorder: false }), false, 'off');
    assert.equal(await headerRule('executive', { showHeaderBorder: true }), true, 'on');
  });

  it('classic: an unset setting keeps the rule (the Classic design), the toggle still turns it off', async () => {
    assert.equal(await headerRule('classic', { showHeaderBorder: undefined }), true, 'unset');
    assert.equal(await headerRule('classic', { showHeaderBorder: false }), false, 'off');
  });
});
