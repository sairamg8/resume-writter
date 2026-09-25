// A section's eye and its delete, through every export (R2-171). 40-structure pins the PDF of each
// template when the store hides a section; this pins that Word, Markdown, ATS text and JSON Resume
// agree with it, for every section type: a hidden section — its entries and its heading — prints
// nowhere, shown again every export prints exactly what it printed before, a section whose every
// entry is hidden prints no heading of its own, and a hidden section prints exactly what deleting it
// does. The eye and the delete are the store's own actions (createSectionActions).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, render, read, allText, renderDocx, loadModule } from './harness.mjs';

before(setup);
after(teardown);

/** One section of each type, each printing one marker word no other section prints. */
const SECTIONS = [
  ['experience', 'Quillmark', { company: 'Quillmark', role: 'Kilnwright', location: 'Porthaven', startDate: 'Jan 2020', endDate: 'Dec 2022' }],
  ['education', 'Brackenridge', { institution: 'Brackenridge', degree: 'BSc Physics', startDate: '2014', endDate: '2018' }],
  ['skills', 'Zephyrscript', { category: 'Tools', skills: 'Zephyrscript, Git' }],
  ['projects', 'Lanternfish', { name: 'Lanternfish', technologies: 'Rust' }],
  ['languages', 'Occitan', { language: 'Occitan', proficiency: 'Native' }],
  ['certifications', 'Glacierwatch', { name: 'Glacierwatch', issuer: 'Snowline Board', date: 'Mar 2021' }],
  ['awards', 'Tidewater', { title: 'Tidewater', issuer: 'Coastal Guild', date: '2019' }],
  ['volunteering', 'Harborlight', { org: 'Harborlight', role: 'Mentor', startDate: '2018', endDate: '2019' }],
  ['references', 'Farrowby', { name: 'Nell Farrowby', company: 'Ravenmoor', email: 'nell@example.com' }],
  ['interests', 'Falconry', { interests: 'Falconry, Chess' }],
  ['custom', 'Stargazer', { title: 'Stargazer', subtitle: 'Orrery Club', date: '2020' }],
];
const MARKERS = SECTIONS.map(([, m]) => m);

const cv = (template) => resume({
  template,
  settings: { dateFormat: 'asEntered' },
  personal: { name: 'Wren Calloway', title: 'Surveyor', email: 'wren@example.com' },
  sections: SECTIONS.map(([type, , item]) => section(type, [item])),
});

/** `r` after the store's section actions `fn` runs on it. */
async function act(r, fn) {
  const { createSectionActions } = await loadModule('/src/hooks/useResumeSectionActions.js');
  let out = r;
  fn(createSectionActions((patch) => { out = patch(out); }), out);
  return out;
}
const idOf = (r, type) => r.sections.find((s) => s.type === type).id;

/** What every export makes of `r`. */
async function exportsOf(r) {
  const { generateMarkdownResume } = await loadModule('/src/utils/markdownExport.js');
  const { generateAtsPlainText } = await loadModule('/src/utils/atsPlainText.js');
  const { cpwtResumeToJsonResume } = await loadModule('/src/utils/jsonResumeExport.js');
  return {
    pdf: allText(await read(await render(r))),
    word: (await renderDocx(r)).texts,
    markdown: generateMarkdownResume(r),
    ats: generateAtsPlainText(r),
    json: cpwtResumeToJsonResume(r),
  };
}
const asText = (v) => (typeof v === 'string' ? v : Array.isArray(v) ? v.join('\n') : JSON.stringify(v));

/** Per export, the markers it prints (any case: the Sidebar's column capitalises some). */
const printed = (out) => Object.fromEntries(Object.entries(out)
  .map(([k, v]) => [k, MARKERS.filter((m) => asText(v).toLowerCase().includes(m.toLowerCase()))]));

/** Per text export, whether a heading `title` prints: its own line (Word, ATS in capitals) or a '## ' line. */
const headings = (out, title) => ({
  word: out.word.some((t) => t.trim().toLowerCase() === title.toLowerCase()),
  markdown: out.markdown.split('\n').includes(`## ${title}`),
  ats: out.ats.split('\n').includes(title.toUpperCase()),
});
const ALL = { word: true, markdown: true, ats: true };
const NONE = { word: false, markdown: false, ats: false };

