// R4-DVIS-02: the Add / Edit job form's Cancel and Save buttons were hand-rolled, and no two alike —
// the header's 36 px with 8 px corners, the footer's Cancel 42 px (a border) and its Save 40 px, 6 px
// corners and a shadow — where the job page's Edit and every other workspace page use the kit's
// Button (32 px, 4 px corners, flat, one line). Both pairs are the kit's Button now: a ghost Cancel
// and a primary Save, the header's and the footer's alike, each Cancel still asking before it leaves
// (R4-DUX-06) and each Save still submitting the fields' form. The fake DOM has no layout: this reads
// the class tokens of the real JobForm's buttons (tests/pdf/fake-dom.mjs, loaded through Vite).
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { setup, teardown, loadModule } from './harness.mjs';
import { acme, atRoute } from './100-r4-job-helpers.mjs';

before(setup);
after(teardown);

const classes = (el) => (el.getAttribute('class') || '').split(/\s+/).filter(Boolean);

const KIT = ['inline-flex', 'h-8', 'px-3', 'text-sm', 'rounded', 'font-medium', 'whitespace-nowrap'];
const HAND_ROLLED = ['rounded-lg', 'rounded-md', 'shadow-sm', 'py-2', 'py-2.5', 'px-4', 'px-5', 'px-6', 'font-semibold', 'border-line'];

for (const [path, save] of [['/jobs/new', 'Add Job'], ['/jobs/a/edit', 'Save Changes']]) {
  it(`R4-DVIS-02: ${path} — the header's and the footer's Cancel and ${save} are the kit's Button, both pairs alike`, async () => {
    const { JobForm } = await loadModule('/src/pages/JobForm.jsx');
    const form = h(JobForm, { store: { appState: { resumes: [] } } });
    const page = await atRoute(path, { '/jobs/new': form, '/jobs/:id/edit': form }, [acme]);
    try {
      const buttons = page.all().filter((el) => el.tagName === 'BUTTON');
      const saves = buttons.filter((b) => b.getAttribute('type') === 'submit');
      const cancels = buttons.filter((b) => b.textContent.trim() === 'Cancel');
      assert.equal(saves.length, 2, 'a Save in the header and one in the footer');
      assert.equal(cancels.length, 2, 'a Cancel in the header and one in the footer');
      const owner = page.all().find((el) => el.tagName === 'FORM');

      for (const [name, list, variant] of [[save, saves, ['bg-brand', 'text-white']], ['Cancel', cancels, ['text-ink-subtle']]]) {
        for (const b of list) {
          const c = classes(b);
          for (const t of [...KIT, ...variant]) assert.ok(c.includes(t), `${name}: ${t} (class="${c.join(' ')}")`);
          for (const t of HAND_ROLLED) assert.ok(!c.includes(t), `${name}: no ${t} (class="${c.join(' ')}")`);
        }
        assert.equal(list[0].getAttribute('class'), list[1].getAttribute('class'), `the header's ${name} and the footer's look the same`);
      }
      for (const b of saves) {
        assert.equal(b.textContent.trim(), save);
        assert.equal(b.getAttribute('form'), owner.getAttribute('id'), 'it submits the fields\' form');
      }
      // Cancel keeps its handler (leave(), which asks before dropping changes) and never submits.
      for (const b of cancels) {
        assert.equal(b.getAttribute('type'), 'button');
        assert.equal(typeof page.props(b).onClick, 'function');
      }
    } finally {
      await page.view.unmount();
      delete globalThis.localStorage;
    }
  });
}
