// C-2: the job-posting box takes at most 200,000 characters (maxLength: the browser cuts a longer
// paste at the caret), says so whenever it is full — also for a posting kept from an earlier
// session — and scans only that much of an older, longer one.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { setup, teardown, resume, section, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

before(setup);
after(() => { delete globalThis.sessionStorage; return teardown(); });

const memory = (seed = {}) => {
  const map = new Map(Object.entries(seed));
  return {
    get length() { return map.size; }, key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k),
  };
};
const makePerson = () => ({ ...resume({ template: 'classic', sections: [{ ...section('skills', [{ category: 'Tools', skills: 'Terraform' }]), id: 'sk' }] }), id: 'r1' });
const store = { updateSections() {}, updateSetting() {}, setTemplate() {} };
const LIMIT = 200000;

async function panel(stored) {
  globalThis.sessionStorage = memory(stored === undefined ? {} : { 'cpwtcv_ats_jd:r1': JSON.stringify(stored) });
  const { default: AtsCheckerPanel } = await loadModule('/src/components/AtsCheckerPanel.jsx');
  const view = mount(() => createElement(AtsCheckerPanel, { resume: makePerson(), store }), {});
  const all = () => [...elements(view.container)];
  return { view, box: () => all().find((el) => el.tagName === 'TEXTAREA'), notice: () => all().find((el) => el.getAttribute('data-testid') === 'jd-capped'), missing: () => all().filter((el) => el.getAttribute('title') === 'Click to add to Skills').map((el) => el.textContent.trim()) };
}

it('C-2: the box limits its text, and no line shows while there is room', async () => {
  const p = await panel('Kubernetes');
  try {
    assert.equal(reactProps(p.box()).maxLength, LIMIT);
    assert.equal(p.notice(), undefined);
  } finally { await p.view.unmount(); }
});

it('C-2: a full box says so, and an older longer posting is scanned only to the limit', async () => {
  // The keyword sits past the limit: it is not scanned; the one before it is.
  const posting = `Kubernetes Kubernetes ${'x '.repeat(LIMIT / 2)} Docker Docker Docker Docker`;
  const p = await panel(posting);
  try {
    assert.ok(p.notice(), 'the line is shown for a box at the limit');
    assert.ok(!p.missing().includes('Docker'), 'text past the limit is not scanned');
    assert.ok(p.missing().includes('Kubernetes'), 'text before it is');
  } finally { await p.view.unmount(); }
});
