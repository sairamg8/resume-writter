// Résumés saved by the builds deployed before data version 8, which stamped no version on them:
// Design → Spacing "Between Items" and the letter's recipient title print what they printed on the
// build that last saved them (R2-1, R7-1, R7-2). The expected gaps were measured on exports of
// 07154c8 (deployed before 4bc56fe) and 4bc56fe, rendering these very résumés.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, render, renderCover, read, allItems, allText, loadModule } from './harness.mjs';

before(setup);
after(teardown);

/** The push of 4bc56fe: the first deployed build whose slider, dark-column presets and recipient block printed. */
const LIVE = Date.UTC(2026, 8, 14, 16, 9, 53);
const BEFORE = LIVE - 86_400_000;
const SINCE = LIVE + 60_000;

const normalizer = () => loadModule('/src/utils/normalizeResume.js');

/** Every section type both columns print, two entries or more each, at one Spacing preset. */
const sections = (spacing) => [
  section('skills', [{ category: 'SkAlpha', skills: 'One' }, { category: 'SkBeta', skills: 'Two' }]),
  section('education', [{ institution: 'EduOne', degree: 'BSc' }, { institution: 'EduTwo', degree: 'MSc' }]),
  section('languages', [{ language: 'LangOne', proficiency: 'Native' }, { language: 'LangTwo', proficiency: 'Fluent' }], { columns: 1 }),
  section('certifications', [{ name: 'CertOne', issuer: 'X' }, { name: 'CertTwo', issuer: 'Y' }]),
  section('interests', [{ interests: 'IntOne' }, { interests: 'IntTwo' }]),
  section('references', [{ name: 'RefOne', company: 'A' }, { name: 'RefTwo', company: 'B' }], { columns: 1 }),
  section('experience', [{ company: 'CoOne', role: 'RoleOne', location: 'P' }, { company: 'CoTwo', role: 'RoleTwo', location: 'Q' }]),
  section('awards', [{ title: 'AwardOne', issuer: 'I' }, { title: 'AwardTwo', issuer: 'J' }]),
].map((s) => {
  if (spacing === null) delete s.settings.spacing; // a section with no preset (an imported file's)
  else s.settings.spacing = spacing;
  return s;
});
const SIDE = { skills: ['SKALPHA', 'SKBETA'], education: ['EDUONE', 'EDUTWO'], languages: ['LANGONE', 'LANGTWO'], certifications: ['CERTONE', 'CERTTWO'], references: ['REFONE', 'REFTWO'] };
const MAIN = { experience: ['ROLEONE', 'ROLETWO'], awards: ['AWARDONE', 'AWARDTWO'] };

/** A résumé as a build that stamped no data version saved it, last edited at `updatedAt`. */
function saved({ itemGap, updatedAt, spacing = 'normal', ...opts }) {
  const r = resume({ ...opts, sections: sections(spacing) });
  if (itemGap === undefined) delete r.settings.itemGap; else r.settings.itemGap = itemGap;
  delete r.dataVersion;
  return { ...r, updatedAt };
}

const find = (pages, word) => allItems(pages).find((t) => t.str.toUpperCase().includes(word));
/**
 * The gap each section prints between its first two entries, in pt: their distance minus the one
 * they have with every Item gap at 0, so entry heights do not count. `chips`: the Interests chips'
 * distance, left edge to left edge.
 */
async function gapsOf(saved) {
  // Smaller type and margins keep every pair on page 1: an entry's header moves to the next page whole
  // (R2-049), so a pair across a page break has no gap to measure. The gaps do not change with them.
  const r = { ...saved, settings: { ...saved.settings, fontSizeBase: 8, marginV: 6 } };
  const zero = { ...r, sections: r.sections.map((s) => ({ ...s, settings: { ...s.settings, itemGap: 0 } })) };
  const [pages, flat] = [await read(await render(r)), await read(await render(zero))];
  const out = {};
  for (const [type, [a, b]] of Object.entries({ ...SIDE, ...MAIN })) {
    out[type] = +((find(pages, a).y - find(pages, b).y) - (find(flat, a).y - find(flat, b).y)).toFixed(2);
  }
  out.chips = +(find(pages, 'INTTWO').x - find(pages, 'INTONE').x).toFixed(2);
  return out;
}

