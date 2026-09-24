// Design → Spacing's five numbers — Line Height, Top / Bottom and Left / Right margin, Between
// Sections, Between Items — as an imported .json, a hand-edited store or a cloud copy can carry
// them: anything. The panel only ever writes numbers. A stored value that is not one crashed the
// whole editor as the Spacing section opened (NumberRow called toFixed on it: a Left / Right margin
// of "abc", a Line Height of "1.8"), or showed "truemm"; the PDF (= the preview) printed it broken —
// a margin of "abc" put the text at the paper's edge, a Between Items of "abc" made the Sidebar's
// render throw. normalizeResume (withSpacingNumbers, src/constants/spacingNumbers.js) stores each
// as a number or drops it, so the default prints and the panel shows it (VF2-3.2-NB1-NB1).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Component, createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { setup, teardown, resume, section, render, renderCover, read, allItems, loadModule, TEMPLATES } from './harness.mjs';
import { drawing } from './extractors.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

before(setup);
after(teardown);

/** Each Spacing number: its row in the Design panel, what the row shows and the PDF prints when none is stored. */
const SPACING = {
  lineHeightValue: { label: 'Line Height', number: 1.5, shown: '1.5' },
  marginV: { label: 'Top / Bottom margin', number: 14, shown: '14mm' },
  marginH: { label: 'Left / Right margin', number: 18, shown: '18mm' },
  sectionGap: { label: 'Between Sections', number: 16, shown: '16px' },
  itemGap: { label: 'Between Items', number: 8, shown: '8px' },
};
const KEYS = Object.keys(SPACING);
/** Values JSON (an import, the store, a cloud copy) can carry that are not a number. */
const NOT_NUMBERS = ['abc', '', ' ', true, false, {}, [], 'Infinity', '12px'];

const PERSONAL = { name: 'Pat Lee', title: 'Engineer', email: 'pat.lee@example.com', phone: '+1 555 0100' };
const normalizer = () => loadModule('/src/utils/normalizeResume.js');

/** `r` as the import (or the sync) hands it over: this build's file, or one no data version stamped. */
const asFile = (r, { old = false } = {}) => {
  const out = { ...r, updatedAt: 5 };
  if (old) delete out.dataVersion;
  return out;
};

/** A résumé on `template` storing `settings`, with a column of each kind so every gap prints. */
const withSpacing = (template, settings) => resume({
  template,
  settings,
  personal: PERSONAL,
  sections: [
    section('skills', [{ name: 'JavaScript' }, { name: 'TypeScript' }]),
    section('experience', [{ position: 'Engineer', company: 'Acme', description: '<p>Built the thing that shipped.</p><p>Then another.</p>' }, { position: 'Intern', company: 'Beta' }]),
  ],
});

/** Renders its child, or the error that child threw: the app has no boundary, so that error blanks the editor. */
class Crash extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch() {}
  render() { return this.state.error ? createElement('p', { 'data-crash': '' }, `crashed: ${this.state.error.message}`) : this.props.children; }
}

/**
 * The Design panel for `r`, as the editor mounts it, with its Spacing section opened: `crash` (the
 * error it threw, or null), `rows` (each Spacing row's label → the text its input shows), `step(label,
 * '+' | '−')` (clicks the row's button: the [key, value] it set) and `unmount`.
 */
