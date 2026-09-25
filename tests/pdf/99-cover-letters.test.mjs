// R2-135: Dashboard → New Cover Letter made a blank résumé named 'Cover Letter' — no name, no
// contacts, the letterhead said 'Your Name' — and the dashboard listed it with the résumés and
// counted it as one. Now a new letter takes the name, job title, contacts and photo (and the look) of
// a résumé: the only one there is, or the one picked when there are several (the most recently edited
// first); with none it is blank. Letters are listed in a group of their own, never counted as a
// résumé, and each opens on its letter, copies, renames and deletes like a résumé. A 'Cover Letter'
// résumé an older build saved (the old button's) is marked a letter on load (data version 13) and
// prints exactly as it did. The real store (useAppStore) and the real Dashboard, mounted with
// react-dom/client over tests/pdf/fake-dom.mjs; handlers are called as React set them.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { setup, teardown, loadModule, renderCover, render, read, readDocx, allText } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';
import { PNG_2X2 as PNG } from './extractors.mjs';

before(setup);
after(teardown);

const KEY = 'cpwtcv_v1';

/** A localStorage stand-in. */
class MemoryStorage {
  constructor(entries = []) { this.map = new Map(entries); }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

// Fictional people.
const JORDAN = {
  name: 'Jordan Avery', title: 'Product Designer', email: 'jordan.avery@example.com', phone: '+1 555 0142',
  location: 'Portland, OR', website: 'jordanavery.example', linkedin: 'linkedin.com/in/jordan-avery-example',
  github: '', summary: '<p>Designer of calm, useful software.</p>', photo: PNG, hiddenFields: ['phone'],
};
const SAM = { ...JORDAN, name: 'Sam Rivera', title: 'Data Engineer', email: 'sam.rivera@example.com', photo: null, hiddenFields: [] };

/** A résumé as this build saves it, with one experience entry (the letter generator writes from it). */
function cv(id, name, personal, updatedAt, extra = {}) {
  return {
    id, name, updatedAt, dataVersion: 13, template: 'modern',
    settings: { accentColor: '#0f766e', font: 'notosans', fontSizeBase: 11 },
    personal,
    sections: [{
      id: 'experience', type: 'experience', title: 'Experience', visible: true, settings: {},
      items: [{ id: 'e1', company: 'Northwind Studio', role: 'Designer', startDate: '01/2020', endDate: '', current: true, description: '<p>Led the design system.</p>' }],
    }],
    coverLetter: {
      // What this résumé's own letter says to its reader …
      recipientName: 'Morgan Lee', recipientTitle: 'Head of Design', company: 'Contoso', date: '2026-03-01',
      subject: 'Application for Lead Designer', body: '<p>Dear Morgan, I would love to join Contoso.</p>',
      // … and how it is headed and signed.
      closing: 'Best regards', signatureName: 'J. Avery', signatureDesignation: '', signatureSpace: 'wide',
      headerStyle: 'bar', headerLayout: 'single', fieldsPosition: 'below-name', showPhoto: true, hiddenFields: ['location'],
    },
    ...extra,
  };
}

const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();
const inside = (el, tag) => { for (let n = el; n; n = n.parentNode) if (n.tagName === tag) return true; return false; };

/** Where the page is: the path and query on the editor's route, or the dashboard. */
function Editor() {
  const location = useLocation();
  const navigate = useNavigate();
  return createElement('div', null,
    createElement('p', { 'data-where': '' }, location.pathname + location.search),
    createElement('button', { onClick: () => navigate('/') }, 'Back to dashboard'));
}

const auth = { user: null, authLoading: false, cloudAvailable: false, signInWithGoogle() {}, signOut() {} };
const sync = { syncStatus: 'idle', lastSynced: null, isOnline: true, heldResumes: [] };

/** The app's store and Dashboard over a saved store holding `resumes` (as a build at `dataVersion` saved it). */
async function openApp(resumes, dataVersion = 13) {
  const { useAppStore } = await loadModule('/src/hooks/useResumeStore.js');
  const { Dashboard } = await loadModule('/src/pages/Dashboard.jsx');
  globalThis.localStorage = new MemoryStorage([[KEY, JSON.stringify({ resumes, activeId: resumes[0]?.id ?? null, dataVersion, deletedIds: [] })]]);
  const saved = globalThis.confirm;
  globalThis.confirm = () => true;
  let store = null;
  function App() {
    store = useAppStore();
    return createElement(MemoryRouter, { initialEntries: ['/'] },
      createElement(Routes, null,
        createElement(Route, { path: '/', element: createElement(Dashboard, { store, auth, sync }) }),
        createElement(Route, { path: '/resume/:id', element: createElement(Editor) })));
  }
  const view = mount(App, {});
  // The router commits a navigation from an effect, and the store saves from one: let them run.
  const settle = async () => { for (let i = 0; i < 10; i += 1) { await new Promise((r) => { setImmediate(r); }); view.act(() => {}); } };
  await settle();
  const all = () => [...elements(view.container)];
  /** The button whose text is `label` — or starts with it, `starts` true — under `root`. */
  const button = (label, root = view.container, starts = false) => {
    const found = [...elements(root)].find((el) => el.tagName === 'BUTTON' && (starts ? text(el).startsWith(label) : text(el) === label));
    assert.ok(found, `a button reads "${label}"; the page: ${text(view.container)}`);
    return found;
  };
  /** Calls `el`'s handler `name` as React set it, then lets what it started settle. */
  const fire = async (el, name, event = {}) => {
    const handler = reactProps(el)?.[name];
    assert.ok(handler, `no ${name} handler on <${el?.tagName}>`);
    view.act(() => handler({ target: el, currentTarget: el, preventDefault() {}, stopPropagation() {}, ...event }));
    await settle();
  };
  const click = (el) => fire(el, 'onClick');
  return {
    view,
    store: () => store,
    active: () => store.appState.resumes.find((r) => r.id === store.appState.activeId),
    where: () => all().find((el) => el.hasAttribute('data-where'))?.textContent ?? null,
    button,
    click,
    fire,
    press: (label) => click(button(label)),
    dialog: () => all().find((el) => el.getAttribute('role') === 'dialog') ?? null,
    /** Every card on the dashboard: its text, and whether it is in the Cover Letters group. */
    cards: () => all().filter((el) => el.tagName === 'DIV' && /\bgroup bg-white rounded-2xl\b/.test(el.className))
      .map((el) => ({ el, text: text(el), letter: inside(el, 'SECTION') })),
    card: (name) => {
      const found = all().filter((el) => el.tagName === 'DIV' && /\bgroup bg-white rounded-2xl\b/.test(el.className)).filter((el) => text(el).includes(name));
      assert.equal(found.length, 1, `one card shows "${name}"`);
      return found[0];
    },
    heading: (level) => all().filter((el) => el.tagName === level).map(text),
    counts: () => all().filter((el) => el.tagName === 'P' && /^\d+ (resume|letter)s?$/.test(text(el))).map(text),
    async close() {
      await view.unmount();
      delete globalThis.localStorage;
      globalThis.confirm = saved;
    },
  };
}

/** The letter's PDF, Word and plain text, as its tab exports them. */
async function exportsOf(letter) {
  const { renderCoverLetterDocx } = await loadModule('/src/utils/wordExport.js');
  const { generateCoverLetterPlainText } = await loadModule('/src/utils/coverLetterText.js');
  const docx = readDocx(new Uint8Array(await (await renderCoverLetterDocx(letter)).arrayBuffer()));
  return { pdf: allText(await read(await renderCover(letter))), docx: docx.texts.join(' | '), txt: generateCoverLetterPlainText(letter) };
}

describe('New Cover Letter takes a résumé\'s name, job title, contacts and photo (R2-135)', () => {
  it('one résumé: the letter is made from it and opens on its letter tab; its PDF, Word and text print the sender', async () => {
    const app = await openApp([cv('resume_j', 'Design CV', JORDAN, 1000)]);
    try {
      const before = JSON.parse(JSON.stringify(app.store().appState.resumes[0]));
      await app.press('New Cover');
      const letter = app.active();
      assert.match(app.where() ?? '', new RegExp(`^/resume/${letter.id}\\?tab=coverletter$`));
      assert.equal(letter.kind, 'letter', 'marked a letter');
      assert.notEqual(letter.id, 'resume_j');
      assert.equal(letter.name, 'Cover Letter');
      for (const key of ['name', 'title', 'email', 'phone', 'website', 'linkedin', 'photo']) {
        assert.equal(letter.personal[key], JORDAN[key], `${key} — before: a blank résumé, no name, no contacts`);
      }
      assert.deepEqual(letter.personal.hiddenFields, ['phone'], 'what the résumé hides, its photo setting among them');
      assert.deepEqual(letter.personal, before.personal);
      assert.equal(letter.template, 'modern');
      assert.deepEqual(letter.settings, before.settings, 'its look: the letterhead follows the résumé\'s template and Design');
      assert.deepEqual(letter.sections, before.sections, 'Auto-Generate writes from its entries');
      const { coverLetter: cl } = letter;
      for (const key of ['recipientName', 'recipientTitle', 'company', 'date', 'subject', 'body']) {
        assert.equal(cl[key], '', `${key}: a new letter says nothing yet to its reader`);
      }
      assert.deepEqual(
        [cl.closing, cl.signatureName, cl.signatureSpace, cl.headerStyle, cl.headerLayout, cl.fieldsPosition, cl.showPhoto, cl.hiddenFields],
        ['Best regards', 'J. Avery', 'wide', 'bar', 'single', 'below-name', true, ['location']],
        'the letterhead and sign-off chosen on the résumé\'s letter',
      );
      const source = app.store().appState.resumes.find((r) => r.id === 'resume_j');
      assert.deepEqual(source, before, 'the résumé itself is untouched');

      const out = await exportsOf(letter);
      for (const [what, printed] of Object.entries(out)) {
        for (const shown of ['Jordan Avery', 'Product Designer', 'jordan.avery@example.com', 'jordanavery.example']) {
          assert.ok(printed.includes(shown), `${what} prints "${shown}": ${printed}`);
        }
        // The letter's own Visible Contact Fields, copied with it, hide the location.
        assert.ok(!printed.includes('Portland'), `${what} hides the location as the letter chose`);
        assert.ok(!printed.includes('Contoso') && !printed.includes('Morgan'), `${what}: none of the résumé letter's words to its reader`);
      }
    } finally { await app.close(); }
  });

  it('several résumés: a picker lists them, the most recently edited first; the one picked heads the letter', async () => {
    const app = await openApp([
      cv('resume_a', 'Older CV', JORDAN, 1000),
      cv('resume_b', 'Newest CV', SAM, 3000),
      cv('resume_c', 'Middle CV', { ...JORDAN, name: 'Casey Morgan' }, 2000),
    ]);
    try {
      await app.press('New Cover');
      const dialog = app.dialog();
      assert.ok(dialog, 'before: a blank résumé was made at once');
      assert.equal(dialog.getAttribute('aria-modal'), 'true');
      assert.ok(text(dialog).includes('New Cover Letter'));
      const listed = [...elements(dialog)].filter((el) => el.tagName === 'BUTTON' && el.getAttribute('aria-label') !== 'Close').map(text);
      assert.equal(listed.length, 4, listed.join(' / '));
      ['Newest CV', 'Middle CV', 'Older CV', 'Blank letter'].forEach((name, i) => assert.ok(listed[i].startsWith(name), `${i + 1}: ${listed[i]}`));
      assert.match(listed[0], /Sam Rivera · Data Engineer/);
      assert.match(listed[0], /Last edited/);
      assert.equal(app.store().appState.resumes.length, 3, 'nothing is made until one is picked');

      await app.click(app.button('Middle CV', dialog, true));
      assert.equal(app.dialog(), null);
      const letter = app.active();
      assert.equal(letter.kind, 'letter');
      assert.equal(letter.personal.name, 'Casey Morgan');
      assert.match(app.where() ?? '', /\?tab=coverletter$/);
    } finally { await app.close(); }
  });

  it('the picker\'s Blank letter makes a blank one; Escape and Close make nothing', async () => {
    const app = await openApp([cv('resume_a', 'A CV', JORDAN, 1000), cv('resume_b', 'B CV', SAM, 2000)]);
    try {
      await app.press('New Cover Letter');
      await app.fire(app.dialog().parentNode, 'onKeyDown', { key: 'Escape' });
      assert.equal(app.dialog(), null, 'Escape closes it');
      await app.press('New Cover');
      await app.click([...elements(app.dialog())].find((el) => el.getAttribute('aria-label') === 'Close'));
      assert.equal(app.dialog(), null, 'Close closes it');
      assert.equal(app.store().appState.resumes.length, 2, 'and neither made a letter');

      await app.press('New Cover');
      await app.click(app.button('Blank letter', app.dialog(), true));
      const letter = app.active();
      assert.equal(letter.kind, 'letter');
      assert.equal(letter.name, 'Cover Letter');
      assert.equal(letter.personal.name, '');
      assert.equal(letter.personal.email, '');
    } finally { await app.close(); }
  });

  it('no résumé at all: New Cover makes a blank letter, listed as a letter', async () => {
    const app = await openApp([]);
    try {
      await app.press('New Cover');
      const letter = app.active();
      assert.equal(letter.kind, 'letter');
      assert.equal(letter.personal.name, '');
      assert.match(app.where() ?? '', /\?tab=coverletter$/);
      await app.press('Back to dashboard');
      assert.deepEqual(app.counts(), ['0 resumes', '1 letter']);
      assert.ok(app.heading('H2').includes('No resumes yet'), 'no résumé yet: the letter is not one');
      assert.ok(app.cards().every((c) => c.letter), 'its card is in the Cover Letters group');
    } finally { await app.close(); }
  });
});

describe('the dashboard lists letters as letters (R2-135)', () => {
  const letter = (id, name, updatedAt) => ({ ...cv(id, name, JORDAN, updatedAt), kind: 'letter' });

  it('letters are a group of their own, never counted or shown as a résumé', async () => {
    const app = await openApp([cv('resume_a', 'Design CV', JORDAN, 1000), letter('resume_l1', 'Contoso letter', 2000), cv('resume_b', 'Data CV', SAM, 3000), letter('resume_l2', 'Fabrikam letter', 4000)]);
    try {
      assert.deepEqual(app.counts(), ['2 resumes', '2 letters'], 'before: "4 resumes"');
      assert.ok(app.heading('H2').includes('Cover Letters'));
      const cards = app.cards();
      assert.deepEqual(cards.filter((c) => !c.letter).map((c) => c.text.includes('CV')), [true, true], 'the résumés\' grid holds the two résumés');
      assert.deepEqual(cards.filter((c) => c.letter).map((c) => /letter/.test(c.text)), [true, true], 'the letters\' group holds the two letters');
      // Each letter's card draws a letter, not the résumé layout of its template.
      assert.equal(cards.filter((c) => c.letter).map((c) => [...elements(c.el)].find((el) => el.hasAttribute('data-thumb'))?.getAttribute('data-thumb')).join(), 'letter,letter');
      assert.equal(cards.filter((c) => !c.letter).map((c) => [...elements(c.el)].find((el) => el.hasAttribute('data-thumb'))?.getAttribute('data-thumb')).join(), 'modern,modern');
    } finally { await app.close(); }
  });

  it('each letter opens on its letter, copies as a letter, renames and deletes like a résumé', async () => {
    const app = await openApp([cv('resume_a', 'Design CV', JORDAN, 1000), letter('resume_l1', 'Contoso letter', 2000)]);
    try {
      await app.click(app.button('Edit', app.card('Contoso letter')));
      assert.equal(app.where(), '/resume/resume_l1?tab=coverletter', 'Edit opens the letter on its tab');
      await app.press('Back to dashboard');

      await app.click(app.button('Copy', app.card('Contoso letter')));
      const copy = app.active();
      assert.equal(copy.name, 'Contoso letter (Copy)');
      assert.equal(copy.kind, 'letter', 'a copy of a letter is a letter');
      assert.equal(app.where(), `/resume/${copy.id}?tab=coverletter`);
      await app.press('Back to dashboard');
      assert.deepEqual(app.counts(), ['1 resume', '2 letters']);

      const card = app.card('Contoso letter (Copy)');
      await app.click([...elements(card)].find((el) => el.getAttribute('title') === 'Rename'));
      const input = [...elements(card)].find((el) => el.tagName === 'INPUT');
      await app.fire(input, 'onChange', { target: { value: 'Fabrikam letter' } });
      await app.fire(input, 'onKeyDown', { key: 'Enter' });
      assert.equal(app.store().appState.resumes.find((r) => r.id === copy.id).name, 'Fabrikam letter');

      await app.click(app.button('Delete', app.card('Fabrikam letter')));
      assert.deepEqual(app.store().appState.resumes.map((r) => r.id), ['resume_a', 'resume_l1']);
      assert.deepEqual(app.counts(), ['1 resume', '1 letter']);
    } finally { await app.close(); }
  });

  it('New Cover Letter twice: two letters, each its own', async () => {
    const app = await openApp([cv('resume_a', 'Design CV', JORDAN, 1000)]);
    try {
      await app.press('New Cover Letter');
      const first = app.active().id;
      await app.press('Back to dashboard');
      await app.press('New Cover Letter');
      const second = app.active().id;
      await app.press('Back to dashboard');
      assert.notEqual(first, second);
      assert.deepEqual(app.counts(), ['1 resume', '2 letters']);
      assert.ok(app.store().appState.resumes.filter((r) => r.kind === 'letter').every((r) => r.personal.name === 'Jordan Avery'));
    } finally { await app.close(); }
  });

  it('a letter is not the account\'s original, whatever its résumé is', async () => {
    const { letterFrom } = await loadModule('/src/utils/letters.js');
    const made = letterFrom(cv('resume_k', 'Kept CV', JORDAN, 1000, { keep: true }), { id: 'resume_n', now: 5000 });
    assert.equal('keep' in made, false);
    assert.equal(made.updatedAt, 5000);
    assert.equal(made.kind, 'letter');
  });

  it('the career panel beside the lists reads a résumé, not a letter', async () => {
    const app = await openApp([letter('resume_l1', 'Contoso letter', 2000), cv('resume_b', 'Data CV', SAM, 3000)]);
    try {
      // The store opens the first record, the letter; the panel shows the résumé's person.
      assert.ok(text(app.view.container).includes('Sam Rivera'), 'before: the letter\'s sender, as if a résumé');
      assert.ok(!text(app.view.container).includes('Jordan Avery'));
    } finally { await app.close(); }
  });

  it('a letter card\'s thumbnail draws a letter, with its photo as the letter prints it', async () => {
    const { ResumeCard } = await loadModule('/src/components/ResumeCard.jsx');
    const html = (r) => renderToString(createElement(ResumeCard, { resume: r, onOpen() {}, onDuplicate() {}, onDelete() {}, onRename() {} }));
    const shown = html(letter('resume_l1', 'Mine', 0));
    assert.match(shown, /data-thumb="letter"/);
    assert.match(shown, /data-thumb-photo/, 'the résumé photo the letter prints');
    const off = letter('resume_l1', 'Mine', 0);
    off.coverLetter = { ...off.coverLetter, showPhoto: false };
    assert.doesNotMatch(html(off), /data-thumb-photo/, 'Show photo off on the letter');
    assert.notEqual(html(letter('resume_l1', 'Mine', 0)), html(cv('resume_l1', 'Mine', JORDAN, 0)));
  });
});

describe('a \'Cover Letter\' résumé an older build saved (R2-135, data version 13)', () => {
  // What the old New Cover Letter made: a blank Classic résumé named 'Cover Letter', whose Personal
  // Info and letter the user then filled in. Saved by a version-12 build.
  async function oldLetter(extra = {}) {
    const { createBlankResume } = await loadModule('/src/utils/defaultData.js');
    const r = createBlankResume({ id: 'resume_old', name: 'Cover Letter' });
    return {
      ...r, dataVersion: 12, updatedAt: Date.UTC(2026, 8, 20),
      personal: { ...r.personal, name: 'Jordan Avery', title: 'Product Designer', email: 'jordan.avery@example.com', phone: '+1 555 0142' },
      coverLetter: { ...r.coverLetter, company: 'Contoso', recipientName: 'Morgan Lee', body: '<p>Dear Morgan, I would love to join Contoso.</p>' },
      ...extra,
    };
  }

  it('is marked a letter, and nothing else about it changes: its letter and its résumé print as they did', async () => {
    const { normalizeResume, DATA_VERSION } = await loadModule('/src/utils/normalizeResume.js');
    const old = await oldLetter();
    const now = normalizeResume(old);
    assert.equal(now.kind, 'letter', 'before: listed and counted as a résumé');
    assert.equal(now.dataVersion, DATA_VERSION);
    const { kind: _k, dataVersion: _v, ...rest } = now;
    const { dataVersion: _o, ...was } = old;
    assert.deepEqual(rest, was, 'no other field changes; updatedAt neither (not an edit)');
    assert.deepEqual(await exportsOf(now), await exportsOf(old), 'the letter prints the same, in the PDF, Word and text');
    assert.equal(allText(await read(await render(now))), allText(await read(await render(old))), 'and so does its résumé');
  });

  it('one the user renamed, or gave entries, stays a résumé; so does one a build that knows letters saved', async () => {
    const { normalizeResume } = await loadModule('/src/utils/normalizeResume.js');
    assert.equal(normalizeResume(await oldLetter({ name: 'Contoso letter' })).kind, undefined, 'renamed');
    const withEntries = await oldLetter();
    withEntries.sections = withEntries.sections.map((s) => (s.type === 'skills' ? { ...s, items: [{ id: 's1', name: 'Figma' }] } : s));
    assert.equal(normalizeResume(withEntries).kind, undefined, 'it has an entry: a résumé in use');
    assert.equal(normalizeResume(await oldLetter({ dataVersion: 13 })).kind, undefined, 'saved by this build as a résumé the user named so');
  });

  it('loaded from storage, the dashboard lists it with the letters and opens it on its letter', async () => {
    const app = await openApp([cv('resume_a', 'Design CV', JORDAN, 1000), await oldLetter()], 12);
    try {
      assert.deepEqual(app.counts(), ['1 resume', '1 letter'], 'before: "2 resumes"');
      await app.click(app.button('Edit', app.card('Cover Letter')));
      assert.equal(app.where(), '/resume/resume_old?tab=coverletter');
    } finally { await app.close(); }
  });
});
