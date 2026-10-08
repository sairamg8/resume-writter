// Content hunt (cycle 6, editor-content): a description or summary line with one long word in it (a
// skills list typed with commas and no spaces, a pasted address that has no break point) ran past the
// right edge of the rich-text box. The box sits in a wrapper that is overflow-hidden, so the end of the
// word was cut off and the caret went out of sight. The editable area breaks inside a long word now,
// as the toast, the dialog and the notice boxes do (test 201). fake-dom has no layout: the source
// class that carries it is read.
import { it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

it('the rich-text editable area breaks inside a long word', () => {
  const editor = src('src/components/RichTextEditor.jsx');
  const box = /<div\s+ref=\{ref\}[\s\S]*?className="([^"]*)"/.exec(editor);
  assert.ok(box, 'the editable area is found by its ref');
  assert.match(box[1], /\brich-text-output\b/, 'and it is the one that holds the text');
  assert.match(box[1], /\bbreak-words\b/, 'a long word wraps inside the box');
});
