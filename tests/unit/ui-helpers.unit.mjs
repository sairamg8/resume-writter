// The workspace kit's pure helpers (src/components/ui, src/hooks): where a floating panel goes
// (placement.js), the glue that hands one element several refs and handlers (compose.js), which
// keydown is which shortcut and when a shortcut must stay quiet (useHotkeys.js), and how one
// search param is written into the address (useUrlState.js). No DOM and no React render: plain
// rectangles, plain event objects, plain strings.
// Run: node --test tests/unit/ui-helpers.unit.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computePlacement, parsePlacement } from '../../src/components/ui/placement.js';
import { composeHandlers, cx, mergeRefs, tabbables } from '../../src/components/ui/compose.js';
import { hasCommandModifier, isTypingTarget, matchesHotkey, parseHotkey } from '../../src/hooks/useHotkeys.js';
import { withSearchParam } from '../../src/hooks/useUrlState.js';

const VIEWPORT = { width: 1440, height: 900 };
/** An anchor's rectangle as getBoundingClientRect gives it. */
const rect = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height });

describe('placement: a floating panel stays inside the viewport', () => {
  it('parsePlacement reads side and align, with safe defaults', () => {
    assert.deepEqual(parsePlacement('bottom-start'), { side: 'bottom', align: 'start' });
    assert.deepEqual(parsePlacement('top'), { side: 'top', align: 'center' });
    assert.deepEqual(parsePlacement('right-end'), { side: 'right', align: 'end' });
    assert.deepEqual(parsePlacement('sideways-middle'), { side: 'bottom', align: 'center' });
    assert.deepEqual(parsePlacement(), { side: 'bottom', align: 'start' });
  });

  it('opens below the anchor, aligned to its start, offset by 6 px', () => {
    const p = computePlacement({ anchor: rect(100, 100, 80, 32), floating: { width: 200, height: 150 }, viewport: VIEWPORT });
    assert.equal(p.side, 'bottom');
    assert.equal(p.top, 138);
    assert.equal(p.left, 100);
    assert.equal(p.maxHeight, 900 - 132 - 6 - 8);
  });

  it('bottom-end lines the panel up with the anchor’s right edge; top-centre sits centred above', () => {
    const end = computePlacement({ anchor: rect(600, 100, 32, 32), floating: { width: 200, height: 100 }, viewport: VIEWPORT, placement: 'bottom-end' });
    assert.equal(end.left, 632 - 200);
    const top = computePlacement({ anchor: rect(600, 400, 40, 32), floating: { width: 100, height: 30 }, viewport: VIEWPORT, placement: 'top' });
    assert.equal(top.side, 'top');
    assert.equal(top.top, 400 - 6 - 30);
    assert.equal(top.left, 600 + 20 - 50);
  });

  it('flips upwards when there is no room below and more above (a menu near the bottom)', () => {
    const p = computePlacement({ anchor: rect(100, 820, 80, 32), floating: { width: 200, height: 240 }, viewport: VIEWPORT });
    assert.equal(p.side, 'top');
    assert.equal(p.top, 820 - 6 - 240);
  });

  it('does not flip when the other side is even smaller: it stays and caps its height (it scrolls)', () => {
    const p = computePlacement({ anchor: rect(100, 300, 80, 32), floating: { width: 200, height: 800 }, viewport: { width: 800, height: 700 } });
    assert.equal(p.side, 'bottom');
    assert.equal(p.maxHeight, 700 - 332 - 6 - 8);
  });

  it('shifts along the anchor to stay 8 px inside the edges (a menu at the right edge of a phone)', () => {
    const p = computePlacement({ anchor: rect(340, 60, 28, 28), floating: { width: 220, height: 200 }, viewport: { width: 375, height: 812 } });
    assert.equal(p.left, 375 - 8 - 220);
    const left = computePlacement({ anchor: rect(2, 60, 28, 28), floating: { width: 220, height: 200 }, viewport: { width: 375, height: 812 }, placement: 'bottom-end' });
    assert.equal(left.left, 8);
  });

  it('a panel wider than the viewport starts at the padding and is capped by maxWidth', () => {
    const p = computePlacement({ anchor: rect(50, 60, 28, 28), floating: { width: 500, height: 200 }, viewport: { width: 375, height: 812 } });
    assert.equal(p.left, 8);
    assert.equal(p.maxWidth, 375 - 16);
  });

  it('a submenu (right-start) flips to the left when the right has no room; on a phone it overlaps rather than leave the screen', () => {
    const flipped = computePlacement({ anchor: rect(1300, 200, 120, 32), floating: { width: 180, height: 120 }, viewport: VIEWPORT, placement: 'right-start', offset: -4 });
    assert.equal(flipped.side, 'left');
    assert.equal(flipped.left, 1300 + 4 - 180);
    const phone = computePlacement({ anchor: rect(8, 200, 359, 32), floating: { width: 180, height: 120 }, viewport: { width: 375, height: 812 }, placement: 'right-start' });
    assert.ok(phone.left >= 8 && phone.left + 180 <= 375 - 8, `left ${phone.left} leaves the screen`);
  });

  it('never returns a height under 80 px, even squeezed', () => {
    const p = computePlacement({ anchor: rect(10, 10, 20, 20), floating: { width: 100, height: 400 }, viewport: { width: 200, height: 60 } });
    assert.ok(p.maxHeight >= 80);
  });
});

