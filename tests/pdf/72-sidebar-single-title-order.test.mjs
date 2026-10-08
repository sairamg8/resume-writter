// Sidebar's "Single · ATS-safe" Layout printed an experience entry in two orders (R2-012): the PDF and
// the live preview led with the role (the Sidebar's own section default, TEMPLATE_SECTION_DEFAULTS),
// while Word and Section Options → Order resolved the section as Classic's (AUD-17 switched both to
// Classic for the header and the side-column sections) and led with the company. A section's own
// defaults now come from the résumé's template in every mode; only the page (header, one column) is
// Classic's. So the Layout switch changes the geometry, never which field leads an entry.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { setup, teardown, resume, experience, render, renderDocx, read, allText, loadModule, TEMPLATES } from './harness.mjs';

before(setup);
after(teardown);

const ENTRY = [{ company: 'Acme Corp', role: 'Staff Engineer' }];
const order = (text) => (text.indexOf('Staff Engineer') < text.indexOf('Acme Corp') ? 'role' : 'company');

/** Which field leads the entry in the PDF (= the preview), in Word, and on the Order control. */
async function leads(template, settings, sectionSettings = {}) {
  const r = resume({ template, settings, sections: [experience(ENTRY, sectionSettings)] });
  const pdf = order(allText(await read(await render(r))));
  const word = order((await renderDocx(r)).texts.find((t) => t.includes('Acme Corp')));
  const { SectionCustomizer } = await loadModule('/src/components/SectionEditorCustomizer.jsx');
  const html = renderToString(createElement(SectionCustomizer, {
    section: r.sections[0], template: r.template, settings: r.settings, updateSectionSettings: () => {},
  }));
  // SegmentRow marks the chosen option bg-blue-600; the Order row's options are "Co. / Role" and "Role / Co.".
  const chosen = [...html.matchAll(/<button[^>]*class="([^"]*)"[^>]*>(Co\. \/ Role|Role \/ Co\.)<\/button>/g)]
    .filter(([, cls]) => cls.includes('bg-blue-600')).map(([, , label]) => label);
  assert.equal(chosen.length, 1, `${template}: exactly one Order option is highlighted (${chosen})`);
  const editor = chosen[0] === 'Role / Co.' ? 'role' : 'company';
  return { pdf, word, editor };
}

describe('Sidebar Single · ATS-safe: an entry leads with the same field in the PDF, Word and Section Options (R2-012)', () => {
  it('unset Order: the Sidebar default (role first) in all three', async () => {
    assert.deepEqual(await leads('sidebar', { sidebarSingleColumn: true }), { pdf: 'role', word: 'role', editor: 'role' });
  });

  it('a chosen Order prints as chosen in all three', async () => {
    for (const titleOrder of ['company', 'role']) {
      const want = { pdf: titleOrder, word: titleOrder, editor: titleOrder };
      assert.deepEqual(await leads('sidebar', { sidebarSingleColumn: true }, { titleOrder }), want, titleOrder);
    }
  });

  it('switching Layout between Two-column and Single does not reorder an entry', async () => {
    const two = await leads('sidebar', { sidebarSingleColumn: false });
    const one = await leads('sidebar', { sidebarSingleColumn: true });
    assert.deepEqual(one, two);
  });

  it('every template: the three agree with the Single flag set (it is Sidebar-only and changes nothing elsewhere)', async () => {
    const wrong = [];
    for (const template of TEMPLATES) {
      const got = await leads(template, { sidebarSingleColumn: true });
      if (new Set(Object.values(got)).size !== 1) wrong.push(`${template}: ${JSON.stringify(got)}`);
    }
    assert.deepEqual(wrong, []);
  });
});
