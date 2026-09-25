// Design → Spacing → Page size (R2-136): A4 or US Letter, picked in the editor. The PDF, the preview
// and Word honoured settings.pageSize (PAR-01), but no control wrote it, so every résumé printed on
// A4 unless an imported file said otherwise. The row offers both papers with their sizes, the one in
// effect selected — A4 for a résumé that stores none, every résumé saved before the row — and a click
// stores the paper through the store's own updateSetting; the résumé's PDF (= the preview), its cover
// letter and both Word files then print on it, and its dashboard card draws a page of that shape.
// Design → Reset keeps the paper: no template has one.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { setup, teardown, resume, experience, render, renderCover, renderDocx, readDocx, read, loadModule, TEMPLATES } from './harness.mjs';
import { drawing } from './extractors.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

before(setup);
after(teardown);

/** Each paper as the row must name it (written out, not read from PAGE_SIZES), its page box in pt and its Word page in twips. */
const A4 = { text: 'A4 · 210 × 297 mm', box: [595.28, 841.89], twips: [11906, 16838] };
const LETTER = { text: 'US Letter · 8.5 × 11 in', box: [612, 792], twips: [12240, 15840] };

/** A localStorage stand-in. */
class MemoryStorage {
  constructor(entries) { this.map = new Map(entries); }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

/**
 * The Design panel for `r`, as the editor mounts it, with Spacing opened: `options` (each Page size
 * button's text and whether it shows selected — SegmentControl marks the chosen one bg-blue-600),
 * `click(text)` (the [key, value] writes that button makes) and `unmount`.
 */
async function pageSizeRow(r) {
  const { default: DesignPanel } = await loadModule('/src/components/DesignPanel.jsx');
  const writes = [];
  const view = mount(DesignPanel, { resume: r, updateSetting: (key, value) => writes.push([key, value]), setTemplate: () => {}, resetSettings: () => {} });
  const all = () => [...elements(view.container)];
  const heading = all().find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === 'Spacing');
  assert.ok(heading, 'the Spacing section');
  view.act(() => reactProps(heading).onClick());
  const label = all().find((el) => el.tagName === 'P' && el.textContent.trim() === 'Page size');
  assert.ok(label, 'a "Page size" row in Design → Spacing');
  const group = all().find((el) => el.getAttribute('aria-labelledby') === label.getAttribute('id'));
  assert.ok(group, 'the row\'s choices are grouped under its label');
  const buttons = () => [...elements(group)].filter((el) => el.tagName === 'BUTTON');
  return {
    options: buttons().map((el) => ({ text: el.textContent.trim(), selected: el.className.includes('bg-blue-600') })),
    click(text) {
      const button = buttons().find((el) => el.textContent.trim() === text);
      assert.ok(button, `the "${text}" button`);
      writes.length = 0;
      view.act(() => reactProps(button).onClick());
      return [...writes];
    },
    unmount: () => view.unmount(),
  };
}

/** `r` after the store's own `action` (useAppStore, as the editor's store applies it): the résumé it stores. */
async function throughStore(r, action) {
  const { useAppStore } = await loadModule('/src/hooks/useResumeStore.js');
  globalThis.localStorage = new MemoryStorage([['cpwtcv_v1', JSON.stringify({ resumes: [r], activeId: r.id })]]);
  let store = null;
  let done = false;
  function Probe() {
    store = useAppStore();
    if (!done) {
      done = true;
      action(store);
    }
    return null;
  }
  try {
    renderToString(createElement(Probe));
  } finally {
    delete globalThis.localStorage;
  }
  return store.appState.resumes[0];
}

/** Each page's box, [width, height] in pt, to 0.01 pt. */
const boxes = (pages) => pages.map((p) => [p.W, p.H].map((n) => Math.round(n * 100) / 100));

/** The .docx's page size, [w, h] in twips, as its <w:pgSz> writes it. */
const wordPage = (xml) => ['w', 'h'].map((k) => Number((xml.match(new RegExp(`<w:pgSz [^>]*w:${k}="(\\d+)"`)) || [])[1]));

const letterDocx = async (r) => {
  const { renderCoverLetterDocx } = await loadModule('/src/utils/wordExport.js');
  return readDocx(new Uint8Array(await (await renderCoverLetterDocx(r)).arrayBuffer()));
};

const cv = (template, settings = {}) => resume({
  template,
  settings,
  personal: { name: 'Pat Sample', title: 'Engineer', email: 'pat@example.com', phone: '+1 555 0100' },
  sections: [experience([{ description: '<p>Built the thing that shipped.</p>' }])],
  coverLetter: { body: '<p>I would like to apply.</p>' },
});