describe('compose: one element, several owners', () => {
  it('cx joins what is truthy', () => {
    assert.equal(cx('a', false, null, undefined, '', 'b', 0, 'c'), 'a b c');
    assert.equal(cx(), '');
  });

  it('mergeRefs sets callback refs and object refs alike; one ref comes back as it is', () => {
    const seen = [];
    const object = { current: null };
    const merged = mergeRefs((node) => seen.push(node), object, null, undefined);
    merged('NODE');
    assert.deepEqual(seen, ['NODE']);
    assert.equal(object.current, 'NODE');
    assert.equal(mergeRefs(object, null), object);
    assert.equal(mergeRefs(null, undefined), null);
  });

  it('composeHandlers runs the caller first, and the kit only when the caller did not preventDefault', () => {
    const calls = [];
    const handler = composeHandlers((e) => calls.push(`theirs:${e.id}`), (e) => calls.push(`ours:${e.id}`));
    handler({ id: 1, defaultPrevented: false });
    handler({ id: 2, defaultPrevented: true });
    assert.deepEqual(calls, ['theirs:1', 'ours:1', 'theirs:2']);
    const ours = () => {};
    assert.equal(composeHandlers(undefined, ours), ours);
    assert.equal(composeHandlers(ours, undefined), ours);
  });

  it('tabbables keeps what Tab can reach: enabled, not tabindex -1, not hidden', () => {
    const el = (tagName, attrs = {}, extra = {}) => ({
      tagName, getAttribute: (k) => (k in attrs ? attrs[k] : null), offsetParent: {}, ...extra,
    });
    const items = [
      el('BUTTON'), el('BUTTON', {}, { disabled: true }), el('A', { tabindex: '-1' }),
      el('INPUT', {}, { type: 'hidden' }), el('DIV', { 'aria-hidden': 'true', tabindex: '0' }),
      el('BUTTON', {}, { offsetParent: null, getClientRects: () => [] }), el('TEXTAREA'),
    ];
    const root = { querySelectorAll: () => items };
    assert.deepEqual(tabbables(root), [items[0], items[6]]);
    assert.deepEqual(tabbables(null), []);
  });
});

