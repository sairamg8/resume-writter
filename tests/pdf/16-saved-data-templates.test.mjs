// A résumé whose template id is not one the app writes — an imported file's "Modern" or
// " sidebar ", the old seed's 'dark' — made current on the way in (src/utils/normalizeResume.js,
// withKnownTemplate — M15, R5-5): the template it names, or Classic, with a name that reads there.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, render, drawState, loadModule } from './harness.mjs';
import { drawing } from './extractors.mjs';

before(setup);
after(teardown);

const PERSONAL = { email: 'alex@example.com', phone: '+1 555 0100', summary: '<p>An experienced engineer.</p>' };
/** The old seed's "Dark" résumé (6e57b52 defaultData.js): colours for a dark header no template of the app ever drew. */
const DARK_SEED = {
  accentColor: '#0f172a', textColor: '#1a1a1a', headingStyle: 'ruled', sidebarBg: '#0f172a',
  headerTextColor: '#ffffff', nameColor: '#ffffff', jobTitleColor: '#cbd5e1',
};

const normalizer = () => loadModule('/src/utils/normalizeResume.js');
/** `r` as a build before data versions saved it: `dataVersion` none, last edited long ago. */
const saved = (r, template) => {
  const out = { ...r, template, updatedAt: 5 };
  delete out.dataVersion;
  return out;
};

describe('template ids as imported files and older builds wrote them (M15, R5-5)', () => {
  it('an id in another case or with spaces is the template it names: stored so, and printed so', async () => {
    const { normalizeResume } = await normalizer();
    for (const [written, id] of [['Modern', 'modern'], [' sidebar ', 'sidebar'], ['EXECUTIVE', 'executive'], ['Minimal\n', 'minimal']]) {
      const imported = saved(resume({ template: id, personal: PERSONAL }), written);
      const r = normalizeResume(imported);
      assert.equal(r.template, id, `${JSON.stringify(written)}: stored as ${id}, so the Design panel marks it`);
      const as = await drawing(await render({ ...imported, template: id }));
      assert.equal(await drawing(await render(imported)), as, `${JSON.stringify(written)}: the PDF (= the preview) prints ${id}`);
    }
  });

  it('the old seed\'s "dark" prints as Classic, as it always did, with its name and title readable on the white page', async () => {
    const { normalizeResume } = await normalizer();
    const { contrast } = await loadModule('/src/templates/pdf/shared/pdfColors.js');
    for (const [nameColor, jobTitleColor] of [['#ffffff', '#cbd5e1'], ['#fff', 'rgba(255,255,255,0.9)'], ['#e2e8f0', '#94a3b8']]) {
      const old = saved(resume({ personal: PERSONAL, settings: { ...DARK_SEED, nameColor, jobTitleColor } }), 'dark');
      const r = normalizeResume(old);
      const label = `${nameColor} / ${jobTitleColor}`;
      const bytes = await render(r);
      for (const word of ['Person', 'Engineer']) {
        const [hit] = await drawState(bytes, word);
        assert.ok(contrast(hit.fill, '#ffffff') >= 3, `${label}: "${word}" drawn ${hit.fill} on the white page`);
      }
      assert.equal(r.template, 'classic', label);
      assert.deepEqual([r.settings.nameColor, r.settings.jobTitleColor], ['', ''], `${label}: the template's own, as the Design panel's ↺ sets`);
      for (const key of ['accentColor', 'textColor', 'headingStyle', 'sidebarBg', 'headerTextColor']) assert.equal(r.settings[key], old.settings[key], `${label}: ${key} kept`);
      assert.equal(r.updatedAt, 5, 'not an edit');
    }
  });

  // Guards: only the colours an unknown id's Classic page cannot show go; the fix is the test above.
  it('keeps a name or title colour that reads on the white page, a known template\'s own, and this build\'s data', async () => {
    const { normalizeResume } = await normalizer();
    const aurora = normalizeResume(saved(resume({ settings: { nameColor: '#1e3a8a', jobTitleColor: '#64748b' } }), 'aurora'));
    assert.deepEqual([aurora.template, aurora.settings.nameColor, aurora.settings.jobTitleColor], ['classic', '#1e3a8a', '#64748b']);
    const modern = normalizeResume(saved(resume({ template: 'modern', settings: DARK_SEED }), 'Modern'));
    assert.deepEqual([modern.template, modern.settings.nameColor, modern.settings.jobTitleColor], ['modern', '#ffffff', '#cbd5e1'], 'Modern prints them on its banner');
    const current = resume({ template: 'sidebar', settings: DARK_SEED });
    assert.equal(normalizeResume(current), current, 'this build\'s data: the same object');
    const junk = normalizeResume({ ...saved(resume(), 'dark'), settings: 'junk' });
    assert.deepEqual([junk.template, junk.settings], ['classic', 'junk'], 'settings that are not an object are left as they are');
  });
});
