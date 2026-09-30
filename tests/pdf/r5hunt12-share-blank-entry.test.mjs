// R5-HUNT12-SHARE-BLANK-ENTRY-CHANGED-SINCE: since R5-HUNT7-BLANK-ENTRY the PDF (printedEntries) draws no
// entry that prints nothing — a blank one just added, or one with every field hidden with its eye — but
// the public copy kept it beside the entries that print. The share panel then listed "Experience: 3
// entries" over the 2 the page prints, and after Add entry (left blank) said "You have changed the
// résumé since" although the public page prints exactly the same. Now the copy leaves such an entry out,
// and a copy published before still reads as current and is counted by what it prints. Fictional data only.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule, resume, section, experience, render, read, allText } from './harness.mjs';

let link;
before(async () => {
  await setup();
  link = await loadModule('/src/utils/publicLink.js');
});
after(teardown);

const sample = () => resume({
  personal: { name: 'Jordan Ellery', title: 'Product Designer' },
  sections: [experience([{ company: 'Fabrikam Studio', role: 'Lead Designer' }, { company: 'Northwind Labs', role: 'Designer' }])],
});
/** The blank entry Add entry puts in an Experience section. */
const blankJob = (id) => ({ ...section('experience', [{}]).items[0], id });

it('a blank entry beside printed ones is not in the copy nor counted in what is public', () => {
  const r = sample();
  r.sections[0].items.push(blankJob('exp_blank'));
  const copy = link.publicSnapshot(r);
  assert.equal(copy.sections[0].items.length, 2);
  const title = r.sections[0].title;
  assert.ok(link.publicSummary(copy).includes(`${title}: 2 entries`), link.publicSummary(copy).join(' | '));
});

it('adding a blank entry, or hiding every field of one, after publishing is no change', () => {
  const published = link.publicSnapshot(sample());
  const added = sample();
  added.sections[0].items.push(blankJob('exp_blank'));
  assert.equal(link.publishedIsCurrent(published, added), true);
  const hidden = sample();
  hidden.sections[0].items.push({ ...blankJob('exp_h'), company: 'Private Co', role: 'Secret', hiddenFields: ['company', 'role'] });
  assert.equal(link.publishedIsCurrent(published, hidden), true);
  // A real change still is one.
  const changed = sample();
  changed.sections[0].items[1].role = 'Senior Designer';
  assert.equal(link.publishedIsCurrent(published, changed), false);
});

it('a copy published with a blank entry in it reads as current and counts what it prints', () => {
  const r = sample();
  r.sections[0].items.push(blankJob('exp_blank'));
  const old = link.publicSnapshot(sample());
  old.sections[0].items.push(blankJob('exp_blank'));
  assert.equal(link.publishedIsCurrent(old, r), true);
  assert.ok(link.publicSummary(link.publicSnapshot(old)).includes(`${r.sections[0].title}: 2 entries`));
});

it('the copy still prints exactly as the résumé does', async () => {
  const r = sample();
  r.sections[0].items.splice(1, 0, blankJob('exp_blank'));
  const { normalizeResume } = await loadModule('/src/utils/normalizeResume.js');
  const printed = allText(await read(await render(r)));
  const published = allText(await read(await render(normalizeResume({ ...link.publicSnapshot(r), id: 'public_x', name: 'x' }))));
  assert.equal(published, printed);
});
