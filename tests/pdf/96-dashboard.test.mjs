// The dashboard's own résumé actions had no gate test (R2-167): New Resume (a blank one, or a role
// starter from the picker), New Cover, a card's Copy, its inline rename, its Delete (with its
// confirm, and the deletion kept for the cloud sync), a demo account's "Keep as my original", and
// Import (a CPWT-CV backup or a JSON Resume file) were only in Cypress (cypress/e2e/01-dashboard.cy.js),
// which the push gate never runs. Here the real Dashboard and its ResumeCards are mounted with
// react-dom/client (tests/pdf/fake-dom.mjs) over the real store (useAppStore on an in-memory
// localStorage), and each control is checked in what the store then holds, what the page shows,
// where the app goes, and what is saved.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { setup, teardown, resume, section, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';
import { MemoryStorage, settle } from './resume-tab.mjs';

// The demo accounts of this test's build (VITE_DEMO_ACCOUNTS): a made-up one, never the owner's.
// Read when setup() starts Vite, as in 18-cloud-sync-waiting-notice.
const DEMO = { uid: 'demo-uid', email: 'demo@example.com', displayName: 'Demo' };
process.env.VITE_DEMO_ACCOUNTS = DEMO.email;

before(setup);
after(teardown);

const KEY = 'cpwtcv_v1';
const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();

/** Three fictional people's résumés, stamped long ago so an edit's new updatedAt shows. */
function samples() {
  const one = (name, updatedAt, template, personal, items) => Object.assign(
    resume({ template, personal, sections: [section('experience', items)] }),
    { name, updatedAt },
  );
  return [
    one('Harbor Pilot CV', 1000, 'classic', { name: 'Wren Calloway', title: 'Harbor Pilot' }, [{ role: 'Ferry Pilot', company: 'Saltmarsh Line' }]),
    one('Lighthouse CV', 2000, 'modern', { name: 'Idris Vane', title: 'Lighthouse Keeper' }, [{ role: 'Keeper', company: 'Brightwater Light' }]),
    one('Chart Maker CV', 3000, 'sidebar', { name: 'Marlo Quint', title: 'Cartographer' }, [{ role: 'Surveyor', company: 'Tidewater Charts' }]),
  ];
}

/**
 * The Dashboard over the real store, loaded from a saved `resumes` list (none: first visit), as
 * App.jsx wires them; `user` signed in, or null. Returns:
 * - `view`, `store()`, `resumes()`, `where()` (the address the app went to), `storage`;
 * - `all(within)`, `button(label, within)` (by its text, title or aria-label), `buttonWith(words)`,
 *   `click(el)`;
 * - `cards()`, `card(name)`, `names()` (each card's name, in order), `count()` (the "N resumes" line);
 * - `fileInput()`, `pick(file)` (a file chosen in it; `file.text` its contents);
 * - `close()`, then `saved()`: the store as written to storage.
 */
