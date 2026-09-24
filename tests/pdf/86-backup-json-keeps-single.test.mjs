// Export → Backup JSON (the lossless copy: the résumé as stored) → import, in the Sidebar's Single ·
// ATS-safe: the imported résumé keeps the Layout and prints the same page, through normalizeResume
// as the store imports a file — for a backup of today's data, and an older one (no dataVersion)
// that runs the migrations; with the template's colours and with a Name, Job title and Text colour
// of the user's own. A backup is not an edit of what it holds, so the page must not change.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, experience, section, render, read, itemsWith, loadModule } from './harness.mjs';
import { drawing } from './extractors.mjs';

before(setup);
after(teardown);

const COLOURS = [{}, { nameColor: '#7c2d12', jobTitleColor: '#0f766e', textColor: '#1e3a8a', accentColor: '#e11d48' }];

const cv = (settings) => resume({
  template: 'sidebar',
  settings: { sidebarSingleColumn: true, ...settings },
  personal: { name: 'Pat Sample', title: 'Engineer', email: 'pat@example.com', phone: '+1 555 0100', summary: '<p>Builds things.</p>' },
  sections: [experience([{ company: 'Acme Corp', role: 'Staff Engineer', description: '<p>Led the platform.</p>' }]), section('skills', [{ category: 'Core', skills: 'Go, SQL' }])],
});

/** `r` as Backup JSON writes it and the store imports it: JSON.stringify, JSON.parse, normalizeResume. */
async function restored(r) {
  const { normalizeResume } = await loadModule('/src/utils/normalizeResume.js');
  return normalizeResume(JSON.parse(JSON.stringify(r, null, 2)));
}

/** One column: the Skills title starts where the Experience title does. */
async function oneColumn(r) {
  const pages = await read(await render(r));
  const [exp, skills] = [itemsWith(pages, 'EXPERIENCE')[0], itemsWith(pages, 'SKILLS')[0]];
  assert.ok(exp && skills, 'both section titles print');
  return Math.abs(exp.x - skills.x) < 2;
}

/** The ATS Check's verdict on the template's layout: pass, or warn. */
async function verdict(r) {
  const { analyzeAtsScore } = await loadModule('/src/utils/atsChecker.js');
  return analyzeAtsScore(r).categories.layout.items.find((i) => i.id === 'template').status;
}

describe('Backup JSON keeps the Sidebar\'s Single · ATS-safe page', () => {
  for (const colours of COLOURS) {
    const label = Object.keys(colours).length ? 'colours of the user\'s own' : 'the template\'s colours';
    it(`today's data, ${label}: the Layout kept, the same page`, async () => {
      const r = cv(colours);
      const back = await restored(r);
      assert.equal(back.settings.sidebarSingleColumn, true);
      assert.equal(JSON.stringify(await drawing(await render(back))), JSON.stringify(await drawing(await render(r))));
    });

    it(`an older backup (no dataVersion), ${label}: the Layout kept, the page it printed`, async () => {
      const { normalizeResume } = await loadModule('/src/utils/normalizeResume.js');
      const old = cv(colours);
      delete old.dataVersion;
      const back = await restored(old);
      assert.equal(back.settings.sidebarSingleColumn, true);
      assert.equal(await oneColumn(back), true, 'one column');
      assert.equal(await verdict(back), 'pass', 'the ATS Check passes the page');
      // What the app prints for that stored résumé today (the migrations included) is what the backup brings back.
      assert.equal(JSON.stringify(await drawing(await render(back))), JSON.stringify(await drawing(await render(normalizeResume(old)))));
    });
  }
});
