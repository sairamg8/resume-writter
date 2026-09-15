// Skill groups in every template and every Skills style, and in Word, read through one rule
// (src/utils/skills.js): a group whose skills are a list (some imported data) prints like the
// comma-separated skills the editor writes, and a field the editor's eye hid stays out (FIDB-74).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, render, renderDocx, read, allText, TEMPLATES } from './harness.mjs';

before(setup);
after(teardown);

const STYLES = ['inline', 'stacked', 'bullet', 'tags', 'bars'];

describe('skill groups as imported data writes them (R6-0)', () => {
  const GROUPS = [
    { category: 'Listed', skills: ['Haskell', 'Elm'], hiddenFields: ['skills'] },
    { category: 'Shown', skills: ['Scala', 'OCaml'] },
    { category: 2024, skills: 'Rust' },
  ];

  /** What is wrong with `template` in `skillsStyle`, or null. */
  async function problem(template, skillsStyle) {
    let text;
    try {
      text = allText(await read(await render(resume({ template, sections: [section('skills', GROUPS, { skillsStyle })] }))));
    } catch (e) {
      return `crashed: ${e.message.split("\n")[0]}`;
    }
    if (/Haskell|Elm/.test(text)) return `the hidden list printed: ${text}`;
    if (!/\bScala\b/.test(text) || !/\bOCaml\b/.test(text)) return `the shown list run together or missing: ${text}`;
    const joined = !['tags', 'bars'].includes(skillsStyle) && !(template === 'sidebar' && skillsStyle === 'stacked');
    if (joined && !text.includes('Scala, OCaml')) return `not as the editor writes it: ${text}`;
    if (!text.includes('2024') || !text.includes('Rust')) return `the numeric category: ${text}`;
    return null;
  }

  for (const template of TEMPLATES) {
    it(`${template}: every style prints a list of skills as separate skills, hides a hidden one, and prints a numeric category`, async () => {
      const found = [];
      for (const skillsStyle of STYLES) {
        const p = await problem(template, skillsStyle);
        if (p) found.push(`${skillsStyle}: ${p}`);
      }
      assert.deepEqual(found, []);
    });
  }

  // Guard: Word already joined a list (411b31d); it now reads the groups through the same rule.
  it('Word prints the same groups', async () => {
    const { texts } = await renderDocx(resume({ sections: [section('skills', GROUPS)] }));
    assert.ok(!texts.some((t) => /Haskell|Elm/.test(t)), texts.join(' | '));
    assert.ok(texts.includes('Shown: Scala, OCaml') && texts.includes('2024: Rust'), texts.join(' | '));
  });
});
