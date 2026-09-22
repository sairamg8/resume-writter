// A résumé can hold a value that is not text where the app keeps text: a native .json or a JSON
// Resume file written by hand or by another tool, or a résumé already saved that way in this browser
// or the cloud. A skill group's skills can be a list (['React', 'SQL']), a number or an object. Every
// reader of those fields expects text. The cover letter generator split the skills and threw
// ("….split is not a function") as the Cover Letter tab rendered, and the editor went blank. The
// ATS score threw on the ATS tab, the Skills editor threw on an object category, the ATS text,
// Markdown and JSON Resume exports threw, and a section title stored as a number broke the PDF.
// normalizeResume() now turns each such value into text on the way in, whatever the résumé's data
// version (src/utils/textFields.js). A list becomes its text and numbers, comma-separated, as every
// export already printed a list of skills. A number becomes its digits. Anything else (an object,
// true) becomes '', as a field never filled in. Text, and every field that does not hold text, is
// left as it is.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { setup, teardown, resume, section, experience, render, renderCover, renderDocx, read, allText, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const normalizer = () => loadModule('/src/utils/normalizeResume.js');

/** A résumé as a file or an older save stores it (after JSON.parse): values that are not text where text belongs. */
function stored() {
  return JSON.parse(JSON.stringify(resume({
    personal: { name: ['Ada', 'Lovelace'], title: 7, email: { a: 1 }, summary: true, website: 'ada.dev', websiteLabel: { toString: 'x' } },
    sections: [
      section('skills', [
        { category: 2024, skills: ['React', ' SQL ', 3, { x: 1 }, null] },
        { category: 'Tools', skills: 12345 },
        { category: 'Old', skills: '', name: ['Go'] },
        { category: { a: 1 }, skills: true },
      ], {}, { title: 7 }),
      experience([{ role: {}, company: ['A', 'B'], description: 5 }]),
    ],
    coverLetter: { body: '<p>Hi</p>', signatureName: ['Ada', 'L'], signatureDesignation: { a: 1 } },
  })));
}

/** The skill group's `skills` in `r`, in order. */
const skillsOf = (r) => r.sections.find((s) => s.type === 'skills').items.map((i) => i.skills);

describe('a value that is not text, where a résumé keeps text, is text once loaded', () => {
  it('a list gives its text and numbers, a number its digits, an object or true \'\' — the rest as stored', async () => {
    const { normalizeResume } = await normalizer();
    const file = stored();
    const before = JSON.parse(JSON.stringify(file));
    const r = normalizeResume(file);
    assert.deepEqual(file, before, 'the input is not mutated');
    assert.equal(r.updatedAt, before.updatedAt, 'not an edit');

    const [skills, work] = r.sections;
    assert.equal(skills.title, '7', 'a section title');
    assert.deepEqual(skills.items.map(({ category, skills: s, name }) => [category, s, name]), [
      ['2024', 'React, SQL, 3', undefined],
      ['Tools', '12345', undefined],
      ['Old', '', 'Go'],
      ['', '', undefined],
    ]);
    const { role, company, description, ...rest } = work.items[0];
    assert.deepEqual({ role, company, description }, { role: '', company: 'A, B', description: '5' });
    const { role: _r, company: _c, description: _d, ...restBefore } = before.sections[1].items[0];
    assert.deepEqual(rest, restBefore, 'the entry\'s other fields (dates, current, bullets) as stored');

    assert.deepEqual(r.personal, {
      ...before.personal, name: 'Ada, Lovelace', title: '7', email: '', summary: '', websiteLabel: '',
    }, 'the rest (website, photo, hidden fields) as stored');
    // The letter's signature, which the generator's Apply saved from the résumé's name. One with no
    // text is left out, not '': the letter then signs with the résumé's name, as one never filled in.
    assert.equal(r.coverLetter.signatureName, 'Ada, L');
    assert.ok(!('signatureDesignation' in r.coverLetter));
    assert.equal(r.coverLetter.body, '<p>Hi</p>');

    assert.equal(normalizeResume(r), r, 'a second load changes nothing: the same object');
  });

  it('whatever the résumé\'s data version: this build\'s, a later one a file claims, or none', async () => {
    const { normalizeResume, DATA_VERSION } = await normalizer();
    for (const dataVersion of [DATA_VERSION, 999, undefined, 3]) {
      assert.deepEqual(skillsOf(normalizeResume({ ...stored(), dataVersion })), ['React, SQL, 3', '12345', '', ''], String(dataVersion));
    }
  });

  it('a résumé of text is the same object: every section type, and a date stored as a number (dates.js reads it)', async () => {
    const { normalizeResume } = await normalizer();
    const { SECTION_TYPE_DEFAULTS } = await loadModule('/src/utils/defaultDataSectionTypes.js');
    const sections = Object.keys(SECTION_TYPE_DEFAULTS).map((type) => {
      const blank = SECTION_TYPE_DEFAULTS[type]('x').items[0];
      const typed = Object.fromEntries(Object.entries(blank).map(([k, v]) => [k, typeof v === 'string' ? `${type} ${k}` : v]));
      return section(type, [{ ...typed, hiddenFields: [] }, { ...blank }]);
    });
    sections[0].items[0].startDate = 2019;
    const current = resume({
      personal: { email: 'ada@example.com', website: 'ada.dev', websiteLabel: 'Site', summary: '<p>Hi</p>' },
      sections,
      coverLetter: { signatureName: 'Ada', signatureDesignation: '' },
    });
    assert.equal(normalizeResume(current), current);
  });

  it('a list of skills prints as it did: the PDF and Word print the stored text as they printed the list', async () => {
    const { normalizeResume } = await normalizer();
    for (const template of ['classic', 'sidebar']) {
      for (const skillsStyle of ['inline', 'bars']) {
        const raw = resume({ template, sections: [section('skills', [{ category: 'Shown', skills: ['Scala', ' OCaml ', 3] }, { category: 2024, skills: 'Rust' }], { skillsStyle })] });
        const r = normalizeResume(JSON.parse(JSON.stringify(raw)));
        assert.deepEqual(skillsOf(r), ['Scala, OCaml, 3', 'Rust']);
        assert.equal(allText(await read(await render(r))), allText(await read(await render(raw))), `${template}, ${skillsStyle}`);
        if (template === 'classic') assert.deepEqual((await renderDocx(r)).texts, (await renderDocx(raw)).texts, skillsStyle);
      }
    }
  });
});