async function dashboard(resumes = [], { user = null } = {}) {
  const { useAppStore } = await loadModule('/src/hooks/useResumeStore.js');
  const { Dashboard } = await loadModule('/src/pages/Dashboard.jsx');
  const storage = new MemoryStorage(resumes.length ? [[KEY, JSON.stringify({ resumes, activeId: resumes[0].id })]] : []);
  globalThis.localStorage = storage;
  const auth = { user, authLoading: false, cloudAvailable: false, signInWithGoogle: () => {}, signOut: () => {} };
  const sync = { syncStatus: 'idle', lastSynced: null, isOnline: true, heldResumes: [] };
  const box = { store: null, where: null };
  function Where() {
    const at = useLocation();
    box.where = at.pathname + at.search;
    return null;
  }
  // The Dashboard stays on screen when it navigates: `where` says where it went.
  function Page() {
    box.store = useAppStore();
    return createElement(MemoryRouter, { initialEntries: ['/'], useTransitions: false },
      createElement(Where), createElement(Dashboard, { store: box.store, auth, sync }));
  }
  const view = mount(Page, {});
  await settle();
  const all = (within = view.container) => [...elements(within)];
  const nameOf = (card) => all(card).find((el) => el.tagName === 'P' && /\btruncate\b/.test(el.className));
  const page = {
    view,
    storage,
    store: () => box.store,
    resumes: () => box.store.appState.resumes,
    where: () => box.where,
    all,
    button(label, within) {
      const found = all(within).find((el) => el.tagName === 'BUTTON'
        && [text(el), el.getAttribute('title'), el.getAttribute('aria-label')].includes(label));
      assert.ok(found, `no button "${label}"`);
      return found;
    },
    buttonWith(words) {
      const found = all().find((el) => el.tagName === 'BUTTON' && text(el).includes(words));
      assert.ok(found, `no button with "${words}"`);
      return found;
    },
    click(el) {
      view.act(() => reactProps(el).onClick({ preventDefault() {}, stopPropagation() {}, target: el, currentTarget: el }));
    },
    cards: () => all().filter((el) => el.tagName === 'DIV' && el.className.startsWith('group bg-white rounded-2xl')),
    card(name) {
      const found = page.cards().find((c) => nameOf(c)?.textContent === name);
      assert.ok(found, `no card "${name}": the dashboard shows ${page.names().join(' | ')}`);
      return found;
    },
    names: () => page.cards().map((c) => nameOf(c)?.textContent ?? null),
    count() {
      const line = all().find((el) => el.tagName === 'P' && /^\d+ resumes?$/.test(text(el)));
      return line && text(line);
    },
    fileInput() {
      const input = all().find((el) => el.tagName === 'INPUT' && (el.type === 'file' || el.getAttribute('type') === 'file'));
      assert.ok(input, 'the Import file input');
      return input;
    },
    async pick(file) {
      const event = { target: { files: [file], value: `C:\\fakepath\\${file.name}` } };
      view.act(() => reactProps(page.fileInput()).onChange(event));
      await settle();
      view.act(() => {});
      return event;
    },
    has: (tag, words) => all().some((el) => el.tagName === tag && text(el) === words),
    async close() {
      await view.unmount(); // writes what the store still holds
      delete globalThis.localStorage;
    },
    saved: () => JSON.parse(storage.getItem(KEY)),
  };
  return page;
}

/** `confirm` answering `answer()`, each question kept in `asked`; restored by the returned function. */
function confirming(answer) {
  const asked = [];
  const saved = globalThis.confirm;
  globalThis.confirm = (question) => { asked.push(question); return answer(); };
  return { asked, restore: () => { if (saved === undefined) delete globalThis.confirm; else globalThis.confirm = saved; } };
}

/**
 * A FileReader that reads a file's `text`, as a browser's does — later — and the import error's
 * 4 s timer held back (never run: the page is gone by then). Restored by the returned function.
 */
function readingFiles() {
  const saved = { FileReader: globalThis.FileReader, setTimeout: globalThis.setTimeout };
  globalThis.FileReader = class {
    readAsText(file) { saved.setTimeout(() => this.onload?.({ target: { result: file.text } }), 0); }
  };
  globalThis.setTimeout = (fn, ms, ...rest) => (ms === 4000 ? 0 : saved.setTimeout(fn, ms, ...rest));
  return () => Object.assign(globalThis, saved);
}

/** `r` as plain JSON: what a comparison of two résumés' content should see. */
const plain = (r) => JSON.parse(JSON.stringify(r));