async function spacingPanel(r) {
  const { default: DesignPanel } = await loadModule('/src/components/DesignPanel.jsx');
  const set = [];
  const Panel = (props) => createElement(Crash, null, createElement(DesignPanel, props));
  const view = mount(Panel, { resume: r, updateSetting: (key, value) => set.push([key, value]), setTemplate: () => {}, resetSettings: () => {} });
  const all = () => [...elements(view.container)];
  const heading = all().find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === 'Spacing');
  view.act(() => reactProps(heading).onClick());
  const crashed = all().find((el) => el.getAttribute('data-crash') !== null);
  const labels = new Map(all().filter((el) => el.getAttribute('id')).map((el) => [el.getAttribute('id'), el.textContent]));
  const inputs = new Map(all().filter((el) => el.tagName === 'INPUT').map((el) => [labels.get(el.getAttribute('aria-labelledby')), el]));
  return {
    crash: crashed ? crashed.textContent : null,
    rows: Object.fromEntries([...inputs].map(([label, el]) => [label, el.value])),
    step(label, sign) {
      const [minus, , plus] = inputs.get(label).parentNode.childNodes;
      set.length = 0;
      view.act(() => reactProps(sign === '+' ? plus : minus).onClick());
      return set[0];
    },
    unmount: () => view.unmount(),
  };
}

