// R4-SYNC-06: the share panel's "What is public" listed sections the PDF and the public page never
// print — an empty section, or one whose every entry is hidden ("Projects: 0 entries") — since the
// copy kept every shown section. The PDF prints a section only with a shown entry (sectionPrints),
// and now so does the copy, so the list names only what anyone with the link sees. Fictional data only.
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
      section('projects', [], {}, { title: 'Projects' }),
      section('skills', [{ category: 'Hidden', skills: 'Secret skill', visible: false }], {}, { title: 'Skills' }),
    ],
  });
}

it('a section with no shown entry is not in the copy, nor in what the panel lists', () => {
  const copy = link.publicSnapshot(sample());
  assert.deepEqual(copy.sections.map((s) => s.type), ['experience']);
  const lines = link.publicSummary(copy);
  assert.ok(!lines.some((l) => /^(Projects|Skills):/.test(l)), lines.join(' | '));
  assert.ok(lines.some((l) => /: 1 entry$/.test(l)));
});

it('the copy still prints exactly as the résumé does', async () => {
  const r = sample();
  const { normalizeResume } = await loadModule('/src/utils/normalizeResume.js');
  const printed = allText(await read(await render(r)));
  const published = allText(await read(await render(normalizeResume({ ...link.publicSnapshot(r), id: 'public_x', name: 'x' }))));
  assert.equal(published, printed);
});