/** What gapsOf() should be: `side` pt in the Sidebar's dark column (on Classic: its sections), `main` pt in the main column. */
const expect = (side, main, chips) => ({ ...Object.fromEntries(Object.keys(SIDE).map((t) => [t, side])), ...Object.fromEntries(Object.keys(MAIN).map((t) => [t, main])), chips });
/** The rows only: Classic's Interests chips follow Between Items like any other section. */
const rows = ({ chips: _chips, ...gaps }) => gaps;
const PRESET_PT = { normal: 6, relaxed: 10.5 };

describe('Between Items on a résumé saved before data version 8 (R2-1, R7-1, R7-2)', () => {
  it('Sidebar, last edited before 4bc56fe went live: the dark column keeps the gap it printed, the main column its preset\'s (R7-1)', async () => {
    const { normalizeResume } = await normalizer();
    // The chips' gap was fixed then, as a new résumé's is now (Between Items 8 px, Normal).
    const { chips } = await gapsOf(resume({ template: 'sidebar', sections: sections('normal') }));
    for (const itemGap of [12, 10, 30, 0, undefined]) {
      for (const spacing of ['normal', 'relaxed']) {
        const r = normalizeResume(saved({ template: 'sidebar', itemGap, spacing, updatedAt: BEFORE }));
        // The dark column printed Between Items in every section, presets ignored (before FIDB-38);
        // none stored printed the old default, 12 px.
        assert.deepEqual(await gapsOf(r), expect((itemGap ?? 12) * 0.75, PRESET_PT[spacing], chips), `${itemGap} px, ${spacing}`);
        assert.equal(r.settings.itemGap, 8, `${itemGap} px, ${spacing}: Design shows the new default`);
      }
    }
  });

  it('Classic, last edited before 4bc56fe went live: whatever Between Items stored never printed — the preset\'s gap is kept (R7-2)', async () => {
    const { normalizeResume } = await normalizer();
    for (const itemGap of [30, 10, 0]) {
      for (const spacing of ['normal', 'relaxed']) {
        const r = normalizeResume(saved({ itemGap, spacing, updatedAt: BEFORE }));
        assert.deepEqual(rows(await gapsOf(r)), rows(expect(PRESET_PT[spacing], PRESET_PT[spacing])), `${itemGap} px, ${spacing}`);
        assert.equal(r.settings.itemGap, 8, `${itemGap} px, ${spacing}`);
      }
    }
    // A section with no preset printed Between Items itself: it keeps that gap as its own.
    const r = normalizeResume(saved({ itemGap: 30, spacing: null, updatedAt: BEFORE }));
    assert.deepEqual(rows(await gapsOf(r)), rows(expect(22.5, 22.5)));
    assert.deepEqual([...new Set(r.sections.map((s) => s.settings.itemGap))], [30]);
  });

  it('last edited on 4bc56fe after it went live: the Between Items the user saw printing is kept (R7-2)', async () => {
    const { normalizeResume } = await normalizer();
    const { chips } = await gapsOf(resume({ template: 'sidebar', sections: sections('normal') }));
    for (const [itemGap, pt] of [[12, 9], [20, 15], [0, 0], [undefined, 9]]) {
      const r = normalizeResume(saved({ template: 'sidebar', itemGap, updatedAt: SINCE }));
      // 4bc56fe printed Between Items × the preset in both columns; none stored printed 12 px.
      assert.equal(r.settings.itemGap, itemGap ?? 12, `${itemGap} px: kept`);
      // …and the Interests chips at their fixed gap, which they only lost with 8a3d8fc (R7-1).
      assert.deepEqual(await gapsOf(r), expect(pt, pt, chips), `${itemGap} px`);
    }
    const classic = normalizeResume(saved({ itemGap: 20, spacing: 'relaxed', updatedAt: SINCE }));
    assert.equal(classic.settings.itemGap, 20);
    assert.ok(classic.sections.every((s) => s.settings.itemGap === undefined), 'no section gets its own gap');
  });

  it('a résumé with no settings at all (an imported file, stored as it came) prints the old default it printed', async () => {
    const { normalizeResume } = await normalizer();
    const bare = (template, updatedAt) => {
      const r = saved({ template, updatedAt });
      delete r.settings;
      return r;
    };
    const { chips } = await gapsOf(resume({ template: 'sidebar', sections: sections('normal') }));
    // Every build read it as its defaults: Between Items 12 px, the default until adbc5b9.
    assert.deepEqual(await gapsOf(normalizeResume(bare('sidebar', BEFORE))), expect(9, 6, chips), 'Sidebar, before the push');
    assert.deepEqual(rows(await gapsOf(normalizeResume(bare('classic', SINCE)))), rows(expect(9, 9)), 'Classic, since');
    // v9 runs after v8, so it now reaches such a Modern résumé too (V2W2b-4, versions 0–7).
    assert.equal(normalizeResume(bare('modern', BEFORE)).settings.photoTextAlign, 'top');
  });

  it('runs once, is not an edit, and leaves a résumé the deployed version-8 builds saved alone', async () => {
    const { normalizeResume, DATA_VERSION } = await normalizer();
    const old = saved({ template: 'sidebar', itemGap: 12, updatedAt: BEFORE });
    const copy = JSON.parse(JSON.stringify(old));
    const r = normalizeResume(old);
    assert.deepEqual(old, copy, 'the input is not mutated');
    assert.deepEqual([r.updatedAt, r.dataVersion], [BEFORE, DATA_VERSION]);
    assert.equal(normalizeResume(r), r, 'a migrated résumé: the same object');
    // 0b83cb1…f19cd2b stamped version 8 and printed what the résumé stores: nothing to redo.
    for (const updatedAt of [BEFORE, SINCE]) {
      const v8 = { ...saved({ template: 'sidebar', itemGap: 12, updatedAt }), dataVersion: 8 };
      assert.deepEqual(normalizeResume(v8).settings, v8.settings);
      assert.deepEqual(normalizeResume(v8).sections, v8.sections);
    }
    // No updatedAt, or not a number: not known to be newer, so it counts as older.
    for (const updatedAt of [undefined, '2026-09-15']) {
      assert.equal(normalizeResume(saved({ itemGap: 30, updatedAt })).settings.itemGap, 8, String(updatedAt));
    }
    // Version 7 (only the builds between 8d4f2a5 and adbc5b9 stamped it): v8 is due, v7 is not.
    const v7 = normalizeResume({ ...saved({ itemGap: 12, updatedAt: BEFORE }), dataVersion: 7, coverLetter: { recipientTitle: 'Hiring Manager', body: '<p>Hi</p>' } });
    assert.deepEqual([v7.settings.itemGap, v7.coverLetter.recipientTitle, v7.dataVersion], [8, 'Hiring Manager', DATA_VERSION]);
  });
});

describe('the letter\'s untouched "Hiring Manager" (R1-0, R7-2)', () => {
  const OLD_DEFAULT = { recipientName: '', recipientTitle: 'Hiring Manager', company: '', date: '', subject: '', body: '<p>Hello</p>' };
  const letter = (updatedAt) => {
    const r = resume({ coverLetter: OLD_DEFAULT });
    delete r.dataVersion;
    return { ...r, updatedAt };
  };

  it('is cleared on a letter last edited before 4bc56fe went live, kept on one edited since: it printed there', async () => {
    const { normalizeResume } = await normalizer();
    for (const updatedAt of [BEFORE, undefined]) assert.equal(normalizeResume(letter(updatedAt)).coverLetter.recipientTitle, '', String(updatedAt));
    const seen = normalizeResume(letter(SINCE));
    assert.equal(seen.coverLetter.recipientTitle, 'Hiring Manager');
    assert.ok(allText(await read(await renderCover(seen))).includes('Hiring Manager'), 'it prints, as it did on 4bc56fe');
  });
});
