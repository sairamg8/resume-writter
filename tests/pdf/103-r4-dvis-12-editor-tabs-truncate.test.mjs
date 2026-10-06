// R4-DVIS-12 (restated for the B3 frame): in a narrow split panel (240–360 px wide) the editor's controls must not
// spill out of their rounded group and slide under their neighbour. The old Resume | Cover Letter | ATS Check tab strip
// is gone (B3): the bar now has the document switch (Resume | Cover Letter), then the ATS chip and the Design button.
// The same intent holds for them: the two switch buttons share the group's width (flex-1 with min-w-0, a flex item's
// min-width being its content otherwise) and each label is a span that truncates; the group itself shrinks
// (min-w-0); the ATS chip and the Design button keep their size beside it (shrink-0, no wrap), so the switch gives
// way and not they. The fake DOM has no layout, so this pins the classes that make it on the real EditorModeBar,
// mounted with react-dom/client over tests/pdf/fake-dom.mjs.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { elements, mount } from './fake-dom.mjs';

before(setup);
after(teardown);

const tokens = (el) => (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
const byTid = (all, id) => all.find((el) => el.getAttribute('data-testid') === id);
const SWITCH = [['doc-switch-resume', 'Resume'], ['doc-switch-letter', 'Cover Letter']];

it('each switch button shares its group and truncates its label; the chip and the Design button keep their size beside it', async () => {
  const { EditorModeBar } = await loadModule('/src/components/EditorHeader.jsx');
  for (const doc of ['resume', 'coverletter']) {
    for (const dock of [null, 'ats', 'design']) {
      const view = mount(EditorModeBar, { doc, dock, onPickDoc() {}, onToggleDock() {} });
      try {
        const all = [...elements(view.container)];
        const where = `${doc}, dock ${dock}`;
        for (const [id, label] of SWITCH) {
          const button = byTid(all, id);
          assert.ok(button, `${where}: the ${label} button`);
          assert.ok(tokens(button).includes('flex-1'), `${where}, ${label}: the two buttons share the group's width`);
          assert.ok(tokens(button).includes('min-w-0'), `${where}, ${label}: without min-w-0 the button keeps its full no-wrap width and overflows the group`);
          const text = [...elements(button)].find((el) => el.tagName === 'SPAN' && el.textContent === label);
          assert.ok(text, `${where}, ${label}: its label is a span that can truncate, not a bare text node`);
          for (const t of ['min-w-0', 'truncate']) assert.ok(tokens(text).includes(t), `${where}, ${label}: the label span has ${t}`);
          assert.ok(tokens(button.parentNode).includes('min-w-0'), `${where}: the group shrinks with the row`);
        }
        for (const id of ['ats-chip', 'design-button']) {
          const chip = byTid(all, id);
          assert.ok(chip, `${where}: ${id}`);
          assert.ok(tokens(chip).includes('shrink-0'), `${where}, ${id}: keeps its size beside the switch`);
          assert.ok(tokens(chip).includes('whitespace-nowrap'), `${where}, ${id}: its words stay on one line`);
          assert.ok(!tokens(chip).includes('min-w-0'), `${where}, ${id}: it does not give way, the switch does`);
        }
      } finally { await view.unmount(); }
    }
  }
});