describe('the dashboard: new résumés (R2-167)', () => {
  it('first visit: no résumés; Create Resume → Start from Scratch makes one blank, untitled résumé and opens it', async () => {
    const page = await dashboard();
    try {
      assert.equal(page.count(), '0 resumes');
      assert.ok(page.has('H2', 'No resumes yet'));
      assert.deepEqual(page.cards(), []);
      page.click(page.button('Create Resume'));
      assert.ok(page.has('H2', 'Choose a Resume Starter'), 'the starter picker opens first');
      assert.deepEqual(page.resumes(), [], 'nothing made yet');
      page.click(page.buttonWith('Start from Scratch (Blank)'));
      await settle();
      const [made] = page.resumes();
      assert.equal(page.resumes().length, 1);
      assert.match(made.id, /^resume_[\w-]+$/);
      assert.equal(made.name, 'Untitled Resume');
      assert.equal(made.personal.name, '');
      assert.deepEqual(made.sections.map((s) => s.type), ['experience', 'education', 'skills']);
      assert.ok(made.sections.every((s) => s.items.length === 0), 'blank');
      assert.equal(page.store().appState.activeId, made.id);
      assert.equal(page.where(), `/resume/${made.id}`);
      assert.ok(!page.has('H2', 'Choose a Resume Starter'), 'the picker closed');
      assert.ok(!page.has('H2', 'No resumes yet'));
      assert.deepEqual(page.names(), ['Untitled Resume']);
      assert.equal(page.count(), '1 resume');
    } finally { await page.close(); }
  });

  it('New Resume → Start from Scratch: a blank résumé after the others, current, opened, and saved', async () => {
    const list = samples();
    const page = await dashboard(list);
    let made;
    try {
      assert.equal(page.count(), '3 resumes');
      assert.deepEqual(page.names(), ['Harbor Pilot CV', 'Lighthouse CV', 'Chart Maker CV']);
      page.click(page.button('New Resume'));
      page.click(page.buttonWith('Start from Scratch (Blank)'));
      await settle();
      const resumes = page.resumes();
      assert.deepEqual(resumes.slice(0, 3).map((r) => r.id), list.map((r) => r.id), 'the others stay, in order');
      made = resumes[3];
      assert.ok(made && !list.some((r) => r.id === made.id), 'a new id');
      assert.equal(made.name, 'Untitled Resume');
      assert.equal(made.template, 'classic');
      assert.equal(page.store().appState.activeId, made.id);
      assert.equal(page.where(), `/resume/${made.id}`);
      assert.deepEqual(page.names(), ['Harbor Pilot CV', 'Lighthouse CV', 'Chart Maker CV', 'Untitled Resume']);
      assert.equal(page.count(), '4 resumes');
    } finally { await page.close(); }
    const saved = page.saved();
    assert.deepEqual(saved.resumes.map((r) => r.id), [...list.map((r) => r.id), made.id]);
    assert.equal(saved.activeId, made.id);
  });

  it("New Resume → a role starter: that starter's résumé, with its name, header and sections, opened", async () => {
    const { STARTER_TEMPLATES } = await loadModule('/src/utils/starterTemplates.js');
    const starter = STARTER_TEMPLATES[1];
    const page = await dashboard(samples());
    try {
      page.click(page.button('New Resume'));
      page.click(page.buttonWith(starter.name));
      await settle();
      const made = page.resumes()[3];
      assert.equal(page.resumes().length, 4);
      assert.equal(made.name, starter.name, 'named after the starter, not "Untitled Resume"');
      assert.equal(made.template, starter.template || 'classic');
      assert.deepEqual(plain(made.personal), plain(starter.personal));
      assert.deepEqual(plain(made.sections), plain(starter.sections));
      assert.notEqual(made.sections, starter.sections, 'a copy: editing it never changes the starter');
      assert.equal(page.store().appState.activeId, made.id);
      assert.equal(page.where(), `/resume/${made.id}`);
      assert.ok(!page.has('H2', 'Choose a Resume Starter'));
    } finally { await page.close(); }
  });

  it('New Cover: a résumé named "Cover Letter", opened on its cover-letter tab', async () => {
    const page = await dashboard(samples());
    try {
      page.click(page.button('New Cover'));
      await settle();
      const made = page.resumes()[3];
      assert.equal(made.name, 'Cover Letter');
      assert.equal(page.store().appState.activeId, made.id);
      assert.equal(page.where(), `/resume/${made.id}?tab=coverletter`);
    } finally { await page.close(); }
  });
});

