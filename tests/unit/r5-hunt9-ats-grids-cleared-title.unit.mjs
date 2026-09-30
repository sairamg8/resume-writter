// R5-HUNT9-ATS-GRIDS-WARNING-CLEARED-TITLE-TYPE-ID: ATS Check's "Entries printed side by side"
// warning named a custom section whose title was cleared by its type id, '"custom"', while its own
// fix notice (Grids 1) called it '"Untitled"'. The warning now names each section as the notices do
// (atsHeadingLabel), as R5-HUNT8 did for the headings warning.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeAtsScore, atsHeadingLabel } from '../../src/utils/atsChecker.js';

const gridsItem = (sections) => analyzeAtsScore({
  id: 'r', template: 'classic', settings: {},
  personal: { name: 'Lena Novak', hiddenFields: [] },
  sections,
}).categories.layout.items.find((i) => i.id === 'section_grids');

test('a cleared custom section is "Untitled" in the warning, as in its fix notice, never "custom"', () => {
  const custom = { id: 'c1', type: 'custom', title: '', visible: true, settings: { columns: 2 },
    items: [{ id: 'a', title: 'Talk', subtitle: 'KubeCon' }, { id: 'b', title: 'Paper', subtitle: 'VLDB' }] };
  const item = gridsItem([custom]);
  assert.ok(item, 'the section prints side by side');
  assert.equal(item.text, `Entries printed side by side: ${atsHeadingLabel(custom)}`);
  assert.equal(item.text, 'Entries printed side by side: "Untitled"');
  assert.doesNotMatch(item.text, /"custom"/);
});

test('a cleared standard section and a titled one read as their notices name them', () => {
  const jobs = [{ id: 'e1', company: 'Acme', role: 'Engineer' }, { id: 'e2', company: 'Initech', role: 'Engineer' }];
  const exp = { id: 'exp', type: 'experience', title: '  ', visible: true, settings: { columns: 2 }, items: jobs };
  const proj = { id: 'p', type: 'projects', title: 'Side Work', visible: true, settings: { columns: 2 }, items: [{ id: 'p1', name: 'Ledger' }, { id: 'p2', name: 'Atlas' }] };
  assert.equal(gridsItem([exp, proj]).text, 'Entries printed side by side: "Professional Experience" (no heading), "Side Work"');
});