describe('Design → Spacing → Page size (R2-136)', () => {
  it('the row offers A4 and US Letter with their sizes; A4 shows selected for a résumé that stores none, "A4" or a size not offered', async () => {
    for (const settings of [{}, { pageSize: 'A4' }, { pageSize: 'Legal' }]) {
      const r = cv('classic', settings);
      if (!('pageSize' in settings)) delete r.settings.pageSize;
      const row = await pageSizeRow(r);
      try {
        assert.deepEqual(row.options, [{ text: A4.text, selected: true }, { text: LETTER.text, selected: false }], JSON.stringify(settings));
      } finally { await row.unmount(); }
    }
  });

  it('US Letter shows selected for a résumé on Letter, stored in any case', async () => {
    for (const pageSize of ['LETTER', 'letter']) {
      const row = await pageSizeRow(cv('classic', { pageSize }));
      try {
        assert.deepEqual(row.options, [{ text: A4.text, selected: false }, { text: LETTER.text, selected: true }], pageSize);
      } finally { await row.unmount(); }
    }
  });

  it('the repro: a click on US Letter stores it through the store — the résumé, its letter and both Word files print on Letter, on every template', async () => {
    for (const template of TEMPLATES) {
      const r = cv(template);
      delete r.settings.pageSize;
      const row = await pageSizeRow(r);
      let writes;
      try { writes = row.click(LETTER.text); } finally { await row.unmount(); }
      assert.deepEqual(writes, [['pageSize', 'LETTER']], `${template}: the write`);
      const stored = await throughStore(r, (store) => { for (const [k, v] of writes) store.updateSetting(k, v); });
      assert.equal(stored.settings.pageSize, 'LETTER', `${template}: stored`);
      const pages = await read(await render(stored));
      assert.deepEqual(boxes(pages), pages.map(() => LETTER.box), `${template}: the résumé's pages`);
      const letterPages = await read(await renderCover(stored));
      assert.deepEqual(boxes(letterPages), letterPages.map(() => LETTER.box), `${template}: the letter's pages`);
      assert.deepEqual(wordPage((await renderDocx(stored)).xml), LETTER.twips, `${template}: the résumé's .docx`);
      assert.deepEqual(wordPage((await letterDocx(stored)).xml), LETTER.twips, `${template}: the letter's .docx`);
    }
  });

  it('and back: A4 on a Letter résumé prints the A4 page, drawn as a résumé that never stored a size', async () => {
    const r = cv('classic', { pageSize: 'LETTER' });
    const row = await pageSizeRow(r);
    let writes;
    try { writes = row.click(A4.text); } finally { await row.unmount(); }
    assert.deepEqual(writes, [['pageSize', 'A4']]);
    const stored = await throughStore(r, (store) => { for (const [k, v] of writes) store.updateSetting(k, v); });
    const bare = cv('classic');
    delete bare.settings.pageSize;
    const never = await throughStore(bare, () => {});
    assert.deepEqual(boxes(await read(await render(stored))), [A4.box]);
    assert.equal(await drawing(await render(stored)), await drawing(await render({ ...never, id: stored.id })));
    assert.deepEqual(wordPage((await renderDocx(stored)).xml), A4.twips);
  });

  it('the dashboard card draws the page in the paper\'s shape: A4 as before, Letter shorter', async () => {
    const { default: ResumeThumbnail } = await loadModule('/src/components/ResumeThumbnail.jsx');
    const thumb = (settings) => renderToString(createElement(ResumeThumbnail, { resume: { id: 'r1', template: 'classic', settings, personal: {} }, accent: '#374151' }));
    /** The page box's height class ('h-28' is 112 px on 80: A4's 1.41; 104 px is Letter's 11 / 8.5). */
    const height = (html) => (/data-thumb="classic" class="[^"]*?\b(h-[^\s"]+)/.exec(html) || [])[1];
    assert.equal(height(thumb({})), 'h-28', 'none stored: A4, as every card drew it');
    assert.equal(thumb({ pageSize: 'A4' }), thumb({}));
    assert.equal(thumb({ pageSize: 'Legal' }), thumb({}));
    assert.equal(height(thumb({ pageSize: 'LETTER' })), 'h-[104px]');
    assert.equal(thumb({ pageSize: 'letter' }), thumb({ pageSize: 'LETTER' }));
  });

  it('Design → Reset Design Settings keeps the paper; A4 stays stored as none', async () => {
    const letter = await throughStore(cv('modern', { pageSize: 'LETTER', accentColor: '#e11d48' }), (store) => store.resetSettings());
    assert.equal(letter.settings.pageSize, 'LETTER', 'Letter kept');
    assert.notEqual(letter.settings.accentColor, '#e11d48', 'the rest is reset');
    assert.deepEqual(boxes(await read(await render(letter))), [LETTER.box]);
    for (const pageSize of [undefined, 'A4', 'Legal']) {
      const r = cv('classic', { pageSize });
      if (pageSize === undefined) delete r.settings.pageSize;
      const reset = await throughStore(r, (store) => store.resetSettings());
      assert.equal('pageSize' in reset.settings, false, `${pageSize}: nothing stored`);
    }
  });
});