describe("the dashboard: a card's Copy, rename and Delete (R2-167)", () => {
  it('Copy: "<name> (Copy)" after the others, a new id, the same content as a deep copy, current and opened', async () => {
    const list = samples();
    list[1].keep = true; // marked an original: a copy is a new résumé, not one
    const page = await dashboard(list);
    try {
      const source = page.resumes()[1];
      const t0 = Date.now();
      page.click(page.button('Copy', page.card('Lighthouse CV')));
      await settle();
      const resumes = page.resumes();
      assert.equal(resumes.length, 4);
      const copy = resumes[3];
      assert.equal(copy.name, 'Lighthouse CV (Copy)');
      assert.match(copy.id, /^resume_[\w-]+$/);
      assert.ok(!list.some((r) => r.id === copy.id), 'an id of its own');
      assert.equal(copy.keep, undefined, 'not an original');
      assert.ok(copy.updatedAt >= t0, 'stamped as new');
      const { id: _a, name: _b, updatedAt: _c, keep: _d, ...content } = source;
      const { id: _e, name: _f, updatedAt: _g, keep: _h, ...copied } = copy;
      assert.deepEqual(plain(copied), plain(content), 'the same template, settings, header and sections');
      assert.notEqual(copy.sections, source.sections);
      assert.notEqual(copy.sections[0].items[0], source.sections[0].items[0]);
      assert.notEqual(copy.personal, source.personal);
      assert.equal(page.store().appState.activeId, copy.id);
      assert.equal(page.where(), `/resume/${copy.id}`);
      assert.deepEqual(page.names(), ['Harbor Pilot CV', 'Lighthouse CV', 'Chart Maker CV', 'Lighthouse CV (Copy)']);
      assert.deepEqual(plain(resumes[1]), plain(source), 'the original untouched');
      assert.equal(resumes[1].keep, true);
      // Deep: an edit of the copy (the résumé open now) leaves the original as it was.
      page.view.act(() => page.store().updatePersonal('name', 'Someone Else'));
      assert.equal(page.resumes()[3].personal.name, 'Someone Else');
      assert.equal(page.resumes()[1].personal.name, 'Idris Vane');
    } finally { await page.close(); }
  });

  it('rename: Enter commits the trimmed name; Escape, a blank name and the same name change nothing; Save name and leaving the box commit', async () => {
    const list = samples();
    const page = await dashboard(list);
    try {
      const card = page.card('Lighthouse CV');
      const box = () => page.all(card).find((el) => el.tagName === 'INPUT' && el.getAttribute('aria-label') === 'Résumé name');
      const type = (value) => page.view.act(() => reactProps(box()).onChange({ target: { value } }));
      const key = (k) => page.view.act(() => reactProps(box()).onKeyDown({ key: k }));
      const lighthouse = () => page.resumes()[1];
      const others = () => page.resumes().filter((_, i) => i !== 1).map((r) => [r.name, r.updatedAt]);
      const othersBefore = others();

      assert.equal(box(), undefined, 'no box until Rename');
      const t0 = Date.now();
      page.click(page.button('Rename', card));
      assert.equal(box().value, 'Lighthouse CV', 'the box opens on the name');
      type('  Lighthouse Keeper CV  ');
      key('Enter');
      assert.equal(lighthouse().name, 'Lighthouse Keeper CV');
      assert.ok(lighthouse().updatedAt >= t0, 'an edit: stamped');
      assert.equal(box(), undefined, 'the box closes');
      assert.equal(page.names()[1], 'Lighthouse Keeper CV');
      assert.deepEqual(others(), othersBefore, 'only that résumé');
      assert.equal(page.where(), '/', 'a rename stays on the dashboard');
      const renamedAt = lighthouse().updatedAt;

      page.click(page.button('Rename', card));
      type('Thrown away');
      key('Escape');
      assert.equal(box(), undefined);
      assert.equal(lighthouse().name, 'Lighthouse Keeper CV', 'Escape cancels');
      assert.equal(page.names()[1], 'Lighthouse Keeper CV');

      page.click(page.button('Rename', card));
      type('   ');
      key('Enter');
      assert.equal(lighthouse().name, 'Lighthouse Keeper CV', 'a blank name keeps the name');

      page.click(page.button('Rename', card));
      page.click(page.button('Save name', card));
      assert.equal(lighthouse().updatedAt, renamedAt, 'the same name is not an edit (R2-084)');

      page.click(page.button('Rename', card));
      type('Beacon CV');
      page.click(page.button('Save name', card));
      assert.equal(lighthouse().name, 'Beacon CV', 'Save name commits');

      page.click(page.button('Rename', card));
      type('Beacon Keeper CV');
      page.view.act(() => reactProps(box()).onBlur({}));
      assert.equal(lighthouse().name, 'Beacon Keeper CV', 'leaving the box commits');
      assert.deepEqual(others(), othersBefore);
    } finally { await page.close(); }
    assert.equal(page.saved().resumes[1].name, 'Beacon Keeper CV', 'and it is saved');
  });

  it('Delete asks first, naming the résumé: Cancel keeps it; OK removes it and keeps the deletion (id, version) for the cloud sync, saved', async () => {
    const list = samples();
    const page = await dashboard(list);
    let answer = false;
    const confirm = confirming(() => answer);
    let pilot;
    try {
      pilot = page.resumes()[0];
      page.click(page.button('Delete', page.card('Harbor Pilot CV')));
      assert.deepEqual(confirm.asked, ['Delete "Harbor Pilot CV"? This cannot be undone.']);
      assert.equal(page.resumes().length, 3, 'Cancel keeps it');
      assert.deepEqual(page.store().appState.deletedIds, []);
      assert.deepEqual(page.names(), ['Harbor Pilot CV', 'Lighthouse CV', 'Chart Maker CV']);

      answer = true;
      const t0 = Date.now();
      page.click(page.button('Delete', page.card('Harbor Pilot CV')));
      assert.equal(confirm.asked.length, 2);
      const state = page.store().appState;
      assert.deepEqual(state.resumes.map((r) => r.name), ['Lighthouse CV', 'Chart Maker CV']);
      assert.equal(state.activeId, list[1].id, 'the deleted one was current: the first left is');
      assert.deepEqual(state.deletedIds, [pilot.id]);
      const info = state.deletedInfo[pilot.id];
      assert.equal(info.version, pilot.updatedAt, 'the version deleted (R8-0)');
      assert.ok(info.at >= t0);
      assert.equal(info.owner, null, 'signed out: nobody\'s yet');
      assert.equal(info.keep, false);
      assert.deepEqual(page.names(), ['Lighthouse CV', 'Chart Maker CV']);
      assert.equal(page.count(), '2 resumes');
      assert.equal(page.where(), '/');
    } finally { confirm.restore(); await page.close(); }
    const saved = page.saved();
    assert.deepEqual(saved.resumes.map((r) => r.id), [list[1].id, list[2].id]);
    assert.deepEqual(saved.deletedIds, [pilot.id]);
    assert.equal(saved.deletedInfo[pilot.id].version, pilot.updatedAt);
  });

  it('deleting every résumé leaves the empty dashboard, nothing current, every deletion kept', async () => {
    const list = samples();
    const page = await dashboard(list);
    const confirm = confirming(() => true);
    try {
      for (let i = 0; i < list.length; i += 1) page.click(page.button('Delete', page.cards()[0]));
      assert.equal(confirm.asked.length, 3);
      const state = page.store().appState;
      assert.deepEqual(state.resumes, []);
      assert.equal(state.activeId, null);
      assert.deepEqual([...state.deletedIds].sort(), list.map((r) => r.id).sort());
      assert.ok(page.has('H2', 'No resumes yet'));
      assert.equal(page.count(), '0 resumes');
    } finally { confirm.restore(); await page.close(); }
  });
});

