// R4-SYNC-03: the public copy took the résumé's settings whole — the saved designs (their names and
// looks), the name of the look last applied, and an uploaded icon for a contact hidden with its eye
// — none of which prints, into the one document anyone can read; and the share panel compared all of
// it, so saving or deleting a design, or an app update migrating the data version, said "You have
// changed the résumé since" for a PDF that had not changed. Now only what prints is copied and
// compared. A change that prints is still a change. Fictional data only.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule, resume, render, read, allText } from './harness.mjs';

let link;
before(async () => {
  await setup();
  link = await loadModule('/src/utils/publicLink.js');
});
after(teardown);

const ICON = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=';
function sample() {
  const r = resume({
    personal: {
      name: 'Jordan Ellery', title: 'Product Designer', email: 'jordan.ellery@example.org',
      linkedin: 'linkedin.com/in/jordan-hidden', hiddenFields: ['linkedin'],
    },
    settings: {
      myDesigns: [{ id: 'd1', name: 'For Acme (private)', look: { accentColor: '#123456' } }],
      templatePreset: 'my:d1',
      customContactIcons: { email: ICON, linkedin: `${ICON}#hidden` },
    },
  });
  r.dataVersion = 3;
  return r;
}

it('the copy leaves out the saved designs, the applied look\'s name and a hidden contact\'s icon', () => {
  const copy = link.publicSnapshot(sample());
  const json = JSON.stringify(copy);
  assert.ok(!json.includes('For Acme'), 'no saved design');
  assert.equal(copy.settings.myDesigns, undefined);
  assert.equal(copy.settings.templatePreset, undefined);
  assert.deepEqual(copy.settings.customContactIcons, { email: ICON }, 'a shown contact keeps its icon');
});

it('saving or deleting a design, or a new data version, leaves the copy current; a printed change does not', () => {
  const r = sample();
  const copy = link.publicSnapshot(r);
  const withDesign = { ...r, settings: { ...r.settings, myDesigns: [...r.settings.myDesigns, { id: 'd2', name: 'For Contoso', look: {} }], templatePreset: 'my:d2' } };
  assert.equal(link.publishedIsCurrent(copy, withDesign), true, 'a design saved');
  assert.equal(link.publishedIsCurrent(copy, { ...r, settings: { ...r.settings, myDesigns: [] } }), true, 'a design deleted');
  assert.equal(link.publishedIsCurrent(copy, { ...r, dataVersion: 4 }), true, 'an app update migrated it');
  const hiddenIcon = { ...r, settings: { ...r.settings, customContactIcons: { email: ICON, linkedin: `${ICON}#other` } } };
  assert.equal(link.publishedIsCurrent(copy, hiddenIcon), true, "a hidden contact's icon changed");
  assert.equal(link.publishedIsCurrent(copy, { ...r, settings: { ...r.settings, customContactIcons: {} } }), false, "a shown contact's icon is printed");
  assert.equal(link.publishedIsCurrent(copy, { ...r, personal: { ...r.personal, title: 'Art Director' } }), false);
});

it('the copy still prints exactly as the résumé does', async () => {
  // The icons aside: this pins that leaving the saved designs and the look's name out changes nothing printed.
  const r = sample();
  r.settings = { ...r.settings, customContactIcons: {} };
  const { normalizeResume } = await loadModule('/src/utils/normalizeResume.js');
  const printed = allText(await read(await render(r)));
  const published = allText(await read(await render(normalizeResume({ ...link.publicSnapshot(r), id: 'public_x', name: 'x' }))));
  assert.equal(published, printed);
});
