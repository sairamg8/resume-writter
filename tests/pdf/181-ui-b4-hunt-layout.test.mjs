// UI rebuild B4 (hunt H2-13, H1-6): two small layout rules of the frame, read from the markup (the node tests have no layout; the
// geometry itself is B4's Playwright spec).
// H2-13: the alert cards (inset, mt-2) had no gap below the last one: it touched the editor panel and the stage. The row has a
//        2-unit gap below it; `empty:hidden` keeps an empty row from drawing it.
// H1-6: the stage toolbar is sticky over the scroll box; its background covered only the content box, so at a zoom above 100 %
//        (or with a dock beside the stage) the pages showed in the 8-16 px at its sides while scrolling. It now runs to the box's
//        edges (negative margins equal to the box's padding, the same padding back inside) and stays at the left when the box scrolls sideways.
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
});

describe('the stage toolbar runs to the edges of the preview box', () => {
  it('takes the box\'s full width over its padding, keeps sticking to the top, and to the left when the box scrolls sideways', () => {
    const on = classesOf('components/EditorPreviewPane.jsx', 'data-testid="stage-toolbar"');
    for (const token of ['sticky', 'top-0', 'left-0', 'self-stretch', '-mx-2', 'sm:-mx-4', 'px-2', 'sm:px-4']) assert.ok(on.includes(token), `${token}: ${on.join(' ')}`);
    assert.ok(!on.includes('w-full'), 'a full width of the content box leaves the padding bare at the sides');
    // The box pads by px-2 sm:px-4: the toolbar's negative margins are the same numbers (pinned together).
    const box = source('components/EditorPreviewPane.jsx').match(/overflow-auto bg-cv-stage[^`]*`/)?.[0] ?? '';
    assert.ok(/\bpx-2 sm:px-4\b/.test(box), `the preview box pads px-2 sm:px-4: ${box}`);
  });
});