describe('a Design → Spacing number stored as something that is not a number (VF2-3.2-NB1-NB1)', () => {
  it('the Design panel opens Spacing and shows the default that prints, for every row, this build\'s file or an old one', async () => {
    const { normalizeResume } = await normalizer();
    for (const key of KEYS) {
      for (const stored of NOT_NUMBERS) {
        for (const old of [false, true]) {
          const at = `${key} ${JSON.stringify(stored)}, ${old ? 'no data version' : 'this build\'s file'}`;
          const r = normalizeResume(asFile(resume({ settings: { [key]: stored } }), { old }));
          const panel = await spacingPanel(r);
          try {
            assert.equal(panel.crash, null, `${at}: the editor crashed`);
            const expected = Object.fromEntries(KEYS.map((k) => [SPACING[k].label, SPACING[k].shown]));
            assert.deepEqual(panel.rows, expected, at);
            assert.ok(r.settings[key] === undefined || r.settings[key] === SPACING[key].number, `${at}: stored ${JSON.stringify(r.settings[key])}`);
            assert.equal(r.updatedAt, 5, `${at}: not an edit`);
          } finally { await panel.unmount(); }
        }
      }
    }
  });

  it('a number stored as text is that number: the panel shows it and − / + step from it', async () => {
    const { normalizeResume } = await normalizer();
    const cases = [
      ['lineHeightValue', '1.8', 1.8, '1.8', [1.7, 1.9]],
      ['marginV', ' 20 ', 20, '20mm', [19, 21]],
      ['sectionGap', '20', 20, '20px', [19, 21]],
      ['itemGap', '12.0', 12, '12px', [11, 13]],
    ];
    for (const [key, stored, number, shown, [down, up]] of cases) {
      const r = normalizeResume(asFile(resume({ settings: { [key]: stored } })));
      assert.equal(r.settings[key], number, `${key} ${JSON.stringify(stored)}: stored as the number`);
      const panel = await spacingPanel(r);
      try {
        assert.equal(panel.crash, null, `${key} ${JSON.stringify(stored)}: the editor crashed`);
        assert.equal(panel.rows[SPACING[key].label], shown, key);
        const [minusKey, minus] = panel.step(SPACING[key].label, '−');
        const [plusKey, plus] = panel.step(SPACING[key].label, '+');
        assert.deepEqual([minusKey, plusKey], [key, key]);
        assert.ok(Math.abs(minus - down) < 1e-9 && Math.abs(plus - up) < 1e-9, `${key}: − set ${minus}, + set ${plus}`);
      } finally { await panel.unmount(); }
    }
  });

  it('NumberRow never throws on a value that is not a number: it shows its smallest, where − / + step from', async () => {
    const { NumberRow } = await loadModule('/src/components/DesignPanelShared.jsx');
    for (const value of ['abc', '1.8', true, {}, NaN, undefined]) {
      const html = renderToString(createElement(NumberRow, { label: 'Left / Right margin', value, onChange: () => {}, min: 0, max: 40, step: 1, unit: 'mm' }));
      assert.match(html, /value="0mm"/, JSON.stringify(value));
      const line = renderToString(createElement(NumberRow, { label: 'Line Height', value, onChange: () => {}, min: 1, max: 3, step: 0.1 }));
      assert.match(line, /value="1.0"/, JSON.stringify(value));
    }
  });

  it('every template prints it as its default, the Sidebar\'s render included; so does the letter', async () => {
    const { normalizeResume } = await normalizer();
    for (const template of TEMPLATES) {
      const asDefault = normalizeResume(asFile(withSpacing(template, {})));
      const resumeDefault = await drawing(await render(asDefault));
      const letterDefault = await drawing(await renderCover(asDefault));
      for (const key of KEYS) {
        // A template that brings its own Spacing (Academic's denser one, T8): a dropped value prints the
        // app's default, the number the panel then shows — not the template's.
        const own = asDefault.settings[key] === SPACING[key].number ? null : normalizeResume(asFile(withSpacing(template, { [key]: SPACING[key].number })));
        const want = own ? { resume: await drawing(await render(own)), letter: await drawing(await renderCover(own)) } : { resume: resumeDefault, letter: letterDefault };
        for (const stored of ['abc', {}]) {
          const at = `${template}, ${key} ${JSON.stringify(stored)}`;
          const r = normalizeResume(asFile(withSpacing(template, { [key]: stored })));
          const bytes = await render(r);
          const minX = Math.min(...allItems(await read(bytes)).map((t) => t.x));
          assert.ok(minX > 40, `${at}: text at x ${minX.toFixed(1)}`);
          assert.ok(await drawing(bytes) === want.resume, `${at}: the résumé prints as with ${SPACING[key].number}`);
          assert.ok(await drawing(await renderCover(r)) === want.letter, `${at}: the letter prints as with ${SPACING[key].number}`);
        }
      }
    }
  });

  it('Import JSON and the cloud sync\'s merge store none of it', async () => {
    const settings = { lineHeightValue: 'abc', marginV: true, marginH: {}, sectionGap: '', itemGap: '9' };
    const file = asFile(withSpacing('sidebar', settings));
    const { useAppStore } = await loadModule('/src/hooks/useResumeStore.js');
    const map = new Map();
    globalThis.localStorage = {
      get length() { return map.size; }, key: (i) => [...map.keys()][i] ?? null,
      getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k),
    };
    let stored = null;
    try {
      let store = null;
      let id = null;
      function Probe() {
        store = useAppStore();
        if (id === null) id = store.importResume(JSON.parse(JSON.stringify(file)));
        return null;
      }
      renderToString(createElement(Probe));
      stored = store.appState.resumes.find((r) => r.id === id);
    } finally {
      delete globalThis.localStorage;
    }
    const spacing = (s) => KEYS.map((k) => s[k]);
    assert.deepEqual(spacing(stored.settings), [undefined, undefined, undefined, undefined, 9], 'Import JSON');
    const { mergeResumeLists } = await loadModule('/src/utils/syncMerge.js');
    const [merged] = mergeResumeLists([], [file], new Set());
    assert.deepEqual(spacing(merged.settings), [undefined, undefined, undefined, undefined, 9], 'the cloud copy');
    assert.ok(KEYS.slice(0, 4).every((k) => !(k in merged.settings)), 'dropped, not stored as undefined (Firestore refuses one)');
  });

  // Guards: only a value that is not a number changes; the fix is the tests above.
  it('keeps every number and a résumé that stores none', async () => {
    const { normalizeResume } = await normalizer();
    for (const settings of [{ lineHeightValue: 1.8, marginV: 0, marginH: 40, sectionGap: 0, itemGap: 24 }, { lineHeightValue: 3, sectionGap: 60, itemGap: 0 }]) {
      const current = resume({ template: 'sidebar', settings });
      assert.equal(normalizeResume(current), current, `${JSON.stringify(settings)}: the same object`);
    }
    const none = resume();
    for (const key of KEYS) delete none.settings[key];
    none.settings.lineHeightValue = null;
    assert.equal(normalizeResume(none), none, 'none stored (or null): the same object, printing the defaults');
  });
});
