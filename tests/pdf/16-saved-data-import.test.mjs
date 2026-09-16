// Import (Dashboard or Editor → Import JSON) takes a .json exported by any build as a new résumé:
// useAppStore's importResume makes it current against the file's OWN `updatedAt` — which build
// last saved it (src/utils/normalizeResume.js) — and only then stamps it as new. It used to stamp
// `updatedAt = now` first, so every migration keyed on that date read an imported file as edited
// today: a Modern file version 8 stamped before its banner took Photo → Text Position kept Center,
// while the same résumé in the browser's store got Top — one résumé, two layouts (V2W2b-2). The
// import runs through the app's own store here (rendered once on the server; the update the
// import makes during that render is rendered again at once), and the résumé it stores is printed.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { setup, teardown, resume, render, renderCover, read, allText, loadModule } from './harness.mjs';
import { drawing, PNG_2X2 as PNG } from './extractors.mjs';

before(setup);
after(teardown);

/** The push of 4bc56fe: Between Items, the recipient block and the letter's own contact list printed. */
const SPACING_LIVE = Date.UTC(2026, 8, 14, 16, 9, 53);
/** The push of 0b83cb1: Modern's banner printed the stored Text Position (and stamped version 8). */
const MODERN_LIVE = Date.UTC(2026, 8, 15, 2, 32, 51);
const PHONE = '+1 555 0100';