const same = (a, b, what) => {
  assert.equal(a.pdf, b.pdf, `${what}: PDF`);
  assert.deepEqual(a.word, b.word, `${what}: Word`);
  assert.equal(a.markdown, b.markdown, `${what}: Markdown`);
  assert.equal(a.ats, b.ats, `${what}: ATS text`);
  assert.deepEqual(a.json, b.json, `${what}: JSON Resume`);
};

// Classic, and the Sidebar's two columns, whose side column picks its sections out on its own.
for (const template of ['classic', 'sidebar']) {
  describe(`${template}: a hidden or deleted section, in every export (R2-171)`, () => {
    let base;
    const baseline = async () => { base ??= await exportsOf(cv(template)); return base; };
    /** Each type's exports with its section deleted by the store, made once. */
    const deletedCache = new Map();
    const deletedOf = async (type) => {
      if (!deletedCache.has(type)) {
        const r = cv(template);
        const deletedR = await act(r, (a) => a.removeSection(idOf(r, type)));
        assert.equal(deletedR.sections.length, SECTIONS.length - 1);
        assert.ok(!deletedR.sections.some((s) => s.type === type));
        deletedCache.set(type, await exportsOf(deletedR));
      }
      return deletedCache.get(type);
    };

    it('shown, every export prints every section and its heading', async () => {
      const out = await baseline();
      for (const [k, list] of Object.entries(printed(out))) assert.deepEqual(list, MARKERS, `${k}: ${asText(out[k])}`);
      for (const s of cv(template).sections) assert.deepEqual(headings(out, s.title), ALL, s.title);
    });

    for (const [type, marker] of SECTIONS) {
      it(`${type}: hidden by its eye it prints nowhere; shown again, as before`, async () => {
        const r = cv(template);
        const id = idOf(r, type);
        const { title } = r.sections.find((s) => s.id === id);
        const hiddenR = await act(r, (a) => a.toggleSectionVisibility(id));
        assert.equal(hiddenR.sections.find((s) => s.id === id).visible, false);
        const hidden = await exportsOf(hiddenR);
        const rest = MARKERS.filter((m) => m !== marker);
        for (const [k, list] of Object.entries(printed(hidden))) assert.deepEqual(list, rest, `${k} leaves out ${marker} and only it`);
        assert.deepEqual(headings(hidden, title), NONE, `no "${title}" heading`);

        const shown = await exportsOf(await act(hiddenR, (a) => a.toggleSectionVisibility(id)));
        same(shown, await baseline(), 'shown again');
      });

      it(`${type}: hidden prints exactly what deleting it prints`, async () => {
        const r = cv(template);
        const id = idOf(r, type);
        const deleted = await deletedOf(type);
        assert.deepEqual(printed(deleted).pdf, MARKERS.filter((m) => m !== marker));
        same(await exportsOf(await act(r, (a) => a.toggleSectionVisibility(id))), deleted, 'hidden vs deleted');
      });

      it(`${type}: every entry hidden, the section prints no heading — as if deleted`, async () => {
        const r = cv(template);
        const id = idOf(r, type);
        const { title } = r.sections.find((s) => s.id === id);
        const emptyR = await act(r, (a) => a.updateSection(id, (s) => ({ ...s, items: s.items.map((i) => ({ ...i, visible: false })) })));
        const empty = await exportsOf(emptyR);
        for (const [k, list] of Object.entries(printed(empty))) assert.ok(!list.includes(marker), `${k} leaves out the hidden entry`);
        assert.deepEqual(headings(empty, title), NONE, `no "${title}" heading over nothing`);
        const deleted = await deletedOf(type);
        assert.equal(empty.pdf, deleted.pdf, 'PDF');
        assert.deepEqual(empty.word, deleted.word, 'Word');
        assert.equal(empty.markdown, deleted.markdown, 'Markdown');
        assert.equal(empty.ats, deleted.ats, 'ATS text');
      });
    }
  });
}