describe('the dashboard: Import (R2-167)', () => {
  it('a CPWT-CV backup: a new résumé with its content and a fresh id — never kept as an original because the file says so — current and opened', async () => {
    const [, , chart] = samples();
    const file = { name: 'chart-maker.json', text: JSON.stringify({ ...chart, id: 'resume_from_file', keep: true }) };
    const page = await dashboard(samples());
    const restore = readingFiles();
    let first;
    try {
      const input = page.fileInput();
      let opened = 0;
      input.click = () => { opened += 1; };
      page.click(page.button('Import'));
      assert.equal(opened, 1, 'Import opens the file picker');

      const t0 = Date.now();
      const event = await page.pick(file);
      assert.equal(event.target.value, '', 'the picker is cleared, so the same file can be picked again');
      assert.equal(page.resumes().length, 4);
      first = page.resumes()[3];
      assert.match(first.id, /^resume_[\w-]+$/);
      assert.notEqual(first.id, 'resume_from_file', 'a fresh id, not the file\'s');
      assert.equal(first.name, 'Chart Maker CV');
      assert.equal(first.template, 'sidebar');
      assert.equal(first.personal.name, 'Marlo Quint');
      assert.deepEqual(first.sections.map((s) => [s.type, s.items.map((i) => i.company)]), [['experience', ['Tidewater Charts']]]);
      assert.equal(first.keep, undefined, 'not an original: this account keeps none');
      assert.ok(first.updatedAt >= t0);
      assert.equal(page.store().appState.activeId, first.id);
      assert.equal(page.where(), `/resume/${first.id}`);
      assert.doesNotMatch(page.view.container.textContent, /Invalid resume file|Could not parse/);

      await page.pick(file);
      const again = page.resumes()[4];
      assert.equal(page.resumes().length, 5, 'the same file twice: two résumés');
      assert.notEqual(again.id, first.id);
      assert.equal(again.name, 'Chart Maker CV');
    } finally { restore(); await page.close(); }
    assert.ok(page.saved().resumes.some((r) => r.id === first.id), 'saved');
  });

  it('a JSON Resume file: converted, named after its person, opened', async () => {
    const file = {
      name: 'tamsin.json',
      text: JSON.stringify({
        basics: { name: 'Tamsin Rook', label: 'Lighthouse Keeper', email: 'tamsin@example.com' },
        work: [{ name: 'Brightwater Light', position: 'Keeper', startDate: '2019-04', endDate: '2023-08' }],
        education: [],
      }),
    };
    const page = await dashboard(samples());
    const restore = readingFiles();
    try {
      await page.pick(file);
      assert.equal(page.resumes().length, 4);
      const made = page.resumes()[3];
      assert.equal(made.name, 'Tamsin Rook Resume');
      assert.equal(made.personal.name, 'Tamsin Rook');
      assert.equal(made.personal.title, 'Lighthouse Keeper');
      assert.equal(made.personal.email, 'tamsin@example.com');
      const work = made.sections.find((s) => s.type === 'experience');
      assert.ok(work, 'its work as Experience');
      assert.deepEqual(work.items.map((i) => [i.company, i.role]), [['Brightwater Light', 'Keeper']]);
      assert.equal(page.store().appState.activeId, made.id);
      assert.equal(page.where(), `/resume/${made.id}`);
    } finally { restore(); await page.close(); }
  });

  it('a JSON file that is not a résumé, or not JSON: says so, imports nothing, stays on the dashboard', async () => {
    const page = await dashboard(samples());
    const restore = readingFiles();
    try {
      await page.pick({ name: 'not-a-resume.json', text: JSON.stringify({ hello: 'world' }) });
      assert.match(page.view.container.textContent, /Invalid resume file — must be a CPWT-CV backup or standard JSON Resume \(\.json\)\./);
      assert.equal(page.resumes().length, 3);
      await page.pick({ name: 'broken.json', text: '{ this is not json' });
      assert.match(page.view.container.textContent, /Could not parse file\./);
      assert.equal(page.resumes().length, 3);
      assert.equal(page.where(), '/');
    } finally { restore(); await page.close(); }
  });
});

