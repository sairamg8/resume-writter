// Projects hunt (cycle 6): an issue titled with one pasted link ("https://github.com/org/repo/issues/123")
// widened the Summary page. Its "Recent activity" line is a flex row inside a card, and the card is a
// grid item (below lg the grid has one auto column): a flex row's minimum width is its longest unbreakable
// word, `break-words` does not count its break points, so the card and the column stayed as wide as the
// link, past a phone's edge, with the shell's main clipping the right of every card. `overflow-wrap:
// anywhere` counts them, so the line wraps at the card's edge. fake-dom has no layout: the class that
// carries it is read, as tests/pdf/201-cyc2-long-word-wraps.test.mjs does.
import { it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

it("the Summary's recent-activity line breaks inside a long issue title and can shrink", () => {
  const s = src('src/pages/ProjectSummary.jsx');
  assert.match(s, /<p className="min-w-0 \[overflow-wrap:anywhere\] text-cv-ink">\s*<span className="font-semibold">You<\/span> \{d\.text\}/);
});
