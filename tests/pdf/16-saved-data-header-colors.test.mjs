// Name & Title Colors saved by the builds whose template switch kept a colour picked for the old
// header (NB-1): the Sidebar's white name on Classic's white page, Classic's ink on the Sidebar
// column. One that can hardly be seen on its template's header goes back to the template's own,
// once, as the résumé comes in — load, import, cloud sync (src/utils/normalizeResume.js, v11).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, render, renderCover, drawState, loadModule } from './harness.mjs';

before(setup);
after(teardown);

/** The old seed's "Dark" résumé (6e57b52 defaultData.js), which builds from 4bc56fe on stored as Classic. */
const DARK_SEED = {
  accentColor: '#0f172a', textColor: '#1a1a1a', headingStyle: 'ruled', sidebarBg: '#0f172a',
  headerTextColor: '#ffffff', nameColor: '#ffffff', jobTitleColor: '#cbd5e1',
};

const normalizer = () => loadModule('/src/utils/normalizeResume.js');
/** `r` as a deployed build saved it: `dataVersion` none (4bc56fe) or 8–10 (0b83cb1 on), not edited since. */
const saved = (r, dataVersion) => {
  const out = { ...r, updatedAt: 5 };
  if (dataVersion === undefined) delete out.dataVersion;
  else out.dataVersion = dataVersion;
  return out;
};

/** "Person" (the name) and "Engineer" (the title), as the résumé's header and the letter's letterhead draw them, read on `ground` (3:1). */
async function assertReadable(r, ground, label) {
  const { contrast } = await loadModule('/src/templates/pdf/shared/pdfColors.js');
  for (const [doc, bytes] of [['PDF', await render(r)], ['letter', await renderCover(r)]]) {
    for (const word of ['Person', 'Engineer']) {
      const [hit] = await drawState(bytes, word);
      assert.ok(contrast(hit.fill, ground) >= 3, `${label} ${doc}: "${word}" drawn ${hit.fill} on ${ground}`);
    }
  }
}

describe('Name & Title Colors a template switch left unreadable, as older builds saved them (NB-1)', () => {
  it('the old seed\'s "Dark" résumé, stored as Classic by 4bc56fe and after: its name and title print readable on the white page', async () => {
    const { normalizeResume, DATA_VERSION } = await normalizer();
    for (const version of [undefined, 8, 9, 10]) {
      const old = saved(resume({ template: 'classic', settings: DARK_SEED }), version);
      const r = normalizeResume(old);
      const label = `data version ${version ?? 'none'}`;
      await assertReadable(r, '#ffffff', label);
      assert.deepEqual([r.settings.nameColor, r.settings.jobTitleColor], ['', ''], `${label}: the template's own, as the Design panel's ↺ sets`);
      for (const key of ['accentColor', 'textColor', 'headingStyle', 'sidebarBg', 'headerTextColor']) assert.equal(r.settings[key], old.settings[key], `${label}: ${key} kept`);
      assert.deepEqual([r.template, r.updatedAt, r.dataVersion], ['classic', 5, DATA_VERSION], `${label}: not an edit`);
      assert.equal(normalizeResume(r), r, `${label}: once — a current résumé is the same object`);
    }
  });

  it('a switch an older build saved: the Sidebar\'s white on a white page, a white page\'s inks on the Sidebar column or Modern\'s banner', async () => {
    const { normalizeResume } = await normalizer();
    const cases = [
      ...['classic', 'minimal', 'executive'].map((t) => [t, { nameColor: '#ffffff', jobTitleColor: '#bfdbfe' }, '#ffffff']),
      ['sidebar', { nameColor: '#1a1a1a', jobTitleColor: '#1e40af' }, '#1e293b'],
      ['modern', { nameColor: '#475569', jobTitleColor: '#2563eb', accentColor: '#2563eb' }, '#2563eb'],
    ];
    for (const [template, settings, ground] of cases) {
      const r = normalizeResume(saved(resume({ template, settings }), 10));
      const label = `${template} ${JSON.stringify(settings)}`;
      await assertReadable(r, ground, label);
      assert.deepEqual([r.settings.nameColor, r.settings.jobTitleColor], ['', ''], label);
    }
  });

  // Guards: only a colour that can hardly be seen goes; the fix is the two tests above.
  it('keeps a faint colour that may be the user\'s own there, a readable one, and this build\'s data', async () => {
    const { normalizeResume } = await normalizer();
    const keep = [
      // 2:1 up to 3:1 on the white page: a vivid orange title (2.8:1), a green name (2.5:1), a slate title (2.6:1).
      ['classic', { nameColor: '#1e3a8a', jobTitleColor: '#f97316' }],
      ['executive', { nameColor: '#10b981', jobTitleColor: '#94a3b8' }],
      ['sidebar', { nameColor: '#ffffff', jobTitleColor: '#475569', sidebarBg: '#0f172a' }], // 2.4:1 on that column
      ['modern', { nameColor: '#ffffff', jobTitleColor: '#fde68a' }],
      // Modern's own name (the header text colour, white) reads no better on a light accent.
      ['modern', { nameColor: '#ffffff', jobTitleColor: '', accentColor: '#fde047' }],
    ];
    for (const [template, settings] of keep) {
      const r = normalizeResume(saved(resume({ template, settings }), 10));
      assert.deepEqual([r.settings.nameColor, r.settings.jobTitleColor], [settings.nameColor, settings.jobTitleColor], `${template} ${JSON.stringify(settings)}`);
    }
    const current = resume({ template: 'classic', settings: DARK_SEED });
    assert.equal(normalizeResume(current), current, 'this build\'s data (a pick made since): the same object');
    const junk = normalizeResume({ ...saved(resume(), 10), settings: 'junk' });
    assert.equal(junk.settings, 'junk', 'settings that are not an object are left as they are');
  });
});
