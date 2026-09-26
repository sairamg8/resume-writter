// Markdown export: user text prints as text, never as Markdown syntax (R4-EXP-01).
// A description reading "Built the <DataGrid> component and wrote __init__ hooks" lost "<DataGrid>"
// (a Markdown viewer takes it for an HTML tag and hides it) and showed a bold "init"; a company typed
// "Acme Corp " (a trailing space, common after a paste) printed "**Acme Corp ** — *Role*", whose
// closing asterisks a viewer shows as asterisks. Every user-text field is now backslash-escaped and
// trimmed before any Markdown is put around it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateMarkdownResume } from '../../src/utils/markdownExport.js';
import { markdownLines } from '../../src/utils/importText.js';

const md = (personal, sections = []) => generateMarkdownResume({
  personal: { name: 'Robin Sample', ...personal },
  sections: sections.map((s, i) => ({ id: `s${i}`, visible: true, ...s })),
});

test('a description keeps its angle brackets, underscores and asterisks as characters', () => {
  const out = md({}, [{ type: 'experience', title: 'Experience', items: [{ id: 'e', company: 'Acme', role: 'Dev',
    description: '<p>Built the &lt;DataGrid&gt; component and wrote __init__ hooks; 2*3 [draft] `x` ~~y~~.</p>' }] }]);
  assert.ok(out.includes('Built the \\<DataGrid\\> component and wrote \\_\\_init\\_\\_ hooks; 2\\*3 \\[draft\\] \\`x\\` \\~\\~y\\~\\~.'), out);
  assert.ok(!/[^\\]<DataGrid/.test(out), out);
});

test('a heading, meta line and title are trimmed before they are made bold or italic', () => {
  const out = md({ title: ' Staff Engineer ' }, [{ type: 'experience', title: 'Experience', items: [{ id: 'e',
    company: 'Acme Corp ', role: ' Lead ', location: 'London ', startDate: '2020' }] }]);
  assert.ok(out.includes('### **Acme Corp** — *Lead*'), out);
  assert.ok(out.includes('**Staff Engineer**'), out);
  assert.match(out, /\*[^*\n]*London\*/);
});

test('a paragraph that starts like a heading or a list prints as its text', () => {
  const out = md({ summary: '<p># 1 in sales</p><p>- not a list</p><p>3. third</p>' });
  assert.ok(out.includes('\\# 1 in sales'), out);
  assert.ok(out.includes('\\- not a list'), out);
  assert.ok(out.includes('3\\. third'), out);
});

test('the name, contacts, section title and list sections are escaped too', () => {
  const out = md({ name: 'Ann_Lee', email: 'ann_lee@example.com', location: '<Remote>' }, [
    { type: 'skills', title: 'Skills_*', items: [{ id: 'k', category: 'Lang ', skills: 'C#, *nix' }] },
    { type: 'interests', title: 'Interests', items: [{ id: 'i', interests: '<b>Chess</b>, __Go__' }] },
  ]);
  assert.ok(out.startsWith('# Ann\\_Lee\n'), out);
  assert.ok(out.includes('[ann\\_lee@example.com](mailto:ann_lee@example.com)'), out);
  assert.ok(out.includes('\\<Remote\\>'), out);
  assert.ok(out.includes('## Skills\\_\\*'), out);
  assert.ok(out.includes('- **Lang:** C#, \\*nix'), out);
  assert.ok(out.includes('\\<b\\>Chess\\</b\\>, \\_\\_Go\\_\\_'), out);
});

// Review of R4-EXP-01: the Markdown import reads the escapes back off, and a name or title that is not
// text (older stored data) still exports.

test('the .md reads back through the Markdown import with its characters, not its escapes', () => {
  const out = md({}, [{ type: 'experience', title: 'Experience', items: [{ id: 'e', company: 'Acme', role: 'Dev',
    description: '<p>Built the &lt;DataGrid&gt; with ~~y~~ and __init__</p><p>= equals</p>' }] }]);
  const texts = markdownLines(out).map((l) => l.text);
  assert.ok(texts.includes('Built the <DataGrid> with ~~y~~ and __init__'), texts.join(' | '));
  assert.ok(texts.includes('= equals'), texts.join(' | '));
});

test('a name or title that is a number exports as its text', () => {
  const out = generateMarkdownResume({ personal: { name: 42, title: 7 }, sections: [] });
  assert.ok(out.startsWith('# 42\n**7**'), out);
});
