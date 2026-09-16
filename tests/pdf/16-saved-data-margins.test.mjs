// A résumé's page margins as an imported .json, a hand-edited store or a cloud copy can carry them:
// any number. The Design panel sets Top / Bottom and Left / Right from 0 to 40 mm, on every build;
// the PDF (= the preview) and the letter print what is stored, and past 40 mm they broke — the
// Sidebar column's text and photo ran off its dark panel onto the white page (VF2-3.2-NB1), a
// margin wider than half the paper threw, a tall one never finished rendering. normalizeResume
// (src/utils/normalizeResume.js) brings them into the editor's range wherever résumés come in.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { setup, teardown, resume, section, render, renderCover, read, allItems, allText, loadModule, TEMPLATES } from './harness.mjs';
import { drawing, painted, PNG_2X2 as PNG } from './extractors.mjs';

before(setup);
after(teardown);

const PERSONAL = { name: 'Pat Lee', title: 'Engineer', email: 'pat.lee@example.com', phone: '+1 555 0100' };
const normalizer = () => loadModule('/src/utils/normalizeResume.js');

/** `r` as the import (or the sync) hands it over: this build's file, or one no data version stamped. */
const asFile = (r, { old = false } = {}) => {
  const out = { ...r, updatedAt: 5 };
  if (old) delete out.dataVersion;
  return out;
};

/** The dark column's résumé: photo, name, title, contacts and a side section — nothing in the main column. */
const sidebar = (settings) => resume({
  template: 'sidebar',
  settings: { photoSize: 'lg', ...settings },
  personal: { ...PERSONAL, photo: PNG },
  sections: [section('skills', [{ name: 'JavaScript' }, { name: 'TypeScript' }])],
});

/** `file` imported through the app's own store (useAppStore's importResume, as 16-saved-data-import): the résumés it holds. */
async function importedIntoStore(file) {
  const { useAppStore } = await loadModule('/src/hooks/useResumeStore.js');
  const map = new Map();
  globalThis.localStorage = {
    get length() { return map.size; }, key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k),
  };
  let store = null;
  let id = null;
  function Probe() {
    store = useAppStore();
    if (id === null) id = store.importResume(JSON.parse(JSON.stringify(file)));
    return null;
  }
  try {
    renderToString(createElement(Probe));
    return store.appState.resumes.filter((r) => r.id === id);
  } finally {
    delete globalThis.localStorage;
  }
}

