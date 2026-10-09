// PROBE: what a public link leaks of what the owner hid.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule, render, read, allText, renderDocx, TEMPLATES } from './harness.mjs';

before(setup);
after(teardown);

describe('probe 11', () => {
  it('exports leak', async () => {
    const pub = await loadModule('/src/utils/publicLink.js');
    const { SECTION_TYPE_DEFAULTS } = await loadModule('/src/utils/defaultDataSectionTypes.js');
    const { CONTACT_KEYS } = await loadModule('/src/utils/contacts.js');
    const leaks = [];
    const personal = { name: 'SEC_name', title: 'SEC_title', summary: '<p>SEC_summary</p>', photo: 'data:image/png;base64,SEC_photo' };
    for (const k of CONTACT_KEYS) { personal[k] = `SEC_${k}`; personal[`${k}Label`] = `SEC_${k}Label`; personal[`${k}Url`] = `https://SEC_${k}Url.example`; }
    const sections = [];
    for (const type of Object.keys(SECTION_TYPE_DEFAULTS)) {
      const base = SECTION_TYPE_DEFAULTS[type](`${type}_x`);
      const keys = Object.keys(base.items[0]).filter((k) => !['id', 'current', 'bullets'].includes(k));
      const full = {}; for (const k of keys) full[k] = `<p>SEC1_${type}_${k}</p>`;
      const full2 = {}; for (const k of keys) full2[k] = `<p>SEC2_${type}_${k}</p>`;
      const full3 = {}; for (const k of keys) full3[k] = `<p>SEC3_${type}_${k}</p>`;
      const allHidden = { ...base.items[0], ...full, id: 'h1', hiddenFields: keys, bullets: ['SEC_bullet'] };
      const hiddenItem = { ...base.items[0], ...full2, id: 'h2', visible: false };
      const shown = { ...base.items[0], id: 'h3' }; for (const k of keys) shown[k] = `shown ${k}`;
      sections.push({ ...base, id: `${type}_a`, visible: true, items: [allHidden, hiddenItem, shown] });
      sections.push({ ...base, id: `${type}_b`, title: `SEC_hiddensection_${type}`, visible: false, items: [{ ...base.items[0], ...full3, id: 'h4' }] });
    }
    const resume = {
      id: 'resume_SEC_id', name: 'SEC_resumename', kind: undefined, template: 'classic', updatedAt: 1, dataVersion: 13,
      settings: { customContactIcons: Object.fromEntries(CONTACT_KEYS.map((k) => [k, `data:image/png;base64,SEC_icon_${k}`])), myDesigns: [{ id: 'SEC_design' }], templatePreset: 'SEC_preset' },
      personal: { ...personal, hiddenFields: Object.keys(personal) },
      sections,
      coverLetter: { body: '<p>SEC_letter</p>', company: 'SEC_company' },
    };
    const md = await loadModule('/src/utils/markdownExport.js');
    const ats = await loadModule('/src/utils/atsChecker.js');
    const jr = await loadModule('/src/utils/jsonResumeExport.js');
    const outs = {
      markdown: md.generateMarkdownResume(resume),
      atsText: ats.generateAtsPlainText(resume),
      jsonResume: JSON.stringify(jr.cpwtResumeToJsonResume(resume)),
      docx: (await renderDocx(resume)).xml,
    };
    for (const t of ['classic']) outs[`pdf-${t}`] = allText(await read(await render({ ...resume, template: t })));
    const found = {};
    for (const [name, text] of Object.entries(outs)) {
      const uniq = [...new Set([...String(text).matchAll(/SEC[0-9]?_[A-Za-z0-9_]+/g)].map((m) => m[0]))];
      if (uniq.length) found[name] = uniq;
    }
    assert.fail(`PROBE11 ${Object.entries(found).map(([k, v]) => `[${k}] ${v.join(' ')}`).join(' ## ') || 'no leaks'}`);
  });
});