describe("the dashboard: a demo account's originals (R2-167)", () => {
  it('Keep as my original marks it (the Original badge); its last original cannot be deleted; Delete says it comes back, and keeps whose it was; Stop keeping undoes it', async () => {
    const list = samples().slice(0, 2);
    const page = await dashboard(list, { user: DEMO });
    const confirm = confirming(() => true);
    try {
      const deleteOf = (name) => page.button('Delete', page.card(name));
      const pilot = () => page.resumes().find((r) => r.id === list[0].id);
      assert.ok(page.button('Keep as my original', page.card('Harbor Pilot CV')));
      // The badge is its own element: the fake DOM runs a card's texts together ("OriginalStop keeping").
      const badged = (name) => [...elements(page.card(name))].some((el) => el.tagName === 'SPAN' && el.textContent.trim() === 'Original');
      assert.equal(badged('Harbor Pilot CV'), false);

      const t0 = Date.now();
      page.click(page.button('Keep as my original', page.card('Harbor Pilot CV')));
      assert.equal(pilot().keep, true);
      assert.ok(pilot().updatedAt >= t0, 'an edit: the sync sends it');
      assert.equal(page.resumes()[1].keep, undefined, 'only that one');
      assert.equal(badged('Harbor Pilot CV'), true, 'the Original badge');
      assert.ok(page.button('Stop keeping', page.card('Harbor Pilot CV')));
      assert.equal(reactProps(deleteOf('Harbor Pilot CV')).disabled, true, 'the last original: deleted, it would come straight back');
      assert.match(page.card('Harbor Pilot CV').textContent, /Your last original always comes back/);
      assert.equal(reactProps(deleteOf('Lighthouse CV')).disabled, false);

      page.click(page.button('Keep as my original', page.card('Lighthouse CV')));
      assert.equal(page.resumes()[1].keep, true);
      assert.equal(reactProps(deleteOf('Harbor Pilot CV')).disabled, false, 'two originals: either can go');

      page.click(deleteOf('Harbor Pilot CV'));
      assert.deepEqual(confirm.asked, ['Delete "Harbor Pilot CV"? It is kept as your original, so it comes back once none of your originals is left. To delete it for good, choose "Stop keeping" first.']);
      const state = page.store().appState;
      assert.deepEqual(state.resumes.map((r) => r.name), ['Lighthouse CV']);
      assert.equal(state.deletedInfo[list[0].id].owner, DEMO.uid, 'the signed-in account\'s deletion');
      assert.equal(state.deletedInfo[list[0].id].keep, true);
      assert.equal(reactProps(deleteOf('Lighthouse CV')).disabled, true, 'the last original now');

      page.click(page.button('Stop keeping', page.card('Lighthouse CV')));
      assert.equal(page.resumes()[0].keep, undefined);
      assert.equal(reactProps(deleteOf('Lighthouse CV')).disabled, false);
      assert.ok(page.button('Keep as my original', page.card('Lighthouse CV')));
    } finally { confirm.restore(); await page.close(); }
  });

  it('Import → Import as my original keeps the imported résumé as an original; Import JSON does not', async () => {
    const [, , chart] = samples();
    const file = { name: 'chart-maker.json', text: JSON.stringify({ ...chart, keep: true }) };
    const page = await dashboard(samples().slice(0, 2), { user: DEMO });
    const restore = readingFiles();
    try {
      let opened = 0;
      page.fileInput().click = () => { opened += 1; };
      page.click(page.button('Import'));
      page.click(page.button('Import as my original'));
      assert.equal(opened, 1);
      await page.pick(file);
      assert.equal(page.resumes()[2].keep, true);

      page.click(page.button('Import'));
      page.click(page.button('Import JSON'));
      assert.equal(opened, 2);
      await page.pick(file);
      assert.equal(page.resumes().length, 4);
      assert.equal(page.resumes()[3].keep, undefined, 'the file\'s own flag counts for nothing');
    } finally { restore(); await page.close(); }
  });
});
