// R4-LO-07: the Markdown import's heading rule took any trailing "#" for a closing mark, so "## C#"
// read as the heading "C", and a link whose label holds brackets — "[Tool \[beta\]](…)", as the
// export escapes them, or a pair of its own, "[Notes [v2]](…)" — was not read as a link. A closing run
// of #s counts only after a space now, and a label may hold brackets, escaped or paired.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markdownLines, resumeFromText } from '../../src/utils/importText.js';
import { generateMarkdownResume } from '../../src/utils/markdownExport.js';

const texts = (md) => markdownLines(md).map((l) => l.text);

test('a heading that ends in "#" keeps it; a closing run after a space goes', () => {
  assert.deepEqual(texts('## C#\n### F# Tools\n## Skills in C#\n## Projects ##\n### C# #'),
    ['C#', 'F# Tools', 'Skills in C#', 'Projects', 'C#']);
});

test('a section titled "C#" comes back titled "C#"', () => {
  const md = generateMarkdownResume({
    personal: { name: 'Robin Sample' },
    sections: [{ id: 's', type: 'custom', title: 'C#', visible: true, items: [{ id: 'c', title: 'Unity tools', description: '<p>Editor plug-ins.</p>' }] }],
  });
  assert.match(md, /^## C#$/m, md);
  const r = resumeFromText(markdownLines(md));
  assert.deepEqual(r.sections.map((s) => s.title), ['C#'], md);
});

test('a link label with escaped or paired brackets is still a link', () => {
  assert.deepEqual(texts('- [Tool \\[beta\\]](https://example.com/tool)\n- [Notes [v2]](https://example.com/n)'),
    ['• Tool [beta] (https://example.com/tool)', '• Notes [v2] (https://example.com/n)']);
  // Escaped brackets that are no link stay text.
  assert.deepEqual(texts('\\[draft\\](later)'), ['[draft](later)']);
});

test('a project named with brackets round-trips through the Markdown export', () => {
  const md = generateMarkdownResume({
    personal: { name: 'Robin Sample' },
    sections: [{ id: 's', type: 'projects', title: 'Projects', visible: true, items: [{ id: 'p', name: 'Tool [beta]', url: 'https://example.com/tool', startDate: '2021' }] }],
  });
  const [p] = resumeFromText(markdownLines(md)).sections.find((s) => s.type === 'projects')?.items || [];
  assert.deepEqual([p?.name, p?.url], ['Tool [beta]', 'https://example.com/tool'], md);
});
