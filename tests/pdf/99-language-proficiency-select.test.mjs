// R4-ED-01: a language's Proficiency select shows exactly what the résumé prints. The Compact starter
// stores 'Conversational', and an import keeps the file's words ('C1', 'Advanced') or none (''). The
// select had five options and `value={item.proficiency || 'Professional'}`: with no option of the
// stored value the browser showed the first ('Native') while the PDF and every export printed
// 'Conversational', and an unset level showed 'Professional' while nothing printed. Picking the option
// already on screen fires no change, so that level could not be chosen. Now an unset level is its own
// option ('Not set'), an unusual one is added to the list, and the stored value is the one selected.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { setup, teardown, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const FIVE = ['Native', 'Fluent', 'Professional', 'Intermediate', 'Basic'];
const leaf = () => loadModule('/src/components/SectionEditorLeafItems.jsx');
const item = (proficiency) => ({ id: 'lang_1', language: 'Spanish', proficiency });

/** The Proficiency select's options as rendered: [{ value, label, selected }]. */
async function options(proficiency) {
  const { LanguageItem } = await leaf();
  const html = renderToStaticMarkup(createElement(LanguageItem, { item: item(proficiency), onUpdate() {}, onRemove() {} }));
  const select = /<select[^>]*aria-label="Proficiency"[^>]*>([\s\S]*?)<\/select>/.exec(html);
  assert.ok(select, 'the Proficiency select is on the page');
  return [...select[1].matchAll(/<option([^>]*)>([^<]*)<\/option>/g)].map(([, attrs, label]) => ({
    value: /value="([^"]*)"/.exec(attrs)?.[1],
    label,
    selected: /\sselected(=|\s|$)/.test(attrs),
  }));
}

const selectedValues = (opts) => opts.filter((o) => o.selected).map((o) => o.value);

/** The <select> element LanguageItem returns (a plain function of its props: no hooks). */
function findSelect(node) {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const n of node) { const found = findSelect(n); if (found) return found; }
    return null;
  }
  if (node.type === 'select') return node;
  return findSelect(node.props?.children);
}

describe('the Proficiency select shows the stored level, and every listed level can be picked', () => {
  it('a level the list does not name (the Compact starter\'s \'Conversational\', an import\'s \'C1\') is selected as its own option', async () => {
    for (const stored of ['Conversational', 'C1', 'Advanced']) {
      const opts = await options(stored);
      assert.deepEqual(selectedValues(opts), [stored], stored);
      assert.equal(opts.filter((o) => o.value === stored).length, 1, `${stored} is listed once`);
      assert.equal(opts.find((o) => o.value === stored).label, stored);
      for (const p of FIVE) assert.ok(opts.some((o) => o.value === p), `${p} is still offered`);
    }
  });

  it('an unset level (\'\', or none stored) shows as not set, not as a level nothing prints', async () => {
    for (const stored of ['', undefined, null]) {
      const opts = await options(stored);
      assert.deepEqual(selectedValues(opts), [''], String(stored));
      assert.equal(opts[0].value, '');
      assert.equal(opts[0].label, 'Not set');
      assert.equal(opts.filter((o) => !FIVE.includes(o.value)).length, 1, 'no extra option for an unset level');
    }
  });

  it('one of the five is selected as itself, with no extra option', async () => {
    for (const stored of FIVE) {
      const opts = await options(stored);
      assert.deepEqual(selectedValues(opts), [stored], stored);
      assert.deepEqual(opts.map((o) => o.value), ['', ...FIVE]);
    }
  });

  it('picking Native over \'Conversational\', or Professional over an unset level, is a change that saves', async () => {
    const { LanguageItem } = await leaf();
    for (const [stored, pick] of [['Conversational', 'Native'], ['', 'Professional']]) {
      // The level picked is not the one on screen, so the browser fires a change for it.
      assert.equal(selectedValues(await options(stored)).includes(pick), false, `${pick} is not already shown for '${stored}'`);
      const updates = [];
      const select = findSelect(LanguageItem({ item: item(stored), onUpdate: (u) => updates.push(u), onRemove() {} }));
      assert.ok(select, 'the select is rendered');
      assert.equal(select.props.value, stored);
      select.props.onChange({ target: { value: pick } });
      assert.deepEqual(updates, [{ ...item(stored), proficiency: pick }]);
    }
  });
});
