// R5-HUNT4-TEXT-IMPORT-SKILLS-BULLET-PIPE-SEPARATORS: skills set apart at " • ", " · " or " | " in a
// text, PDF or Word file ("Python • SQL • Spark", "Languages: Python | Java | Go"). Before, each line
// was stored as one skill, so Tags, Bars and the Sidebar's Stacked printed one chip holding the
// whole line. They are stored comma-separated now, as the editor writes them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeFromText } from '../../src/utils/importText.js';
import { skillGroup } from '../../src/utils/skills.js';

const groups = (body) => resumeFromText(`Jane Doe\njane@x.com\n\nSKILLS\n${body}`).sections.find((s) => s.type === 'skills').items
  .map((i) => [i.category, i.skills]);

test('skills set apart at | • · are stored comma-separated, one chip each', () => {
  assert.deepEqual(groups('Languages: Python | Java | Go\nPython • SQL • Spark\nTools · Git · Docker'), [
    ['Languages', 'Python, Java, Go'], ['', 'Python, SQL, Spark'], ['', 'Tools, Git, Docker'],
  ]);
  const [item] = resumeFromText('Jane Doe\n\nSKILLS\nPython • SQL • Spark').sections[0].items;
  assert.deepEqual(skillGroup(item).list, ['Python', 'SQL', 'Spark']);
});

test('two categories on one line are two groups; a category over its list keeps it', () => {
  assert.deepEqual(groups('Languages: Python, Java | Tools: Git, Docker'), [['Languages', 'Python, Java'], ['Tools', 'Git, Docker']]);
  assert.deepEqual(groups('Programming\nPython • SQL'), [['Programming', 'Python, SQL']]);
});

test('comma lists and tab cells read as before', () => {
  assert.deepEqual(groups('Languages: Python, Java\nFrameworks: React\tTools: Git'), [['Languages', 'Python, Java'], ['Frameworks', 'React'], ['Tools', 'Git']]);
});
