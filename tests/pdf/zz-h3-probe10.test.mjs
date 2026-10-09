// PROBE: what a public link leaks of what the owner hid.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';

before(setup);
after(teardown);

describe('probe 10', () => {
  it('public snapshot leaks', async () => {
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
      const full = {}; for (const k of keys) full[k] = `<p>SEC_${type}_${k}</p>`;
      const allHidden = { ...base.items[0], ...full, id: 'h1', hiddenFields: keys, bullets: ['SEC_bullet'] };
      const hiddenItem = { ...base.items[0], ...full, id: 'h2', visible: false };
      const shown = { ...base.items[0], id: 'h3' }; for (const k of keys) shown[k] = `shown ${k}`;
      sections.push({ ...base, id: `${type}_a`, visible: true, items: [allHidden, hiddenItem, shown] });
      sections.push({ ...base, id: `${type}_b`, title: `SEC_hiddensection_${type}`, visible: false, items: [shown] });
    }
    const resume = {
      id: 'resume_SEC_id', name: 'SEC_resumename', kind: undefined, template: 'classic', updatedAt: 1, dataVersion: 13,
      settings: { customContactIcons: Object.fromEntries(CONTACT_KEYS.map((k) => [k, `data:image/png;base64,SEC_icon_${k}`])), myDesigns: [{ id: 'SEC_design' }], templatePreset: 'SEC_preset' },
      personal: { ...personal, hiddenFields: Object.keys(personal) },
      sections,
      coverLetter: { body: '<p>SEC_letter</p>', company: 'SEC_company' },
    };
    const snap = pub.publicSnapshot(resume);
    const json = JSON.stringify(snap);
    for (const m of json.matchAll(/SEC_[A-Za-z0-9_]+/g)) leaks.push(m[0]);
    const uniq = [...new Set(leaks)];
    assert.fail(`PROBE10 leaks=${uniq.length}: ${uniq.join(' ')} ¦ keys=${Object.keys(snap).join(',')} ¦ personalKeys=${Object.keys(snap.personal).join(',')}`);
  });
});
