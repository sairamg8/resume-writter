// R2-147 (a per-skill level) — a skill group keeps an optional level for each of its skills
// (`skillLevels`, 1-5: src/constants/skillLevels.js), edited in the Skills editor and drawn as the length
// of the skill's bar in the Bars style, in the main column of every template and the Sidebar's side column
// alike. It was a fixed 80 %. A skill with no level is still the 80 % bar (a level of 4 draws the same),
// and no other style, no text export and no page's words change: the level is a drawing, never text.
// Fictional data only.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, render, loadModule, TEMPLATES } from './harness.mjs';
import { snapshot } from './parity/measure.mjs';

before(setup);
after(teardown);

const NAMES = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot'];
const LEVELS = { Alpha: 1, Bravo: 2, Charlie: 3, Delta: 4, Echo: 5 }; // Foxtrot: none
const SKILLS = NAMES.join(', ');

/** Every template, and the Sidebar's Single · ATS-safe (its skills in the main column). */
const VARIANTS = [...TEMPLATES.map((template) => ({ template, settings: {} })), { template: 'sidebar', settings: { sidebarSingleColumn: true } }];
const name = (v) => `${v.template}${v.settings.sidebarSingleColumn ? '+single' : ''}`;

/** A résumé with one skill group in `skillsStyle`; `skillLevels` only when given. */
const cv = ({ template, settings }, skillsStyle, skillLevels) => resume({
  template, settings,
  sections: [section('skills', [{ category: 'Levels', skills: SKILLS, ...(skillLevels ? { skillLevels } : {}) }], { skillsStyle })],
});

/**
 * How full each named skill's bar is (its fill's width over its track's, 0-1), read off the page: a bar is
 * two 3 pt-high shapes from one left edge (the track and the fill), and a skill's is the one nearest its
 * label's baseline — beside it in the main column, under it in the Sidebar's.
 */
function fills(snap, names = NAMES) {
  const shapes = snap.paint.filter((p) => p.paint === 'fill' && Math.abs(p.y1 - p.y0 - 3) < 0.25 && p.x1 - p.x0 >= 2);
  const bars = [];
  for (const p of shapes) {
    const mates = shapes.filter((q) => q !== p && q.page === p.page && Math.abs(q.x0 - p.x0) < 0.1 && Math.abs(q.y0 - p.y0) < 0.1);
    if (mates.length === 1 && p.x1 - p.x0 >= mates[0].x1 - mates[0].x0 - 1e-6) {
      bars.push({ page: p.page, y: (p.y0 + p.y1) / 2, ratio: (mates[0].x1 - mates[0].x0) / (p.x1 - p.x0) });
    }
  }
  return names.map((n) => {
    const at = snap.pages.flatMap((pg, i) => pg.items.filter((t) => t.str.trim() === n).map((t) => ({ ...t, page: i + 1 })))[0];
    assert.ok(at, `"${n}" prints`);
    const near = bars.filter((b) => b.page === at.page).sort((a, b) => Math.abs(a.y - at.y) - Math.abs(b.y - at.y))[0];
    assert.ok(near, `a bar is painted for "${n}"`);
    return Math.round(near.ratio * 100) / 100;
  });
}

