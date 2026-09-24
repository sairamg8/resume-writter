// A résumé's paper (Design → Spacing → Page size, R2-136) survives the two files it can leave in:
// Export → Backup JSON (the résumé as stored) and Export → JSON Resume, each imported as the store
// imports a file (useAppStore's importResume: normalizeResume, a new id). The JSON Resume file
// carried no page size, so a US Letter résumé came back on A4 and every page break moved; the
// Backup kept it. Both now reprint the Letter pages, and an A4 résumé's comes back storing none.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { setup, teardown, resume, experience, render, read, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const LETTER = [612, 792];
const A4 = [595.28, 841.89];
/** Each page's box, [width, height] in pt, to 0.01 pt. */
const boxes = (pages) => pages.map((p) => [p.W, p.H].map((n) => Math.round(n * 100) / 100));

/** A localStorage stand-in. */
class MemoryStorage {
  constructor(entries) { this.map = new Map(entries); }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

/** `file` imported through the app's own store (useAppStore's importResume): the résumé it adds. */
async function imported(file) {
  const { useAppStore } = await loadModule('/src/hooks/useResumeStore.js');
  globalThis.localStorage = new MemoryStorage([]);
  let store = null;
  let id = null;
  function Probe() {
    store = useAppStore();
    if (id === null) id = store.importResume(file);
    return null;
  }
  try {
    renderToString(createElement(Probe));
  } finally {
    delete globalThis.localStorage;
  }
  return store.appState.resumes.find((r) => r.id === id);
}

/** The two exports, written out and read back as the import reads the file. */
const EXPORTS = {
  'Backup JSON': async (r) => JSON.parse(JSON.stringify(r, null, 2)),
  'JSON Resume': async (r) => {
    const { cpwtResumeToJsonResume, jsonResumeToCpwtResume } = await loadModule('/src/utils/jsonResume.js');
    return jsonResumeToCpwtResume(JSON.parse(JSON.stringify(cpwtResumeToJsonResume(r), null, 2)));
  },
};

/** Enough entries for a second page, so every page's box is checked. */
const cv = (template, settings) => resume({
  template,
  settings,
  personal: { name: 'Pat Sample', title: 'Engineer', email: 'pat@example.com' },
  sections: [experience(Array.from({ length: 9 }, (_, i) => ({
    company: `Company ${i + 1}`,
    description: `<p>Led the platform rewrite across four teams, moved the nightly batch to streaming events and wrote the runbooks the on-call rota still uses (${i + 1}).</p><ul><li>Designed the event ledger</li><li>Mentored six engineers</li></ul>`,
  })))],
});

describe('the paper survives export → import (R2-136)', () => {
  for (const [name, exported] of Object.entries(EXPORTS)) {
    it(`${name}: a US Letter résumé comes back on Letter and prints Letter pages, on Classic and the Sidebar`, async () => {
      for (const template of ['classic', 'sidebar']) {
        const back = await imported(await exported(cv(template, { pageSize: 'LETTER' })));
        assert.equal(back.settings.pageSize, 'LETTER', `${template}: stored`);
        const pages = await read(await render(back));
        assert.ok(pages.length >= 2, `${template}: ${pages.length} page(s), the test needs a second one`);
        assert.deepEqual(boxes(pages), pages.map(() => LETTER), template);
      }
    });

    it(`${name}: an A4 résumé — none stored — comes back storing none, on A4`, async () => {
      const r = cv('classic', {});
      delete r.settings.pageSize;
      const back = await imported(await exported(r));
      assert.equal('pageSize' in back.settings, false);
      assert.deepEqual(boxes(await read(await render(back))).slice(0, 1), [A4]);
    });
  }
});