/** A localStorage stand-in holding `init`. */
class MemoryStorage {
  constructor(init = {}) { this.map = new Map(Object.entries(init)); }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

/** The app's store, rendered once on the server with `saved` in localStorage; `act` runs in its render. */
async function withStore(saved, act = () => {}) {
  const { useAppStore } = await loadModule('/src/hooks/useResumeStore.js');
  globalThis.localStorage = new MemoryStorage(saved ? { cpwtcv_v1: JSON.stringify(saved) } : {});
  let store = null;
  let done = false;
  function Probe() {
    store = useAppStore();
    if (!done) { done = true; act(store); }
    return null;
  }
  try {
    renderToString(createElement(Probe));
    return store.appState.resumes;
  } finally {
    delete globalThis.localStorage;
  }
}

describe('every way a résumé comes in', () => {
  it('an imported .json (native, or JSON Resume converted), this browser\'s saved store, the cloud\'s copy', async () => {
    const { jsonResumeToCpwtResume } = await loadModule('/src/utils/jsonResume.js');
    const { mergeResumeLists } = await loadModule('/src/utils/syncMerge.js');
    const want = ['React, SQL, 3', '12345', '', ''];
    const [imported] = await withStore(null, (store) => store.importResume(stored()));
    assert.deepEqual(skillsOf(imported), want, 'native import');
    const converted = jsonResumeToCpwtResume({ basics: { name: 'Ada' }, skills: [{ name: 'Lang', keywords: 12345 }, { name: 'Tools', keywords: { a: 1 } }] });
    const [fromJsonResume] = await withStore(null, (store) => store.importResume(converted));
    assert.deepEqual(skillsOf(fromJsonResume), ['12345', ''], 'JSON Resume import');
    const [loaded] = await withStore({ resumes: [{ ...stored(), dataVersion: 3 }], activeId: null, dataVersion: 3 });
    assert.deepEqual(skillsOf(loaded), want, 'saved in this browser');
    const [merged] = mergeResumeLists([], [{ ...stored(), id: 'cloud_1', updatedAt: 5 }], new Set());
    assert.deepEqual(skillsOf(merged), want, 'the cloud\'s copy');
  });
});

describe('what reads the loaded résumé reads text', () => {
  it('the cover letter, the ATS score and text, the Markdown and JSON Resume exports, the PDF and Word, the letter\'s PDF', async () => {
    const { normalizeResume } = await normalizer();
    const r = normalizeResume(stored());
    const { generateCoverLetter } = await loadModule('/src/utils/coverLetterGenerator.js');
    const { analyzeAtsScore, generateAtsPlainText } = await loadModule('/src/utils/atsChecker.js');
    const { generateMarkdownResume } = await loadModule('/src/utils/markdownExport.js');
    const { cpwtResumeToJsonResume } = await loadModule('/src/utils/jsonResume.js');

    const letter = generateCoverLetter({ resume: r });
    assert.ok(letter.body.includes('React, SQL, 3, 12345'), letter.body);
    assert.doesNotThrow(() => analyzeAtsScore(r));
    const atsText = generateAtsPlainText(r);
    assert.ok(atsText.includes('2024: React, SQL, 3') && atsText.includes('A, B'), atsText);
    const markdown = generateMarkdownResume(r);
    assert.deepEqual(cpwtResumeToJsonResume(r).skills.map((s) => s.keywords), [['React', 'SQL', '3'], ['12345'], ['Go'], []]);
    const pdf = allText(await read(await render(r)));
    assert.ok(pdf.includes('React, SQL, 3'), pdf);
    const { texts } = await renderDocx(r);
    // The letter signs with the healed signature ('Ada, L'), and its designation falls back to the résumé's title.
    const letterPdf = allText(await read(await renderCover(r)));
    assert.ok(letterPdf.endsWith('Ada, L 7'), letterPdf);
    for (const out of [letter.body, atsText, markdown, pdf, texts.join(' | '), letterPdf]) assert.ok(!out.includes('[object Object]'), out);
  });

  it('the editor: the ATS tab and each skill group in the Skills editor render', async () => {
    const { normalizeResume } = await normalizer();
    const r = normalizeResume(stored());
    const { default: AtsCheckerPanel } = await loadModule('/src/components/AtsCheckerPanel.jsx');
    const { SkillItem } = await loadModule('/src/components/SectionEditorLeafItems.jsx');
    assert.ok(renderToString(createElement(AtsCheckerPanel, { resume: r, store: {} })).length > 0);
    for (const item of r.sections[0].items) {
      const html = renderToString(createElement(SkillItem, { item, onUpdate() {}, onRemove() {} }));
      assert.ok(!html.includes('[object Object]'), html);
    }
  });
});