describe('Skills → Bars draws each skill\'s level as the length of its bar (R2-147)', () => {
  it('every template: a level fills level / 5 of the track (20 to 100 %); a skill with none keeps the 80 % bar', async () => {
    const wrong = [];
    for (const v of VARIANTS) {
      const got = fills(await snapshot(await render(cv(v, 'bars', LEVELS))));
      if (JSON.stringify(got) !== JSON.stringify([0.2, 0.4, 0.6, 0.8, 1, 0.8])) wrong.push(`${name(v)}: ${JSON.stringify(got)}`);
    }
    assert.deepEqual(wrong, []);
  });

  it('no level anywhere: every bar 80 %, and a level of 4 (Advanced) draws exactly the page unset draws', async () => {
    const wrong = [];
    for (const v of VARIANTS) {
      const unset = await snapshot(await render(cv(v, 'bars')));
      if (JSON.stringify(fills(unset)) !== JSON.stringify(NAMES.map(() => 0.8))) wrong.push(`${name(v)} unset: ${JSON.stringify(fills(unset))}`);
      const four = await snapshot(await render(cv(v, 'bars', Object.fromEntries(NAMES.map((n) => [n, 4])))));
      if (four.drawing !== unset.drawing) wrong.push(`${name(v)}: all Advanced prints another page than unset`);
    }
    assert.deepEqual(wrong, []);
  });

  it('a level that is no level (out of range, not a number, a skill the group does not list) leaves the page as unset prints it', async () => {
    const junk = { Alpha: 0, Bravo: 6, Charlie: 'high', Delta: 2.5, Echo: null, Ghost: 5, constructor: 1 };
    for (const v of [{ template: 'classic', settings: {} }, { template: 'sidebar', settings: {} }]) {
      const [unset, bad] = await Promise.all([undefined, junk].map(async (l) => snapshot(await render(cv(v, 'bars', l)))));
      assert.equal(bad.drawing, unset.drawing, `${name(v)}: an invalid level draws something`);
    }
  });

  it('the level is a drawing, not text: the words the page prints are the same with and without it', async () => {
    for (const v of [{ template: 'classic', settings: {} }, { template: 'sidebar', settings: {} }, { template: 'compact', settings: {} }]) {
      const [unset, drawn] = await Promise.all([undefined, LEVELS].map(async (l) => snapshot(await render(cv(v, 'bars', l)))));
      assert.equal(drawn.text, unset.text, `${name(v)}: the level printed as text`);
      assert.notEqual(drawn.drawing, unset.drawing, `${name(v)}: the levels changed nothing`);
      assert.doesNotMatch(drawn.text, /Beginner|Basic|Intermediate|Advanced|Expert|[1-5]\s*\/\s*5/);
    }
  });

  it('other styles draw nothing of it: Inline, Stacked, Bullet and Tags print the page they printed without levels', async () => {
    for (const v of [{ template: 'classic', settings: {} }, { template: 'sidebar', settings: {} }]) {
      for (const style of ['inline', 'stacked', 'bullet', 'tags']) {
        const [unset, drawn] = await Promise.all([undefined, LEVELS].map(async (l) => snapshot(await render(cv(v, style, l)))));
        assert.equal(drawn.drawing, unset.drawing, `${name(v)} ${style}: a level changed the page`);
      }
    }
  });

  it('a group whose skills the eye hid prints no bars, however many levels it keeps', async () => {
    const hidden = (skillLevels) => resume({
      template: 'classic',
      sections: [section('skills', [{ category: 'Levels', skills: SKILLS, hiddenFields: ['skills'], ...(skillLevels ? { skillLevels } : {}) }], { skillsStyle: 'bars' })],
    });
    const [unset, drawn] = await Promise.all([undefined, LEVELS].map(async (l) => snapshot(await render(hidden(l)))));
    assert.equal(drawn.drawing, unset.drawing);
    assert.ok(!drawn.text.includes('Alpha'), 'the hidden skills stay hidden');
  });
});

