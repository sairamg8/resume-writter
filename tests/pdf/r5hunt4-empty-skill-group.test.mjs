// R5-HUNT4-PDF-EMPTY-SKILL-GROUP-LONE-BULLET: a skill group that prints no category and no skills — one
// added with 'Add Skill Group' and left blank, the blank first group a new Skills section starts with,
// or a group with both eyes off — drew a row anyway: in Bullet style a lone '•' (the main column's
// SkillsSection and the Sidebar column's SideSkills), in the other styles an empty row and an extra item
// gap. Word, Markdown and the ATS text leave such a group out; the PDF now does too. Fictional data only.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, render, renderDocx, read, allText, allItems, TEMPLATES } from './harness.mjs';

before(setup);
after(teardown);

const FILLED = { category: 'Languages', skills: 'Rust, Go' };
const LATER = { category: 'Tools', skills: 'Vim, Make' };
const BLANK = { category: '', skills: '' };
const EYES_OFF = { category: 'Hidden', skills: 'Cobol', hiddenFields: ['category', 'skills'] };

const markers = (text) => (text.match(/•/g) || []).length;

const pdfOf = async (template, groups, skillsStyle, settings = {}) =>
  read(await render(resume({ template, settings, sections: [section('skills', groups, { skillsStyle })] })));

describe('A skill group that prints nothing takes no row (R5-HUNT4-PDF-EMPTY-SKILL-GROUP-LONE-BULLET)', () => {
  const LAYOUTS = [...TEMPLATES.map((t) => [t, {}]), ['sidebar', { sidebarSingleColumn: true }]];

  for (const [template, settings] of LAYOUTS) {
    const name = `${template}${settings.sidebarSingleColumn ? ' (Single · ATS-safe)' : ''}`;
    it(`${name}, Bullet: a blank group and a group with both eyes off print no marker`, async () => {
      const text = allText(await pdfOf(template, [FILLED, BLANK, EYES_OFF, LATER], 'bullet', settings));
      const two = allText(await pdfOf(template, [FILLED, LATER], 'bullet', settings));
      assert.ok(text.includes('Rust, Go') && text.includes('Vim, Make'), text);
      assert.ok(markers(two) >= 2, `the two groups' markers: ${two}`);
      assert.equal(markers(text), markers(two), `one marker a printed group: ${text}`);
    });

    it(`${name}, Inline: a blank group leaves no gap between the groups either side of it`, async () => {
      const yOf = async (groups) => allItems(await pdfOf(template, groups, 'inline', settings)).find((i) => i.str.includes('Vim'))?.y;
      const without = await yOf([FILLED, LATER]);
      const withBlank = await yOf([FILLED, BLANK, EYES_OFF, LATER]);
      assert.ok(without != null && withBlank != null, 'the later group printed');
      assert.ok(Math.abs(without - withBlank) < 0.5, `the later group at y=${withBlank}, not y=${without}`);
    });
  }

  // Guard: Word already left the group out; the PDF now agrees with it.
  it('Word leaves the same groups out', async () => {
    const { texts } = await renderDocx(resume({ sections: [section('skills', [FILLED, BLANK, EYES_OFF, LATER], { skillsStyle: 'bullet' })] }));
    assert.ok(texts.includes('Languages: Rust, Go') && texts.includes('Tools: Vim, Make'), texts.join(' | '));
    assert.ok(!texts.some((t) => /Hidden|Cobol/.test(t)), texts.join(' | '));
  });
});
