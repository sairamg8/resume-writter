// R4-DPH-25: a demo account's Import on the dashboard is a menu (ImportMenu), and it hung from the
// trigger's right edge (`absolute right-0`, w-64). Below 768 px Import is the first action of the
// header's row, about 100 px wide at the screen's left, so the 256 px menu ran ~140 px off the left of
// the screen: its labels showed only their endings ('…Word or text', '…ginal') and every hint line lost
// its left half. The menu now opens from the trigger's left edge (`left-0`), so it spans the screen
// from x=16 on a phone and still fits beside a desktop header's right-hand actions. The fake DOM has no
// layout, so this pins the class tokens on the real ImportMenu, mounted with react-dom/client over
// tests/pdf/fake-dom.mjs, and checks both items still pick.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { elements, mount, reactProps } from './fake-dom.mjs';

before(setup);
after(teardown);

const tokens = (el) => (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();

it('the Import menu opens from the trigger\'s left edge, so on a phone it does not run off the left of the screen', async () => {
  const { ImportMenu } = await loadModule('/src/components/ImportMenu.jsx');
  const picks = [];
  const view = mount(ImportMenu, { onPick: (keep) => picks.push(keep), className: 'flex items-center gap-1.5' });
  try {
    const all = () => [...elements(view.container)];
    const button = (label) => all().find((el) => el.tagName === 'BUTTON' && text(el) === label);
    const trigger = button('Import');
    assert.ok(trigger, 'the Import trigger');
    view.act(() => reactProps(trigger).onClick({ preventDefault() {}, stopPropagation() {} }));
    assert.equal(trigger.getAttribute('aria-expanded'), 'true', 'Import opens its menu');

    const original = button('Import as my original');
    assert.ok(original, 'the menu offers "Import as my original"');
    const menu = original.parentNode;
    assert.ok(tokens(menu).includes('absolute'), `the menu is the positioned drop-down: ${tokens(menu).join(' ')}`);
    assert.ok(tokens(menu).includes('left-0'), `hung from the trigger's left edge: ${tokens(menu).join(' ')}`);
    assert.ok(!tokens(menu).includes('right-0'), 'not hung from its right edge: the 256 px menu ran ~140 px off a phone\'s left edge');
    const anchor = menu.parentNode;
    assert.ok(tokens(anchor).includes('relative') && anchor.contains(trigger), 'placed against the wrapper that hugs the trigger');
    assert.ok(button('Import JSON, PDF, Word or text'), 'the plain import is in the same menu');

    view.act(() => reactProps(original).onClick({ preventDefault() {}, stopPropagation() {} }));
    assert.deepEqual(picks, [true], 'a pick still opens the file picker, as an original');
  } finally { await view.unmount(); }
});
