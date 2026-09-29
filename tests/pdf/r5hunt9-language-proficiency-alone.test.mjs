// R5-HUNT9-LANGUAGE-DEFAULT-PROFICIENCY-PRINTS-ALONE: every new language row starts as
// { language: '', proficiency: 'Professional' }. entryPrints counted the proficiency alone as printed
// text, so a Languages section just added printed its heading over a lone "Professional" in the PDF
// (and so the preview) and in Word, while Markdown and ATS text left the section out, and the ATS Check
// counted it. An extra "Add Language" row gave an extra "Professional" cell. Now a language row prints
// only with its language, in all four exports. Fictional data only.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, experience, render, renderDocx, read, allText, loadModule, TEMPLATES } from './harness.mjs';

before(setup);
after(teardown);

// As Add Section → Languages, and Add Language, make a row (defaultDataSectionTypes, NEW_ITEM.languages).
const NEW_ROW = () => ({ language: '', proficiency: 'Professional' });
const JUST_ADDED = () => section('languages', [NEW_ROW()], {}, { title: 'Tongues' });

const sample = (extra, template = 'classic') => resume({
  template,
  personal: { name: 'Robin Vale', title: 'Staff Engineer', email: 'robin.vale@example.com' },
  sections: [experience([{ company: 'Fabrikam Studio', role: 'Lead Engineer' }]), ...extra],
});

describe('A language row with no language prints nothing (R5-HUNT9-LANGUAGE-DEFAULT-PROFICIENCY-PRINTS-ALONE)', () => {
  for (const template of TEMPLATES) {
    it(`${template}: a just-added Languages section prints no heading and no lone proficiency in the PDF`, async () => {
      const text = allText(await read(await render(sample([JUST_ADDED()], template))));
      assert.match(text, /Fabrikam Studio/, 'the filled section prints');
      assert.doesNotMatch(text, /tongues/i, text);
      assert.doesNotMatch(text, /Professional/, text);
    });
  }

  it('Word prints neither the heading nor a lone "Professional"', async () => {
    const { texts } = await renderDocx(sample([JUST_ADDED()]));
    assert.ok(texts.some((t) => /Fabrikam Studio/.test(t)), texts.join(' | '));
    assert.ok(!texts.some((t) => /tongues|Professional/i.test(t)), texts.join(' | '));
  });

  it('the section does not print (sectionPrints), as Markdown and ATS text leave it out', async () => {
    const { sectionPrints, printedEntries } = await loadModule('/src/utils/entryPrints.js');
    const { generateMarkdownResume } = await loadModule('/src/utils/markdownExport.js');
    const { generateAtsPlainText } = await loadModule('/src/utils/atsPlainText.js');
    assert.equal(sectionPrints(JUST_ADDED()), false);
    const added = section('languages', [{ language: 'Spanish', proficiency: 'Native' }, NEW_ROW()]);
    assert.deepEqual(printedEntries(added).map((i) => i.language), ['Spanish']);
    const r = sample([JUST_ADDED()]);
    assert.doesNotMatch(generateMarkdownResume(r), /tongues/i);
    assert.doesNotMatch(generateAtsPlainText(r), /tongues/i);
  });

  it('an added row beside a filled one adds no "Professional" cell, in the PDF and Word', async () => {
    const r = sample([section('languages', [{ language: 'Spanish', proficiency: 'Native' }, NEW_ROW()], {}, { title: 'Tongues' })]);
    const text = allText(await read(await render(r)));
    assert.match(text, /tongues/i, text);
    assert.match(text, /Spanish/, text);
    assert.doesNotMatch(text, /Professional/, text);
    const { texts } = await renderDocx(r);
    assert.ok(texts.some((t) => /Spanish/.test(t)), texts.join(' | '));
    assert.ok(!texts.some((t) => /Professional/.test(t)), texts.join(' | '));
  });

  // Guard: a language with its proficiency prints both.
  it('a language with its proficiency still prints both', async () => {
    const r = sample([section('languages', [{ language: 'German', proficiency: 'Professional' }], {}, { title: 'Tongues' })]);
    const text = allText(await read(await render(r)));
    assert.match(text, /German/, text);
    assert.match(text, /Professional/, text);
  });
});
