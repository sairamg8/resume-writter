// R5-HUNT6-BLANK-SECTION-HEADING (review): the PDF leaves out a section whose entries are all blank —
// one just added, or whose fields are all hidden with their eyes — heading and all. The public copy
// leaves out what the PDF does not print (R4-SYNC-06), but still kept such a section, so the share
// panel's "What is public" listed "Skills: 1 entry" over nothing the page shows. Now the copy drops
// it too, and still prints exactly as the résumé does. Fictional data only.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule, resume, section, experience, render, read, allText } from './harness.mjs';

let link;
before(async () => {
  await setup();
  link = await loadModule('/src/utils/publicLink.js');
});
after(teardown);

function sample() {
  return resume({
    personal: { name: 'Jordan Ellery', title: 'Product Designer' },
    sections: [
      experience([{ company: 'Fabrikam Studio', role: 'Lead Designer' }]),
      section('skills', [{ category: '', skills: '' }], {}, { title: 'Toolbox' }),
      section('skills', [{ category: 'Private', skills: 'Kept', hiddenFields: ['category', 'skills'] }], {}, { title: 'Side Quests' }),
      section('custom', [{ title: '', subtitle: '', description: '<p></p>' }], {}, { title: 'Odd Jobs' }),
    ],
  });
}

it('a section whose entries are all blank, or all hidden with their eyes, is not in the copy nor in what the panel lists', () => {
  const copy = link.publicSnapshot(sample());
  assert.deepEqual(copy.sections.map((s) => s.type), ['experience']);
  const lines = link.publicSummary(copy);
  assert.ok(!lines.some((l) => /^(Toolbox|Side Quests|Odd Jobs):/.test(l)), lines.join(' | '));
});

it('a section with one entry that prints keeps its blank one beside it (the guard)', () => {
  const r = sample();
  r.sections[1].items.push({ ...r.sections[1].items[0], id: 'sk_2', category: 'Tools', skills: 'Figma' });
  const copy = link.publicSnapshot(r);
  assert.deepEqual(copy.sections.map((s) => s.title), [r.sections[0].title, 'Toolbox']);
  assert.equal(copy.sections[1].items.length, 2);
});

it('the copy still prints exactly as the résumé does', async () => {
  const r = sample();
  const { normalizeResume } = await loadModule('/src/utils/normalizeResume.js');
  const printed = allText(await read(await render(r)));
  const published = allText(await read(await render(normalizeResume({ ...link.publicSnapshot(r), id: 'public_x', name: 'x' }))));
  assert.equal(published, printed);
  assert.doesNotMatch(printed, /toolbox|side quests|odd jobs/i);
});
