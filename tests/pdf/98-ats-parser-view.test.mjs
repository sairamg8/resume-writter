// R2-141: the ATS tab's "What a parser reads" — the text of the résumé's own PDF, as pdf.js reads it.
//   - parserText.js reads a PDF into lines of runs by the two rules the ATS battery holds an item-based
//     parser to (tests/pdf/ats-entry-header.mjs): on every template its lines and runs are the
//     battery's, and it holds every word pdf.js reads, in pdf.js's order;
//   - it agrees with the ATS text export where the PDF does: the name, the contacts, each job's title and
//     company are in both; where the PDF prints a Display label ("LinkedIn") instead of the address, the
//     view shows the label, as the checker's LinkedIn warning says a parser reads it;
//   - the panel: closed at first, it builds no PDF; opened, it shows that text from the résumé's own
//     PDF, Copy puts the same text on the clipboard, and a new résumé is read again; beside a
//     side-by-side layout it says pdf.js's order is not every parser's;
//   - the tab's header no longer says it was "Tested for Workday, Taleo, Greenhouse, Lever & iCIMS",
//     which nothing tests.
// The panel runs over fake-dom (tests/pdf/fake-dom.mjs) with the app's own renderResumePdf, and the real
// pdf.js (pdfjs-dist's legacy build, the one the preview loads) handed in without a worker.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { setup, teardown, render, read, loadModule, resume, section, allText, TEMPLATES } from './harness.mjs';
import { lines } from './ats-entry-header.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

before(setup);
after(teardown);

const squash = (s) => String(s).replace(/\s+/g, ' ').trim();

/** The demo résumé of `template`, its personal info overridden. */
async function demo(template, personal = {}, settings = {}) {
  const { DEMO_RESUMES } = await loadModule('/tests/fixtures/sampleResumes.js');
  const r = structuredClone(DEMO_RESUMES.find((x) => x.template === template));
  r.personal = { ...r.personal, ...personal };
  r.settings = { ...r.settings, ...settings };
  return r;
}

/** What the view shows for `bytes`: parserText over readPdfLines, as the component reads it. */
async function viewText(bytes) {
  const { readPdfLines, parserText } = await loadModule('/src/utils/parserText.js');
  const pages = await readPdfLines(bytes.slice(), { lib: pdfjs });
  return { pages, text: parserText(pages) };
}

describe('parserText reads the PDF as the battery\'s item-based parser does (R2-141)', () => {
  for (const template of TEMPLATES) {
    it(`${template}: its lines and runs are the battery's, and it holds every word pdf.js reads, in order`, async () => {
      const bytes = await render(await demo(template));
      const { pages, text } = await viewText(bytes);
      const battery = lines(await read(bytes)).map((runs) => runs.map((r) => r.text).filter(Boolean)).filter((runs) => runs.length);
      assert.deepEqual(pages.flat(), battery, 'the same lines, split into the same runs');
      assert.equal(squash(text), squash(allText(await read(bytes))), 'every word, in pdf.js\'s order');
      assert.equal(text.split('\n\n').length >= pages.filter((p) => p.length).length, true, 'a blank line between pages');
    });
  }

  it('a date set apart at the line\'s end is a run of its own, three spaces from the title', async () => {
    const r = resume({
      template: 'classic',
      personal: { name: 'Pat Sample', email: 'pat@example.com' },
      sections: [section('experience', [{ company: 'Northwind Traders', role: 'Staff Engineer', startDate: '03/2021', endDate: '', current: true }])],
    });
    const { pages, text } = await viewText(await render(r));
    const line = pages.flat().find((runs) => runs.some((t) => t.includes('Staff Engineer')));
    assert.ok(line && line.length >= 2, `the title's line has runs apart: ${JSON.stringify(line)}`);
    assert.ok(line.some((t) => /03\/2021/.test(t) && !t.includes('Staff Engineer')), 'the dates are not merged into the title');
    const { RUN_GAP } = await loadModule('/src/utils/parserText.js');
    assert.ok(text.split('\n').includes(line.join(RUN_GAP)));
  });

  it('textLines skips items with no text and anything that is not a pdf.js item', async () => {
    const { textLines, parserText } = await loadModule('/src/utils/parserText.js');
    const item = (str, x, y, w = 20, h = 10) => ({ str, transform: [h, 0, 0, h, x, y], width: w, height: h });
    const got = textLines([item('Pat', 0, 700), { str: '', transform: [1, 0, 0, 1, 0, 0] }, item(' ', 22, 700), null, { str: 'x' },
      item('Sample', 22, 700.5, 30), item('2021', 200, 700, 20), item('Northwind', 0, 680, 40)]);
    assert.deepEqual(got, [['Pat Sample', '2021'], ['Northwind']]);
    assert.equal(parserText([got, [], [['Page two']]]), 'Pat Sample   2021\nNorthwind\n\nPage two');
    assert.equal(parserText(undefined), '');
    assert.deepEqual(textLines(undefined), []);
  });
});

