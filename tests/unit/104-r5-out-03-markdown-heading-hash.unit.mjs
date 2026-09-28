// R5-OUT-03: a heading in the Markdown export whose title ends in " #" (a section "Hackathon #", a
// project "Build #" with no link, a name) printed that "#" bare at the line's end, where Markdown reads
// it as the heading's optional closing mark: renderers showed "Hackathon", and the app's own import
// (R4-LO-07's rule, which stays as CommonMark has it) read it back as "Hackathon". The export now
// escapes that trailing run ("## Hackathon \#"), and a title that is only "#"; "## C#" is unchanged.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markdownLines, resumeFromText } from '../../src/utils/importText.js';
import { generateMarkdownResume } from '../../src/utils/markdownExport.js';

const md = generateMarkdownResume({
  personal: { name: 'Robin Sample' },
  sections: [
    { id: 'h', type: 'custom', title: 'Hackathon #', visible: true, items: [{ id: 'c', title: 'Tidewater Jam', description: '<p>Built a tide chart.</p>' }] },
    { id: 'o', type: 'custom', title: '#', visible: true, items: [{ id: 'd', title: 'Channel notes', description: '<p>Ran the channel.</p>' }] },
    { id: 'c', type: 'custom', title: 'C#', visible: true, items: [{ id: 'e', title: 'Unity tools', description: '<p>Editor plug-ins.</p>' }] },
    { id: 'p', type: 'projects', title: 'Projects', visible: true, items: [{ id: 'q', name: 'Build #', technologies: 'Reactx', startDate: '2021' }] },
  ],
});

test('a trailing " #" in a section or project heading is escaped, "C#" is not', () => {
  assert.match(md, /^## Hackathon \\#$/m, md);
  assert.match(md, /^## \\#$/m, md);
  assert.match(md, /^## C#$/m, md);
  assert.match(md, /^### Build \\#$/m, md);
});

test('the headings come back from the app\'s Markdown import as typed', () => {
  const lines = markdownLines(md).filter((l) => l.hint === 'heading' || l.hint === 'entry').map((l) => l.text);
  for (const title of ['Hackathon #', '#', 'C#', 'Build #']) assert.ok(lines.includes(title), `${title} in ${JSON.stringify(lines)}`);
  const r = resumeFromText(markdownLines(md));
  const titles = r.sections.map((s) => s.title);
  for (const title of ['Hackathon #', 'C#']) assert.ok(titles.includes(title), `${title} in ${JSON.stringify(titles)}`);
  assert.equal(r.sections.find((s) => s.type === 'projects')?.items?.[0]?.name, 'Build #', md);
});
