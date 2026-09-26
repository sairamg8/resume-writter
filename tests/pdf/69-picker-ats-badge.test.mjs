// Design → Template: each card's ATS badge is what the ATS Check says of that template, as the
// résumé would print it (R2-011, after TUI-5). The picker was a list built once at module load, from
// atsRating(id) with no settings, so the Sidebar card showed no badge in its Single · ATS-safe Layout
// while the ATS Check tab called the same page an ATS-Certified template.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { setup, teardown, resume, loadModule, TEMPLATES } from './harness.mjs';

before(setup);
after(teardown);

const noop = () => {};

/** The template cards of the Design panel for a résumé on `template` with `settings`: label → has an "ATS" badge. */
async function badges(template, settings = {}) {
  const { default: DesignPanel } = await loadModule('/src/components/DesignPanel.jsx');
  const html = renderToString(createElement(DesignPanel, { resume: resume({ template, settings }), updateSetting: noop, setTemplate: noop, resetSettings: noop }));
  const cards = html.split('<button').slice(1).map((b) => b.split('</button>')[0]);
  const out = {};
  for (const card of cards) {
    const label = /<p class="text-sm font-medium[^"]*">([^<]*)<\/p>/.exec(card)?.[1];
    // The template cards come first; the Contact icons cards further down reuse some names (Classic, Minimal…).
    if (label && !(label in out)) out[label] = />ATS<\/span>/.test(card);
  }
  return out;
}

/** The ATS Check tab's verdict on the template: pass, or warn. */
async function verdict(template, settings) {
  const { analyzeAtsScore } = await loadModule('/src/utils/atsChecker.js');
  const r = resume({ template, settings });
  return analyzeAtsScore(r).categories.layout.items.find((i) => i.id === 'template').status;
}

describe('the template picker\'s ATS badge follows the résumé\'s settings (R2-011)', () => {
  // Since R2-139 A9 each Sidebar Layout is a card of its own, and picking it sets that Layout: each card's
  // badge is the ATS Check's verdict on the page that card prints, whatever Layout the résumé has now.
  const SINGLE = 'Sidebar · Single column';

  it('Sidebar in Single · ATS-safe: its card carries the badge, as the ATS Check calls it ATS-Certified', async () => {
    const settings = { sidebarSingleColumn: true };
    assert.equal(await verdict('sidebar', settings), 'pass', 'the ATS Check passes the single column');
    assert.equal((await badges('sidebar', settings))[SINGLE], true, 'and the single-column card shows the ATS badge');
  });

  it('Sidebar in Two columns: no badge, as the ATS Check warns', async () => {
    const settings = { sidebarSingleColumn: false };
    assert.equal(await verdict('sidebar', settings), 'warn');
    assert.equal((await badges('sidebar', settings)).Sidebar, false);
  });

  it('on another template, each Sidebar card shows what picking it prints: its own Layout, whatever is stored', async () => {
    for (const sidebarSingleColumn of [true, false]) {
      const shown = await badges('classic', { sidebarSingleColumn });
      assert.equal(shown.Sidebar, false, `stored ${sidebarSingleColumn}: the two columns`);
      assert.equal(shown[SINGLE], true, `stored ${sidebarSingleColumn}: the single column`);
    }
  });

  it('every card, in both Layouts, agrees with the ATS Check\'s verdict on the page it prints', async () => {
    const { templateLabel } = await loadModule('/src/constants/templates.js');
    const wrong = [];
    for (const sidebarSingleColumn of [false, true]) {
      const shown = await badges('classic', { sidebarSingleColumn });
      for (const id of TEMPLATES) {
        const pass = (await verdict(id, { sidebarSingleColumn: false })) === 'pass';
        if (shown[templateLabel(id)] !== pass) wrong.push(`${id} (stored single ${sidebarSingleColumn}): badge ${shown[templateLabel(id)]}, ATS Check ${pass ? 'pass' : 'warn'}`);
      }
      const single = (await verdict('sidebar', { sidebarSingleColumn: true })) === 'pass';
      if (shown[SINGLE] !== single) wrong.push(`${SINGLE} (stored single ${sidebarSingleColumn}): badge ${shown[SINGLE]}, ATS Check ${single ? 'pass' : 'warn'}`);
    }
    assert.deepEqual(wrong, []);
  });
});