describe('the view agrees with the ATS text export where the PDF does (R2-141)', () => {
  for (const template of ['classic', 'modern', 'sidebar']) {
    it(`${template}: the name, email, phone, each job's title and company are in both`, async () => {
      const r = await demo(template);
      const { text } = await viewText(await render(r));
      const { generateAtsPlainText } = await loadModule('/src/utils/atsChecker.js');
      const exported = squash(generateAtsPlainText(r));
      const jobs = r.sections.find((s) => s.type === 'experience').items;
      const facts = [r.personal.name, r.personal.email, r.personal.phone, ...jobs.flatMap((j) => [j.role, j.company])].filter(Boolean);
      assert.ok(facts.length >= 5);
      for (const f of facts) {
        assert.ok(squash(text).includes(f), `the view holds "${f}"`);
        assert.ok(exported.includes(f), `the export holds "${f}"`);
      }
    });
  }

  it('a LinkedIn Display label: the view shows the label, not the address — what the checker warns a parser reads', async () => {
    const PROFILE = 'linkedin.com/in/jordan-rivera-sample';
    const r = await demo('classic', { linkedinLabel: 'LinkedIn', linkedinUrl: `https://www.${PROFILE}` });
    const { text } = await viewText(await render(r));
    assert.match(text, /LinkedIn/);
    assert.doesNotMatch(text, /linkedin\.com\/in/);
    const { analyzeAtsScore } = await loadModule('/src/utils/atsChecker.js');
    const item = analyzeAtsScore(r).categories.contact.items.find((i) => i.id === 'linkedin');
    assert.equal(item.status, 'warn');
  });
});

/** Waits (real time) until `check()` holds, up to 30 s. */
async function until(check, what) {
  for (let i = 0; i < 600; i += 1) {
    if (check()) return;
    await new Promise((r) => { setTimeout(r, 50); });
  }
  assert.fail(`timed out waiting for ${what}`);
}

/** The ATS tab (AtsCheckerPanel, as Editor.jsx mounts it) over `r`, pdf.js handed in without a worker. */
async function atsTab(r) {
  const { default: AtsCheckerPanel } = await loadModule('/src/components/AtsCheckerPanel.jsx');
  const { _setPdfjsForTest } = await loadModule('/src/components/AtsParserView.jsx');
  _setPdfjsForTest({ lib: pdfjs });
  const store = { updateResume() {}, updateSection() {}, updateSectionSettings() {} };
  const view = mount(AtsCheckerPanel, { resume: r, store });
  const all = () => [...elements(view.container)];
  const text = (el) => squash(el.textContent);
  const button = (label) => all().find((el) => el.tagName === 'BUTTON' && text(el).startsWith(label));
  const clipboard = [];
  globalThis.navigator ??= {};
  const savedClipboard = Object.getOwnPropertyDescriptor(globalThis.navigator, 'clipboard');
  Object.defineProperty(globalThis.navigator, 'clipboard', { configurable: true, value: { writeText: async (t) => { clipboard.push(t); } } });
  return {
    view,
    store,
    all,
    clipboard,
    pre: () => all().find((el) => el.tagName === 'PRE'),
    status: () => all().find((el) => el.getAttribute('data-parser-status'))?.getAttribute('data-parser-status'),
    header: () => text(view.container),
    click(label) {
      const b = button(label);
      assert.ok(b, `no button starts "${label}"`);
      view.act(() => reactProps(b).onClick());
    },
    async unmount() {
      await view.unmount();
      _setPdfjsForTest(null);
      if (savedClipboard) Object.defineProperty(globalThis.navigator, 'clipboard', savedClipboard);
      else delete globalThis.navigator.clipboard;
    },
  };
}

describe('the ATS tab: What a parser reads (R2-141)', () => {
  it('closed, it reads nothing; opened, it shows the PDF\'s text, Copy copies it, and a changed résumé is read again', async () => {
    const r = await demo('classic');
    const tab = await atsTab(r);
    try {
      assert.equal(tab.pre(), undefined, 'closed at first: no text, no PDF built');
      tab.click('What a parser reads');
      await until(() => tab.status() === 'ready', 'the first read');
      const { text } = await viewText(await render(r));
      assert.equal(tab.pre().textContent, text, 'the text of the résumé\'s own PDF, as parserText reads it');
      assert.doesNotMatch(tab.header(), /pdf\.js reads text set side by side/, 'one column: no side-by-side note');

      tab.click('Copy');
      await until(() => tab.clipboard.length === 1, 'the copy');
      assert.equal(tab.clipboard[0], text);

      const renamed = { ...r, personal: { ...r.personal, name: 'Morgan Example' } };
      tab.view.update({ resume: renamed, store: tab.store });
      await until(() => tab.status() === 'ready' && tab.pre().textContent.includes('Morgan Example'), 'the read of the changed résumé');
      assert.doesNotMatch(tab.pre().textContent, new RegExp(r.personal.name));

      tab.click('What a parser reads');
      assert.equal(tab.pre(), undefined, 'closed again');
    } finally { await tab.unmount(); }
  });

  it('beside the two-column Sidebar, it says a parser that reads by position mixes the columns\' lines', async () => {
    const tab = await atsTab(await demo('sidebar'));
    try {
      tab.click('What a parser reads');
      await until(() => tab.status() === 'ready', 'the read');
      assert.match(tab.header(), /pdf\.js reads text set side by side in the order it is drawn/);
    } finally { await tab.unmount(); }
  });

  it('the header names no parser nothing tests', async () => {
    const tab = await atsTab(await demo('classic'));
    try {
      assert.doesNotMatch(tab.header(), /Tested for|iCIMS|Greenhouse, Lever/);
    } finally { await tab.unmount(); }
  });
});
