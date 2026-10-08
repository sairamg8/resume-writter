// UI rebuild B4 (hunt H2-13, H1-6): two small layout rules of the frame, read from the markup (the node tests have no layout; the
// geometry itself is B4's Playwright spec).
// H2-13: the alert cards (inset, mt-2) had no gap below the last one: it touched the editor panel and the stage. The row has a
//        2-unit gap below it; `empty:hidden` keeps an empty row from drawing it.
// H1-6: the stage toolbar is sticky over the scroll box; its background covered only the content box, so at a zoom above 100 %
//        (or with a dock beside the stage) the pages showed in the 8-16 px at its sides while scrolling. It now runs to the box's
//        edges (negative margins equal to the box's padding, the same padding back inside). It sticks to the TOP only: a `left-0` could not
//        act (a sticky box keeps inside its containing block, which is the box's width, so there is no room to slide), and the old
//        toolbar scrolled sideways with the page too (hunt round 2, H2-8: two skeptics traced it).
// H2-7 (round 2): a file name with no spaces in an import error ran under the Dismiss button on a phone: the message spans break words.
// H2-9 (round 2): the resize handle's widened hit area lay under the sticky toolbar (both z-10, the toolbar later in the page): the handle is z-20.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = (file) => fs.readFileSync(new URL(`../../src/${file}`, import.meta.url), 'utf8');
/** The class list of the element whose opening tag carries `marker`. */
function classesOf(file, marker) {
  const text = source(file);
  const from = text.indexOf(marker);
  assert.ok(from >= 0, `${marker} is in ${file}`);
  const open = text.slice(text.lastIndexOf('<', from), text.indexOf('>', from));
  const quoted = open.match(/className="([^"]*)"/);
  assert.ok(quoted, `${marker} has a class list`);
  return quoted[1].split(/\s+/).filter(Boolean);
}

describe('the alerts row', () => {
  it('has a gap below the last card, and is still hidden when empty', () => {
    const on = classesOf('pages/Editor.jsx', 'data-testid="editor-alerts"');
    assert.ok(on.includes('pb-2'), `the gap below: ${on.join(' ')}`);
    assert.ok(on.includes('empty:hidden'), 'an empty row draws nothing, so the gap is not drawn either');
    assert.ok(on.includes('shrink-0'));
  });
  it('is capped on a phone and scrolls inside the cap, so a stack of alerts leaves the editor room (L6)', () => {
    const on = classesOf('pages/Editor.jsx', 'data-testid="editor-alerts"');
    assert.ok(on.includes('max-md:max-h-[35vh]'), `a height cap below md: ${on.join(' ')}`);
    assert.ok(on.includes('max-md:overflow-y-auto'), 'scrolls inside the cap');
  });
});

describe('the document switch at xl', () => {
  it('is wide enough for "Cover Letter" beside its icon (a 240 px switch cut it to "Cover Le..." in the 1440 px screenshot)', () => {
    const on = classesOf('components/EditorDocSwitch.jsx', 'order-5 xl:order-20');
    assert.ok(on.includes('xl:w-72'), on.join(' '));
    assert.ok(!on.includes('xl:w-60'));
  });
});

describe('the stage toolbar runs to the edges of the preview box', () => {
  it('takes the box\'s full width over its padding and keeps sticking to the top (no left-0: it cannot act in a box that is as wide as its parent)', () => {
    const on = classesOf('components/EditorPreviewPane.jsx', 'data-testid="stage-toolbar"');
    // `-top-4 sm:-top-8`, not top-0: a sticky box is held at `top` from the scroll box's padding edge (tests/pdf/228).
    for (const token of ['sticky', '-top-4', 'sm:-top-8', 'self-stretch', '-mx-2', 'sm:-mx-4', 'px-2', 'sm:px-4']) assert.ok(on.includes(token), `${token}: ${on.join(' ')}`);
    assert.ok(!on.includes('top-0'), 'top-0 stuck the bar one padding too low');
    assert.ok(!on.includes('left-0'), 'a sideways stick that cannot work is not claimed');
    assert.ok(!on.includes('w-full'), 'a full width of the content box leaves the padding bare at the sides');
    // The box pads by px-2 sm:px-4: the toolbar's negative margins are the same numbers (pinned together).
    const box = source('components/EditorPreviewPane.jsx').match(/overflow-auto bg-cv-stage[^`]*`/)?.[0] ?? '';
    assert.ok(/\bpx-2 sm:px-4\b/.test(box), `the preview box pads px-2 sm:px-4: ${box}`);
  });
});

describe('a long unbroken word in a card breaks instead of running under the Dismiss button', () => {
  it('the import notice, the export / import error and the Not saved message, and the Preview failed message, break words and may shrink', () => {
    for (const [file, marker] of [
      ['components/EditorHeader.jsx', '{importNotice}</span>'],
      ['components/EditorHeader.jsx', '{exportError}</span>'],
      ['components/EditorHeader.jsx', "{notSavedMessage('editor', persistError)}</span>"],
      ['components/PdfPreview.jsx', 'Preview failed to render'],
    ]) {
      const on = classesOf(file, marker);
      for (const token of ['flex-1', 'min-w-0', 'break-words']) assert.ok(on.includes(token), `${marker} ${token}: ${on.join(' ')}`);
    }
  });
});
