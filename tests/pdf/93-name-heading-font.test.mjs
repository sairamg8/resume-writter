// R2-146: Design → Typography → Name Font and Heading Font. The name (every template's header and the
// cover letter's letterhead) and the section titles (the main column's, the Sidebar's About Me and its
// side-column titles) can each print in a font of their own — a picker font or a custom Google Font —
// while the rest keeps Font Family's. Unset ('' or missing), everything prints in Font Family's as
// before. One that cannot be loaded prints in Noto Sans and is named in the font-fallback notice, as
// Font Family's is. Word names the same fonts on the name's and the titles' runs. The panel offers
// both, and removing a custom font takes it off them too.
// Fonts come from a stand-in CDN: "Testface Grotesk" is drawn with pdf.js's Liberation Sans, so the
// PDF names the face it printed in; every other web font is offline.
import { before, after, afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setup, teardown, loadModule, resume, section, experience, render, renderCover, read, allItems, renderDocx } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FACE = {
  400: readFileSync(path.join(ROOT, 'node_modules/pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf')),
  700: readFileSync(path.join(ROOT, 'node_modules/pdfjs-dist/standard_fonts/LiberationSans-Bold.ttf')),
};
const realFetch = globalThis.fetch;

/** The CDN: Testface Grotesk's metadata and faces; every other font on it is offline. */
function network() {
  globalThis.fetch = async (url, opts) => {
    const u = String(url);
    if (!u.includes('cdn.jsdelivr.net')) return realFetch(url, opts);
    const pkg = u.match(/@fontsource\/([^@/]+)@/)?.[1];
    if (pkg !== 'testface-grotesk') throw new TypeError('fetch failed');
    if (u.endsWith('/metadata.json')) {
      return new Response(JSON.stringify({ family: 'Testface Grotesk', weights: [400, 700], styles: ['normal'], subsets: ['latin'] }), { status: 200 });
    }
    return new Response(FACE[u.includes('-700-') ? 700 : 400], { status: 200 });
  };
}

before(async () => { await setup(); network(); });
afterEach(() => network());
after(async () => { globalThis.fetch = realFetch; await teardown(); });

const OWN = 'Testface Grotesk';
const NAME = 'Robin Quill';
// The embedded font's PostScript name, past its subset tag ("OFKXGM+NotoSans-Bold").
const face = (t) => (t?.font || '').replace(/^[A-Z]{6}\+/, '');
const isOwn = (t) => face(t).startsWith('LiberationSans');
const isNoto = (t) => face(t).startsWith('NotoSans');
const find = (items, re) => items.find((t) => re.test(t.str.trim()));
const withSections = (template, settings, extra = {}) => resume({
  template,
  settings,
  personal: { name: NAME, summary: '<p>Builds tools.</p>', email: 'robin@example.com', ...extra },
  sections: [
    experience([{ company: 'Northwind Labs', role: 'Staff Engineer', description: '<p>Built the checkout flow.</p>' }]),
    section('languages', [{ language: 'Telugu', proficiency: 'Native' }], {}, { title: 'Languages' }),
  ],
});
const itemsOf = async (r) => allItems(await read(await render(r)));

describe('Name Font prints the name in its own font on every template (R2-146)', () => {
  it('unset, the name prints in Font Family\'s, as before', async () => {
    for (const settings of [{}, { nameFont: '', headingFont: '' }]) {
      const items = await itemsOf(withSections('classic', settings));
      assert.ok(isNoto(find(items, /Robin/)), `name in ${find(items, /Robin/)?.font}`);
      assert.ok(items.every(isNoto), `every run in Noto Sans: ${[...new Set(items.map((t) => t.font))]}`);
    }
  });

  it('set, the name — and only the name — prints in it', async () => {
    const { TEMPLATE_IDS } = await loadModule('/src/constants/templates.js');
    for (const template of TEMPLATE_IDS) {
      const items = await itemsOf(withSections(template, { nameFont: OWN }));
      const name = find(items, /Robin/);
      assert.ok(isOwn(name), `${template}: the name prints in ${name?.font}`);
      assert.ok(isNoto(find(items, /Built the checkout/)), `${template}: body text in ${find(items, /Built the checkout/)?.font}`);
      assert.ok(isNoto(find(items, /^PROFESSIONAL EXPERIENCE$|^EXPERIENCE$/i)), `${template}: the title stays in Font Family's`);
    }
  });

  it('the cover letter\'s letterhead prints the name in it too', async () => {
    const items = allItems(await read(await renderCover(withSections('classic', { nameFont: OWN }))));
    assert.ok(isOwn(find(items, /^Robin Quill$/)), `letterhead name in ${find(items, /^Robin Quill$/)?.font}`);
  });
});

describe('Heading Font prints the section titles in their own font (R2-146)', () => {
  it('the main column\'s titles, and nothing else', async () => {
    const items = await itemsOf(withSections('classic', { headingFont: OWN }));
    assert.ok(isOwn(find(items, /^PROFESSIONAL EXPERIENCE$/)), `Experience title in ${find(items, /^PROFESSIONAL EXPERIENCE$/)?.font}`);
    assert.ok(isOwn(find(items, /^LANGUAGES$/)), 'Languages title');
    assert.ok(isNoto(find(items, /Robin/)), 'the name keeps Font Family\'s');
    assert.ok(isNoto(find(items, /Built the checkout/)), 'body text keeps Font Family\'s');
  });

  it('on the Sidebar: About Me, the main column\'s and the side column\'s titles', async () => {
    const items = await itemsOf(withSections('sidebar', { headingFont: OWN }));
    for (const re of [/^ABOUT ME$/, /^PROFESSIONAL EXPERIENCE$|^EXPERIENCE$/, /^LANGUAGES$/, /^CONTACT$/]) {
      assert.ok(isOwn(find(items, re)), `${re}: ${find(items, re)?.font}`);
    }
  });
});