describe('the level is kept through the store\'s normaliser and a JSON round trip (R2-147)', () => {
  it('normalizeResume keeps a valid level, drops an invalid one and a skill no longer listed, and the page follows', async () => {
    const { normalizeResume } = await loadModule('/src/utils/normalizeResume.js');
    const r = cv({ template: 'classic', settings: {} }, 'bars', { ...LEVELS, Bravo: 'high', Charlie: 9, Ghost: 3 });
    const [skills] = normalizeResume(r).sections;
    assert.deepEqual(skills.items[0].skillLevels, { Alpha: 1, Delta: 4, Echo: 5 });
    assert.deepEqual(fills(await snapshot(await render(normalizeResume(r)))), [0.2, 0.8, 0.8, 0.8, 1, 0.8]);
    // A résumé with no skillLevels key is no different after it.
    const plain = cv({ template: 'classic', settings: {} }, 'bars');
    assert.ok(!('skillLevels' in normalizeResume(plain).sections[0].items[0]));
  });

  it('a backup .json (the résumé as stored) comes back with its levels, and prints the same page', async () => {
    const { normalizeResume } = await loadModule('/src/utils/normalizeResume.js');
    for (const v of [{ template: 'classic', settings: {} }, { template: 'sidebar', settings: {} }]) {
      const r = cv(v, 'bars', LEVELS);
      const back = normalizeResume(JSON.parse(JSON.stringify(r)));
      assert.deepEqual(back.sections[0].items[0].skillLevels, LEVELS);
      assert.equal((await snapshot(await render(back))).drawing, (await snapshot(await render(r))).drawing, `${name(v)}: the page after the trip`);
    }
  });

  it('a JSON Resume file (skills[].level and keywordLevels) comes back with its levels: the same bars', async () => {
    const { cpwtResumeToJsonResume, jsonResumeToCpwtResume } = await loadModule('/src/utils/jsonResume.js');
    const { normalizeResume } = await loadModule('/src/utils/normalizeResume.js');
    const r = cv({ template: 'classic', settings: {} }, 'bars', LEVELS);
    const file = JSON.parse(JSON.stringify(cpwtResumeToJsonResume(r)));
    assert.deepEqual(file.skills[0].keywordLevels, { Alpha: 'Beginner', Bravo: 'Basic', Charlie: 'Intermediate', Delta: 'Advanced', Echo: 'Expert' });
    const back = normalizeResume(jsonResumeToCpwtResume(file));
    const skills = back.sections.find((s) => s.type === 'skills');
    assert.equal(skills.settings.skillsStyle, 'bars', 'the section\'s style rides in meta');
    assert.deepEqual(skills.items[0].skillLevels, LEVELS);
    assert.deepEqual(fills(await snapshot(await render(back))), [0.2, 0.4, 0.6, 0.8, 1, 0.8]);
  });
});

describe('the text exports print no level (R2-147)', () => {
  it('Markdown and the ATS text are the same with and without levels, in every style', async () => {
    const { generateMarkdownResume } = await loadModule('/src/utils/markdownExport.js');
    const { generateAtsPlainText } = await loadModule('/src/utils/atsPlainText.js');
    for (const style of ['inline', 'stacked', 'bullet', 'tags', 'bars']) {
      const [unset, drawn] = [undefined, LEVELS].map((l) => cv({ template: 'classic', settings: {} }, style, l));
      assert.equal(generateMarkdownResume(drawn), generateMarkdownResume(unset), `${style}: Markdown`);
      assert.equal(generateAtsPlainText(drawn), generateAtsPlainText(unset), `${style}: ATS text`);
    }
  });
});

describe('a public link keeps the levels of the skills it shows, and none of hidden skills (R2-147)', () => {
  it('the copy carries a shown group\'s levels; a group whose skills are hidden loses its levels, whose keys are the skills\' names', async () => {
    const { publicSnapshot } = await loadModule('/src/utils/publicLink.js');
    const r = resume({
      sections: [section('skills', [
        { category: 'Shown', skills: 'Alpha, Bravo', skillLevels: { Alpha: 2 } },
        { category: 'Private', skills: 'Secretskill', skillLevels: { Secretskill: 5 }, hiddenFields: ['skills'] },
      ], { skillsStyle: 'bars' })],
    });
    const copy = publicSnapshot(r);
    const [shown, hidden] = copy.sections[0].items;
    assert.deepEqual(shown.skillLevels, { Alpha: 2 });
    assert.ok(!('skillLevels' in hidden), 'the hidden group\'s levels are not copied');
    assert.ok(!JSON.stringify(copy).includes('Secretskill'), 'the hidden skill\'s name is not in the copy');
  });
});
