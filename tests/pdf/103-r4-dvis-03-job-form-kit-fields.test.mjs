// R4-DVIS-03: the Add / Edit job form's fields were hand-rolled — 42 px inputs (46 px on touch) with
// 6 px corners and a border-line edge, and selects that kept the browser's own chevron and chrome —
// under text-xs captions, beside the kit's 36 px TextField and Select on the job page and every other
// workspace form. They are the kit's TextField and Select now: controlClass (16 px on a touch screen
// still, J-38), h-9 / pointer-coarse:h-11, appearance-none with the kit's chevron, and the kit's
// field label (text-[12px] font-semibold leading-5), each label still naming its control by id (M8).
// The fake DOM has no layout: this reads the class tokens of the real JobForm's controls and labels
// (tests/pdf/fake-dom.mjs, loaded through Vite).
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { setup, teardown, loadModule } from './harness.mjs';
import { acme, atRoute } from './100-r4-job-helpers.mjs';

before(setup);
after(teardown);

const classes = (el) => (el.getAttribute('class') || '').split(/\s+/).filter(Boolean);

/** Asserts `el` has every token of `has` and none of `hasNot`. */
function tokens(el, name, { has = [], hasNot = [] }) {
  assert.ok(el, `${name} is shown`);
  const cls = classes(el);
  for (const t of has) assert.ok(cls.includes(t), `${name}: ${t} (class="${el.getAttribute('class')}")`);
  for (const t of hasNot) assert.ok(!cls.includes(t), `${name}: no ${t} (class="${el.getAttribute('class')}")`);
}

// The form's own fields (the stage picker inside the form is its own component).
const TEXT = ['company', 'role', 'location', 'salary', 'url', 'appliedDate', 'deadline', 'followUpDate', 'contact'];
const PICKERS = ['workMode', 'source', 'status', 'resumeId'];

for (const path of ['/jobs/new', '/jobs/a/edit']) {
  it(`R4-DVIS-03: ${path} — every field is the kit's control under the kit's label`, async () => {
    const { JobForm } = await loadModule('/src/pages/JobForm.jsx');
    const form = h(JobForm, { store: { appState: { resumes: [] } } });
    const page = await atRoute(path, { '/jobs/new': form, '/jobs/:id/edit': form }, [acme]);
    try {
      const control = (tag, field) => page.all().find((el) => el.tagName === tag && (el.getAttribute('id') || '').endsWith(field));
      const labelOf = (el) => page.all().find((l) => l.tagName === 'LABEL' && l.getAttribute('for') === el.getAttribute('id'));
      const kitControl = {
        has: ['w-full', 'rounded', 'border', 'border-[#8590a2]/70', 'h-9', 'pointer-coarse:h-11', 'text-sm', 'pointer-coarse:text-base'],
        hasNot: ['rounded-md', 'border-line', 'py-2.5'],
      };
      const kitLabel = { has: ['text-[12px]', 'font-semibold', 'leading-5'], hasNot: ['text-xs', 'mb-1.5'] };

      for (const field of TEXT) {
        const input = control('INPUT', field);
        tokens(input, `the ${field} input`, kitControl);
        tokens(labelOf(input), `the ${field} label`, kitLabel);
      }
      for (const field of PICKERS) {
        const select = control('SELECT', field);
        tokens(select, `the ${field} select`, { has: [...kitControl.has, 'appearance-none', 'pr-8'], hasNot: kitControl.hasNot });
        tokens(labelOf(select), `the ${field} label`, kitLabel);
        // Its empty choice stays an ordinary option, so a set value can be cleared again.
        if (field !== 'status') {
          const empty = [...select.childNodes].find((o) => o.tagName === 'OPTION' && o.textContent.startsWith('— Not'));
          assert.ok(empty, `the ${field} select keeps its empty choice`);
          assert.equal(empty.getAttribute('disabled'), null, `the ${field} select's empty choice can be picked`);
        }
      }
      // The URL still spans the grid's two columns from sm up.
      tokens(labelOf(control('INPUT', 'url')).parentNode, 'the URL field', { has: ['sm:col-span-2'] });
    } finally {
      await page.view.unmount();
      delete globalThis.localStorage;
    }
  });
}