describe('a Left / Right margin past the editor\'s 40 mm (VF2-3.2-NB1)', () => {
  it('Sidebar: the column\'s text and photo print inside its dark panel, as at 40 mm', async () => {
    const { normalizeResume } = await normalizer();
    for (const pageSize of ['A4', 'LETTER']) {
      for (const marginH of [60, 75, 41]) {
        for (const old of [false, true]) {
          const at = `${pageSize}, ${marginH} mm, ${old ? 'no data version' : 'this build\'s file'}`;
          const imported = asFile(sidebar({ pageSize, marginH }), { old });
          const r = normalizeResume(imported);
          const bytes = await render(r);
          const [page] = await read(bytes);
          const panel = page.W * 0.38;
          for (const t of allItems([page])) {
            assert.ok(t.x >= 0 && t.x + t.w <= panel, `${at}: "${t.str}" at x ${t.x.toFixed(1)}–${(t.x + t.w).toFixed(1)}, the panel ends at ${panel.toFixed(1)}`);
          }
          const photos = (await painted(bytes)).filter((p) => p.paint === 'image');
          assert.equal(photos.length, 1, at);
          assert.ok(photos[0].x0 >= 0 && photos[0].x1 <= panel, `${at}: the photo at x ${photos[0].x0.toFixed(1)}–${photos[0].x1.toFixed(1)}`);
          assert.equal(r.settings.marginH, 40, `${at}: stored as the editor's largest, so its panel shows what prints`);
          assert.equal(r.updatedAt, 5, `${at}: not an edit`);
          const atMax = { ...imported, settings: { ...imported.settings, marginH: 40 } };
          assert.equal(await drawing(bytes), await drawing(await render(normalizeResume(atMax))), `${at}: prints as at 40 mm`);
        }
      }
    }
  });

  it('every template and its letter print, at 40 mm, a margin wider than half the paper or taller than half of it', async () => {
    const { normalizeResume } = await normalizer();
    for (const template of TEMPLATES) {
      const r = normalizeResume(asFile(resume({ template, personal: PERSONAL, settings: { marginH: 110, marginV: 160 } })));
      // The values first: 110 mm made react-pdf throw ("unsupported number: Infinity"), and 160 mm
      // never finished laying the page out.
      assert.deepEqual([r.settings.marginH, r.settings.marginV], [40, 40], template);
      const page = (await read(await render(r)))[0];
      assert.ok(allText([page]).includes('Pat Lee'), `${template}: the résumé prints`);
      const letter = (await read(await renderCover({ ...r, coverLetter: { ...r.coverLetter, body: '<p>Hello</p>' } })))[0];
      assert.ok(allText([letter]).includes('Hello'), `${template}: the letter prints`);
    }
  });

  it('below 0 is 0, the editor\'s smallest; a number stored as text is that number, in range', async () => {
    const { normalizeResume } = await normalizer();
    const cases = [[-10, 0], [-0.5, 0], ['60', 40], [' 75 ', 40], ['12', 12], ['0', 0], ['-3', 0], [40.5, 40]];
    for (const [stored, kept] of cases) {
      const r = normalizeResume(asFile(resume({ settings: { marginH: stored, marginV: stored } })));
      assert.deepEqual([r.settings.marginH, r.settings.marginV], [kept, kept], JSON.stringify(stored));
    }
    const text = asFile(sidebar({ marginH: '60' }));
    const number = asFile(sidebar({ marginH: 40 }));
    assert.equal(await drawing(await render(normalizeResume(text))), await drawing(await render(normalizeResume(number))), 'Sidebar at "60" prints as at 40 mm');
  });

  it('Import JSON and the cloud sync\'s merge store it in range', async () => {
    const file = asFile(sidebar({ marginH: 60, marginV: 55 }));
    const [stored] = await importedIntoStore(file);
    assert.deepEqual([stored.settings.marginH, stored.settings.marginV], [40, 40], 'Import JSON');
    const { mergeResumeLists } = await loadModule('/src/utils/syncMerge.js');
    const [merged] = mergeResumeLists([], [file], new Set());
    assert.deepEqual([merged.settings.marginH, merged.settings.marginV], [40, 40], 'the cloud copy');
  });

  // Guards: only a margin the editor cannot hold changes; the fix is the tests above.
  it('keeps every margin the editor can hold, and a résumé that stores none', async () => {
    const { normalizeResume } = await normalizer();
    for (const v of [0, 1, 12.5, 14, 18, 39.9, 40]) {
      const current = resume({ template: 'sidebar', settings: { marginH: v, marginV: v } });
      assert.equal(normalizeResume(current), current, `${v} mm, this build's data: the same object`);
      const old = normalizeResume(asFile(resume({ settings: { marginH: v, marginV: v } }), { old: true }));
      assert.deepEqual([old.settings.marginH, old.settings.marginV], [v, v], `${v} mm, no data version`);
    }
    const none = resume();
    delete none.settings.marginH;
    none.settings.marginV = null;
    const r = normalizeResume(none);
    assert.equal(r, none, 'no margins stored: the same object, printing the defaults');
    assert.ok(!('marginH' in r.settings) && r.settings.marginV === null);
    const junk = normalizeResume({ ...asFile(resume()), settings: 'junk' });
    assert.equal(junk.settings, 'junk', 'settings that are not an object are left as they are');
    for (const stored of ['abc', '', true, {}]) {
      // Not a number: dropped, so the default prints (VF2-3.2-NB1-NB1, 16-saved-data-spacing).
      const dropped = normalizeResume(asFile(resume({ settings: { marginH: stored } })));
      assert.ok(!('marginH' in dropped.settings), `${JSON.stringify(stored)}: not a number, dropped`);
    }
  });
});
