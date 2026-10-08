// Content hunt (cycle 2): one long word with no spaces in it (a file name such as
// Alexander_Hamilton_Senior_Product_Manager_CV_2026_final.pdf, a company or project name pasted as a URL, a
// search typed as one) ran past the box that showed it:
//  - the Dashboard's import error ("Could not import <file name>") sat in a flex row whose text could not shrink below
//    the word, so on a 360 px phone the Dismiss button was pushed off the screen; every .cv-notice-* box is
//    overflow-wrap: anywhere now (min-content counts the break points, so a flex child shrinks too);
//  - a toast ("<company> deleted", "Column “…” deleted", "<project> deleted") and a dialog (the confirm's
//    "Delete <company>?" title and its body) had no break-words, so the word ran under the Dismiss / Close button;
//  - the board's sprint note ("<sprint> · ends … · <goal>"): a goal pasted as a link widened the line past the screen
//    (the Backlog's goal line already breaks words);
//  - the "No … match “<what was typed>”" lines of the search box and the Projects table (a link pasted into the box).
// fake-dom has no layout: the source classes that carry it are read.
import { it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

it('the notice boxes break inside a long word', () => {
  const css = src('src/index.css');
  for (const name of ['cv-notice-warn', 'cv-notice-bad']) {
    const rule = new RegExp(`\\.${name} \\{([^}]*)\\}`).exec(css);
    assert.ok(rule, `${name} is defined`);
    assert.match(rule[1], /overflow-wrap:\s*anywhere/, `${name} breaks inside a long word`);
  }
});

it('the toast and the dialog break inside a long word', () => {
  assert.match(src('src/components/ui/Toast.jsx'), /'pointer-events-auto flex w-full items-start gap-3 break-words /);
  assert.match(src('src/components/ui/Dialog.jsx'), /'relative flex w-full flex-col overflow-hidden break-words /);
});

it('the "no match" lines break inside what was typed', () => {
  assert.match(src('src/components/shell/TopBar.jsx'), /className="px-3 py-3 text-sm break-words text-cv-muted">No issues or projects match/);
  assert.match(src('src/pages/Boards.jsx'), /className="py-8 text-center text-sm break-words text-cv-faint">No projects match/);
});

it("the board's sprint note can shrink and breaks inside a long goal", () => {
  const s = src('src/pages/Board.jsx');
  assert.match(s, /<Info size=\{14\} aria-hidden="true" className="shrink-0 text-cv-faint" \/>\s*<span className="min-w-0 break-words">\s*\{sprint &&/);
});