describe('a Name or Heading Font that cannot be loaded (R2-146)', () => {
  it('prints in Noto Sans, and the fallback names it with Font Family\'s', async () => {
    const loader = await loadModule('/src/templates/pdf/shared/pdfFontLoader.js');
    const store = await loadModule('/src/utils/fontFallback.js');
    const got = await loader.resolvePdfFonts({ font: 'notosans', nameFont: 'inter', headingFont: OWN }, 'Robin');
    assert.equal(got.fallback, 'Inter', 'the picker\'s label');
    assert.equal(store.fontFallback(), 'Inter');
    assert.equal([].concat(got.nameFontFamily)[0], 'NotoSans');
    assert.equal([].concat(got.headingFontFamily)[0], OWN);
    const both = await loader.resolvePdfFonts({ font: 'lato', nameFont: 'inter' }, 'Robin');
    assert.equal(both.fallback, 'Lato and Inter');
    const none = await loader.resolvePdfFonts({ font: 'notosans' }, 'Robin');
    assert.equal(none.fallback, null);
    assert.equal(none.nameFontFamily, null, 'unset: no family of its own');
    assert.equal(none.headingFontFamily, null);
  });
});

describe('Word names the same fonts (R2-146)', () => {
  const runFont = (docx, re) => {
    const p = docx.paragraphs.find((x) => re.test(x.text.trim()));
    assert.ok(p, `Word prints ${re}`);
    const run = p.xml.split('</w:r>').find((r) => re.test((r.match(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/) || [])[1]?.trim() || ''));
    return (run?.match(/<w:rFonts w:ascii="([^"]*)"/) || [])[1] ?? null;
  };

  it('unset: the name and the titles name no font of their own, as before', async () => {
    const docx = await renderDocx(withSections('classic', {}));
    assert.equal(runFont(docx, /^Robin Quill/), null);
    assert.equal(runFont(docx, /^PROFESSIONAL EXPERIENCE$/), null);
  });

  it('set: the name\'s run and every title\'s run carry the font, by the picker\'s label or as typed', async () => {
    const docx = await renderDocx(withSections('classic', { nameFont: 'ptserif', headingFont: OWN }));
    assert.equal(runFont(docx, /^Robin Quill/), 'PT Serif');
    assert.equal(runFont(docx, /^PROFESSIONAL EXPERIENCE$/), OWN);
    assert.equal(runFont(docx, /^LANGUAGES$/), OWN);
    assert.equal(runFont(docx, /Built the checkout/), null, 'body text keeps the document font');
    const side = await renderDocx(withSections('sidebar', { headingFont: 'georgia' }));
    assert.equal(runFont(side, /^LANGUAGES$/), 'Georgia', 'the Sidebar\'s side-column title');
  });
});

describe('the panel offers both (R2-146)', () => {
  it('Name Font and Heading Font list "Same as text", the picker and the custom fonts, and write what is picked', async () => {
    const saved = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', { value: { getItem: () => JSON.stringify([OWN]), setItem() {}, removeItem() {} }, configurable: true, writable: true });
    try {
      const { TypographySection } = await loadModule('/src/components/DesignPanelTypography.jsx');
      const writes = [];
      const settings = { nameFont: OWN, headingFont: '' };
      const view = mount(TypographySection, { settings, template: 'classic', updateSetting: (k, v) => writes.push([k, v]), onReset: () => {} });
      try {
        const open = [...elements(view.container)].find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === 'Typography');
        view.act(() => reactProps(open).onClick());
        const selects = [...elements(view.container)].filter((el) => el.tagName === 'SELECT');
        const byLabel = (label) => {
          const l = [...elements(view.container)].find((el) => el.tagName === 'LABEL' && el.textContent.trim() === label);
          assert.ok(l, `${label} is offered`);
          return selects.find((s) => s.getAttribute('id') === l.getAttribute('for'));
        };
        const [name, heading] = [byLabel('Name Font'), byLabel('Heading Font')];
        const values = [...name.options].map((o) => o.getAttribute('value'));
        assert.equal(values[0], '', '"Same as text" first');
        assert.ok(values.includes('inter') && values.includes('georgia') && values.includes(OWN), values.join(','));
        view.act(() => reactProps(heading).onChange({ target: { value: 'literata' } }));
        assert.deepEqual(writes.pop(), ['headingFont', 'literata']);
        // Removing the custom font takes it off Name Font too.
        const remove = [...elements(view.container)].find((el) => el.getAttribute('aria-label') === `Remove ${OWN}`);
        view.act(() => reactProps(remove).onClick());
        assert.ok(writes.some(([k, v]) => k === 'nameFont' && v === ''), JSON.stringify(writes));
      } finally {
        view.unmount();
      }
    } finally {
      if (saved) Object.defineProperty(globalThis, 'localStorage', saved);
      else delete globalThis.localStorage;
    }
  });
});
