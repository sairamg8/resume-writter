// R2-147 (a per-skill level) in Word. The PDF draws a skill's level as the length of its Bars bar; Word
// draws no bar, so it prints the level as glyphs after the skill, in the accent — "React ▰▰▰▰▱" — as a
// language's level is (R4-DOUT-11), in the Bars style only, where the PDF draws it. A skill with no level
// is its word alone, and a group with no levels, or in another style, is the text it always was.
// Fictional data only.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, renderDocx } from './harness.mjs';

before(setup);
after(teardown);

const SKILLS = 'Alpha, Bravo, Charlie, Delta, Echo, Foxtrot';
const LEVELS = { Alpha: 1, Bravo: 2, Charlie: 3, Delta: 4, Echo: 5 }; // Foxtrot: none
const GLYPHS = 'Alpha ▰▱▱▱▱, Bravo ▰▰▱▱▱, Charlie ▰▰▰▱▱, Delta ▰▰▰▰▱, Echo ▰▰▰▰▰, Foxtrot';

const cv = (template, skillsStyle, skillLevels, extra = {}) => resume({
  template,
  settings: { accentColor: '#aa3300' },
  sections: [section('skills', [{ category: 'Levels', skills: SKILLS, ...(skillLevels ? { skillLevels } : {}), ...extra }], { skillsStyle })],
});

describe('Word: Skills in Bars print each skill\'s level as glyphs after it (R2-147)', () => {
  it('a level is SKILL_LEVEL_STEPS glyphs, its steps filled, after the skill; a skill with none is its word alone', async () => {
    for (const template of ['classic', 'modern', 'minimal', 'compact']) {
      const doc = await renderDocx(cv(template, 'bars', LEVELS));
      assert.ok(doc.texts.includes(`LEVELS: ${GLYPHS}`), `${template}: ${doc.texts.join(' | ')}`);
    }
  });

  it('the glyphs are a run of their own in the accent, the skills\' words in the bar ink', async () => {
    const doc = await renderDocx(cv('classic', 'bars', LEVELS));
    const run = doc.xml.split('</w:r>').find((r) => r.includes('>▰▰▰▱▱<'));
    assert.ok(run, 'the level\'s glyphs are a run of their own');
    assert.match(run, /<w:color w:val="aa3300"\/>/i);
    const word = doc.xml.split('</w:r>').find((r) => r.includes('>, Bravo '));
    assert.ok(word, 'the skill\'s word before its glyphs');
    assert.doesNotMatch(word, /<w:color w:val="aa3300"\/>/i);
  });

  it('the Sidebar\'s side column prints them too', async () => {
    const doc = await renderDocx(cv('sidebar', 'bars', LEVELS));
    assert.ok(doc.texts.includes(`LEVELS: ${GLYPHS}`), doc.texts.join(' | '));
  });

  it('the glyphs agree with the PDF: as many filled as the level, five in all', async () => {
    const doc = await renderDocx(cv('classic', 'bars', LEVELS));
    const line = doc.texts.find((t) => t.startsWith('LEVELS:'));
    for (const [skill, level] of Object.entries(LEVELS)) {
      const bar = new RegExp(`${skill} (▰*)(▱*)(?:,|$)`).exec(line);
      assert.ok(bar, `${skill}'s bar`);
      assert.deepEqual([bar[1].length, bar[2].length], [level, 5 - level], skill);
    }
    assert.doesNotMatch(line, /Foxtrot [▰▱]/);
  });

  it('no level, or one that is no level: the paragraph is exactly what it was without', async () => {
    const plain = await renderDocx(cv('classic', 'bars'));
    assert.ok(plain.texts.includes(`LEVELS: ${SKILLS}`), plain.texts.join(' | '));
    for (const junk of [{}, { Alpha: 0, Bravo: 6, Charlie: 'high', Delta: 2.5, Echo: null, Ghost: 5 }]) {
      assert.deepEqual((await renderDocx(cv('classic', 'bars', junk))).texts, plain.texts, JSON.stringify(junk));
    }
  });

  it('a group whose skills the eye hid prints no glyphs', async () => {
    const doc = await renderDocx(cv('classic', 'bars', LEVELS, { hiddenFields: ['skills'] }));
    assert.ok(!doc.texts.some((t) => /[▰▱]/.test(t)), doc.texts.join(' | '));
    assert.ok(!doc.texts.some((t) => t.includes('Alpha')));
  });
});

describe('Word: no other style prints a level (R2-147)', () => {
  for (const template of ['classic', 'sidebar']) {
    it(`${template}: Inline, Stacked, Bullet and Tags print the paragraphs they printed without levels`, async () => {
      for (const style of ['inline', 'stacked', 'bullet', 'tags']) {
        const [unset, drawn] = await Promise.all([undefined, LEVELS].map(async (l) => renderDocx(cv(template, style, l))));
        assert.deepEqual(drawn.texts, unset.texts, `${style}: a level changed the text`);
        assert.ok(!/[▰▱]/.test(drawn.xml), `${style}: a level's glyphs are in the document`);
      }
    });
  }
});
