// An entry's legacy `bullets[]` (an old save's, an imported file's) printed in the PDF, Word and ATS
// text, but no field in the editor held them, so they could not be seen, edited or deleted there,
// and the Description eye did not hide them (R2-112). As the résumé loads (normalizeResume, whatever
// its data version, as a file can carry any) they move into the end of the entry's description as
// a list, once and losslessly: the description the editor shows and the eye hides.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, render, read, allText, renderDocx, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const normalizer = () => loadModule('/src/utils/normalizeResume.js');

/** A résumé as an imported file holds it: legacy bullets beside a description, and alone. */
function imported() {
  const r = resume({ sections: [
    section('experience', [
      { role: 'Keeper', company: 'Lighthouse', description: '<p>Kept the light</p>', bullets: ['Trimmed wicks & lamps', ' ', 'Logged <ships>'] },
      { role: 'Plain', company: 'Text', description: 'Plain words', bullets: ['Rowed daily'] },
    ]),
    section('projects', [{ name: 'Beacon', description: '', bullets: ['Built a beacon'] }]),
  ] });
  r.dataVersion = 11;
  return JSON.parse(JSON.stringify(r));
}

describe('legacy bullets become part of the description (R2-112)', () => {
  it('each bullet ends the description as a list item; none are left in bullets', async () => {
    const { normalizeResume } = await normalizer();
    const out = normalizeResume(imported());
    const [keeper, plain] = out.sections[0].items;
    assert.equal(keeper.description, '<p>Kept the light</p><ul><li>Trimmed wicks &amp; lamps</li><li>Logged &lt;ships&gt;</li></ul>');
    assert.deepEqual(keeper.bullets, []);
    assert.equal(plain.description, 'Plain words<ul><li>Rowed daily</li></ul>');
    assert.equal(out.sections[1].items[0].description, '<ul><li>Built a beacon</li></ul>');
  });

  it('prints the same text in the PDF, Word and ATS text as before the move', async () => {
    const { normalizeResume } = await normalizer();
    const { generateAtsPlainText } = await loadModule('/src/utils/atsPlainText.js');
    const before = imported();
    const after = normalizeResume(before);
    const pdf = async (r) => allText(await read(await render(r))).replace(/\s+/g, ' ');
    for (const words of ['Trimmed wicks & lamps', 'Logged <ships>', 'Rowed daily', 'Built a beacon', 'Kept the light']) {
      assert.ok((await pdf(after)).includes(words), `PDF: ${words}`);
      assert.ok((await renderDocx(after)).texts.some((t) => t.includes(words)), `Word: ${words}`);
      assert.ok(generateAtsPlainText(after).includes(words), `ATS: ${words}`);
    }
    assert.equal(generateAtsPlainText(after), generateAtsPlainText(before), 'the ATS text is unchanged');
  });

  it('the Description eye hides them with the description', async () => {
    const { normalizeResume } = await normalizer();
    const r = imported();
    r.sections[0].items[0].hiddenFields = ['description'];
    const text = allText(await read(await render(normalizeResume(r))));
    assert.ok(!text.includes('Trimmed wicks'), 'hidden');
  });

  it('the editor shows them in the Description field', async () => {
    const { normalizeResume } = await normalizer();
    const { ExperienceItem } = await loadModule('/src/components/SectionEditorEntryItems.jsx');
    const item = normalizeResume(imported()).sections[0].items[0];
    // The card opens on click; its fields are its children, so read what it hands the Description editor.
    const el = ExperienceItem({ item, onUpdate() {}, onRemove() {} });
    const find = (node) => (!node || typeof node !== 'object' ? null
      : node.props?.label === 'Description' ? node
        : [].concat(node.props?.children ?? []).map(find).find(Boolean) ?? null);
    const row = find(el);
    assert.match([].concat(row.props.children)[0].props.value, /Trimmed wicks &amp; lamps/);
  });

  it('is idempotent: a résumé with nothing to move comes back as the same object', async () => {
    const { normalizeResume } = await normalizer();
    const once = normalizeResume(imported());
    assert.equal(normalizeResume(once), once);
  });
});