/** A localStorage stand-in: an empty browser. */
class MemoryStorage {
  constructor() { this.map = new Map(); }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

/** `file` (as JSON.parse reads it) imported into the app's store: { id returned, the résumé stored, when }. */
async function imported(file, opts) {
  const { useAppStore } = await loadModule('/src/hooks/useResumeStore.js');
  globalThis.localStorage = new MemoryStorage();
  let store = null;
  let id = null;
  const at = Date.now();
  function Probe() {
    store = useAppStore();
    if (id === null) id = store.importResume(JSON.parse(JSON.stringify(file)), opts);
    return null;
  }
  try {
    renderToString(createElement(Probe));
    return { id, r: store.appState.resumes.find((x) => x.id === id), at };
  } finally {
    delete globalThis.localStorage;
  }
}

/** What loading `file` from this browser's store makes of it (the store's load and the sync's merge). */
const loaded = async (file) => (await loadModule('/src/utils/normalizeResume.js')).normalizeResume(JSON.parse(JSON.stringify(file)));

/** The imported résumé is the stored one, as a new résumé: the file's content, the same migrations. */
function assertImportedAsLoaded({ id, r, at }, file, stored, label) {
  assert.ok(r, `${label}: stored and made the active résumé`);
  assert.ok(id !== file.id, `${label}: a new id`);
  assert.ok(r.updatedAt >= at && r.updatedAt <= Date.now(), `${label}: stamped as edited now`);
  assert.deepEqual({ ...r, id: file.id, updatedAt: file.updatedAt }, stored, `${label}: the same résumé as the browser's store copy`);
}

describe('an imported file is made current by its own date, then stamped as new (V2W2b-2)', () => {
  /** A Modern résumé with a photo, as a build saved it: `dataVersion` undefined = none stored. */
  const modern = (photoTextAlign, { dataVersion, updatedAt }) => {
    const r = resume({ template: 'modern', personal: { photo: PNG, email: 'me@example.com' }, settings: { photoTextAlign } });
    if (dataVersion === undefined) delete r.dataVersion; else r.dataVersion = dataVersion;
    return { ...r, updatedAt };
  };
  // Every build before dff28b7 drew Modern's banner as Top draws it now, whatever was stored.
  const asItPrinted = async (r) => drawing(await render({ ...r, settings: { ...r.settings, photoTextAlign: 'top' } }));

  it('a Modern file version 8, last edited before its banner took Text Position: prints Top, as it did and as the store copy does (R7-10)', async () => {
    for (const align of ['center', 'bottom']) {
      const file = modern(align, { dataVersion: 8, updatedAt: MODERN_LIVE - 60_000 });
      const got = await imported(file);
      assertImportedAsLoaded(got, file, await loaded(file), align);
      // Before: Center (Bottom) — the import's stamp read as an edit made while the preview printed it.
      assert.equal(got.r.settings.photoTextAlign, 'top', `${align}: the panel shows Top`);
      assert.ok(await drawing(await render(got.r)) === await asItPrinted(file), `${align}: draws the page it drew before`);
    }
    // …which Center really does not draw: the comparison above can fail.
    const file = modern('center', { dataVersion: 8, updatedAt: MODERN_LIVE - 60_000 });
    assert.notEqual(await drawing(await render(file)), await asItPrinted(file));
  });

  it('keeps the Text Position a file printed with: version 8 edited since the change went live, version 9 or later', async () => {
    for (const [label, file] of [
      ['version 8, edited since', modern('center', { dataVersion: 8, updatedAt: MODERN_LIVE + 60_000 })],
      ['version 9, last edited before (0566bbc printed the stored value)', modern('bottom', { dataVersion: 9, updatedAt: MODERN_LIVE - 60_000 })],
      ['version 11, whatever its date', modern('center', { dataVersion: 11, updatedAt: 1 })],
    ]) {
      const got = await imported(file);
      assertImportedAsLoaded(got, file, await loaded(file), label);
      assert.equal(got.r.settings.photoTextAlign, file.settings.photoTextAlign, label);
    }
  });

  /**
   * A file no build stamped a version on (4bc56fe and before), last edited at `updatedAt`: Between
   * Items 12 px, the old "Hiring Manager" letter default, and a letter list of its own while the
   * résumé hides the phone.
   */
  const unversioned = (updatedAt) => {
    const r = resume({
      personal: { email: 'me@example.com', phone: PHONE, hiddenFields: ['phone'] },
      settings: { itemGap: 12 },
      coverLetter: { recipientName: '', recipientTitle: 'Hiring Manager', company: '', date: '', subject: '', body: '<p>Hello</p>', hiddenFields: [] },
    });
    delete r.dataVersion;
    return { ...r, updatedAt };
  };

  it('a file last edited before 4bc56fe went live: Between Items, the recipient title and the letter\'s contacts as they printed (R7-2, R5-0)', async () => {
    const file = unversioned(SPACING_LIVE - 86_400_000);
    const got = await imported(file);
    assertImportedAsLoaded(got, file, await loaded(file), 'before');
    // Before: 12, 'Hiring Manager' and [] — the stamp read as an edit on 4bc56fe, which printed them.
    assert.equal(got.r.settings.itemGap, 8, 'Between Items: 8 px, which times Normal is the gap it printed');
    assert.equal(got.r.coverLetter.recipientTitle, '', 'no recipient title: that letter never printed one');
    assert.deepEqual(got.r.coverLetter.hiddenFields, ['phone'], 'the letter keeps the phone the résumé hides off');
    const letter = allText(await read(await renderCover(got.r)));
    assert.ok(!letter.includes('Hiring Manager') && !letter.includes(PHONE) && letter.includes('me@example.com'), letter);
  });

  it('a file edited since 4bc56fe went live keeps all three: that build printed them', async () => {
    const file = unversioned(SPACING_LIVE + 60_000);
    const got = await imported(file);
    assertImportedAsLoaded(got, file, await loaded(file), 'since');
    assert.equal(got.r.settings.itemGap, 12);
    assert.equal(got.r.coverLetter.recipientTitle, 'Hiring Manager');
    assert.deepEqual(got.r.coverLetter.hiddenFields, []);
    const letter = allText(await read(await renderCover(got.r)));
    assert.ok(letter.includes('Hiring Manager') && letter.includes(PHONE), letter);
  });

  it('marked as the account\'s original only when asked, never because the file says so — stamped either way', async () => {
    const file = { ...modern('top', { dataVersion: 11, updatedAt: 1 }), keep: true };
    for (const keep of [false, true]) {
      const { r, at } = await imported(file, { keep });
      assert.equal(r.keep, keep ? true : undefined, `keep: ${keep}`);
      assert.ok(r.updatedAt >= at, `keep: ${keep}: stamped as edited now`);
    }
  });
});