describe('hotkeys: which keydown is which shortcut', () => {
  const key = (k, mods = {}) => ({ key: k, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...mods });

  it('parseHotkey reads modifiers and named keys; a lone "+" is the key itself', () => {
    assert.deepEqual(parseHotkey('mod+shift+K'), { key: 'k', mod: true, ctrl: false, meta: false, alt: false, shift: true });
    assert.equal(parseHotkey('Esc').key, 'escape');
    assert.equal(parseHotkey('mod+Enter').key, 'enter');
    assert.equal(parseHotkey('+').key, '+');
    assert.equal(parseHotkey('shift').key, 'shift');
    assert.ok(hasCommandModifier(parseHotkey('mod+k')));
    assert.ok(!hasCommandModifier(parseHotkey('shift+c')));
  });

  it('a letter matches case-blind but Shift must agree: "c" is not Shift+C', () => {
    assert.ok(matchesHotkey(key('c'), 'c'));
    assert.ok(!matchesHotkey(key('C', { shiftKey: true }), 'c'));
    assert.ok(matchesHotkey(key('C', { shiftKey: true }), 'shift+c'));
  });

  it('a symbol is the character typed, whatever Shift it took ("?" is Shift+/ on most keyboards)', () => {
    assert.ok(matchesHotkey(key('?', { shiftKey: true }), '?'));
    assert.ok(matchesHotkey(key('/'), '/'));
    assert.ok(matchesHotkey(key('['), '['));
  });

  it('a bare key never fires with ⌘/Ctrl/Alt held, so ⌘C stays copy', () => {
    assert.ok(!matchesHotkey(key('c', { metaKey: true }), 'c'));
    assert.ok(!matchesHotkey(key('c', { ctrlKey: true }), 'c'));
    assert.ok(!matchesHotkey(key('c', { altKey: true }), 'c'));
  });

  it('`mod` is ⌘ on a Mac and Ctrl elsewhere', () => {
    assert.ok(matchesHotkey(key('Enter', { metaKey: true }), 'mod+Enter', true));
    assert.ok(!matchesHotkey(key('Enter', { ctrlKey: true }), 'mod+Enter', true));
    assert.ok(matchesHotkey(key('Enter', { ctrlKey: true }), 'mod+Enter', false));
    assert.ok(!matchesHotkey(key('Enter', { metaKey: true }), 'mod+Enter', false));
    assert.ok(!matchesHotkey(key('Enter'), 'mod+Enter', false));
  });

  it('named keys need Shift to agree too: Shift+Enter is not Enter', () => {
    assert.ok(matchesHotkey(key('Escape'), 'Escape'));
    assert.ok(!matchesHotkey(key('Enter', { shiftKey: true }), 'Enter'));
  });

  it('isTypingTarget: text inputs, textareas, selects and editable content — not checkboxes or buttons', () => {
    assert.ok(isTypingTarget({ tagName: 'INPUT', type: 'text' }));
    assert.ok(isTypingTarget({ tagName: 'input', type: 'search' }));
    assert.ok(isTypingTarget({ tagName: 'INPUT' }));
    assert.ok(isTypingTarget({ tagName: 'TEXTAREA' }));
    assert.ok(isTypingTarget({ tagName: 'SELECT' }));
    assert.ok(isTypingTarget({ tagName: 'DIV', isContentEditable: true }));
    assert.ok(isTypingTarget({ tagName: 'SPAN', closest: (s) => (s.includes('contenteditable') ? {} : null) }));
    assert.ok(!isTypingTarget({ tagName: 'INPUT', type: 'checkbox' }));
    assert.ok(!isTypingTarget({ tagName: 'BUTTON' }));
    assert.ok(!isTypingTarget(null));
    // A key pressed with nothing focused comes from the window, which has no tagName.
    assert.ok(!isTypingTarget({}));
  });
});

describe('url state: one search param written into the address', () => {
  it('sets, replaces and removes one param and keeps the others in order', () => {
    assert.equal(withSearchParam('', 'view', 'table'), '?view=table');
    assert.equal(withSearchParam('?q=goo&view=board', 'view', 'table'), '?q=goo&view=table');
    assert.equal(withSearchParam('?q=goo&view=board', 'view', null), '?q=goo');
    assert.equal(withSearchParam('?view=board', 'view', ''), '');
    assert.equal(withSearchParam('?view=board', 'view', undefined), '');
    assert.equal(withSearchParam('?a=1', 'n', 0), '?a=1&n=0');
  });

  it('encodes what it writes, so a search with & or = never splits into two params', () => {
    const search = withSearchParam('?view=table', 'q', 'R&D = fun');
    assert.equal(new URLSearchParams(search).get('q'), 'R&D = fun');
    assert.equal(new URLSearchParams(search).get('view'), 'table');
    assert.equal(new URLSearchParams(withSearchParam('', 'status', 'applied,interview')).get('status'), 'applied,interview');
  });
});
