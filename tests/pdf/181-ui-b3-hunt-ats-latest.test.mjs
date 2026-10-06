// UI rebuild B3 (hunt H1-2, H1-3; round 3 H1-1, H1-3; round 4 H1-1): the ATS dock draws the panel from the résumé after the
// preview's own 250 ms pause, and the panel's buttons wrote from the résumé they were DRAWN with. In the old ATS tab a
// click's write showed in the next render; with the pause the chip stayed and a second "+" within 250 ms read the résumé
// from before the first: two Skills sections when there was none, or the first keyword dropped from the group when there
// was one. The buttons now act on the LATEST résumé (the dock's `getLatest`), and nothing is drawn again by a press: the
// first attempt re-drew the panel on pointerdown, which moved the chips under the pointer between a press and its release
// (the browser then clicks their common ancestor, so the second "+" was dropped). The Classic switch took its snapshot from
// the drawn résumé too, so its Undo undid a change made a moment before. A press here runs the handlers a real one runs:
// the pointer-down ones on the path to the button (capture first, then bubble), then the click, on the element as it was drawn.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { prepare, finish, openEditor, until, sleep, attr, text, reactProps, experience } from './180-ui-b3-editor-mount.mjs';

before(prepare);
after(finish);

// The panel shows the tick on an added keyword for 2 s (a timer of its own that sets state): the page stays mounted until it ran.
const ADDED_TICK_MS = 2000;
const JD = 'Kubernetes Kubernetes Terraform Terraform GraphQL GraphQL';
const DOWN = ['onPointerDownCapture', 'onMouseDownCapture', 'onPointerDown', 'onMouseDown', 'onTouchStart', 'onKeyDownCapture'];
const box = (t) => t.all().find((el) => el.tagName === 'TEXTAREA' && attr(el, 'placeholder').startsWith('Paste job posting'));
const chips = (t) => t.all().filter((el) => el.tagName === 'BUTTON' && attr(el, 'title') === 'Click to add to Skills');
const buttonNamed = (t, name) => t.all().find((el) => el.tagName === 'BUTTON' && text(el) === name);
const skillSections = (t) => t.store().activeResume.sections.filter((s) => s.type === 'skills');

/** The ATS dock open on a posting that names `JD`'s keywords, and the chips the scan lists as missing, as they are drawn. */
async function scanOpen(options) {
  const t = await openEditor({ path: '?dock=ats', ...options });
  await until(() => box(t), 'the ATS dock shows the posting box');
  t.call(box(t), 'onChange', { target: { value: JD } });
  await until(() => chips(t).length >= 2, 'the scan lists the missing keywords');
  const drawn = chips(t);
  return { t, drawn, first: text(drawn[0]), second: text(drawn[1]) };
}

/** Closes the page once the panel's own 2 s tick after a "+" has run (a state set after the unmount would reach a window that is gone). */
async function done(t) {
  await sleep(ADDED_TICK_MS + 100);
  await t.close();
}

/** The press-down handlers on the path from `el` up: the capture ones from the outside in, then the others from the target out. */
function pressDown(t, el) {
  const path = [];
  for (let node = el; node; node = node.parentNode) path.push(node);
  const run = (nodes, names) => { for (const node of nodes) for (const name of names) if (node.nodeType === 1 && reactProps(node)?.[name]) t.call(node, name); };
  run([...path].reverse(), DOWN.filter((n) => n.endsWith('Capture')));
  run(path, DOWN.filter((n) => !n.endsWith('Capture')));
}

/** A tap as drawn: down, then up as a click on the same element. */
function tap(t, el) {
  pressDown(t, el);
  t.call(el, 'onClick');
}

describe('two quick "+" on missing keywords in the ATS dock', () => {
  it('with a skill group: both keywords end up in it, the second does not undo the first', async () => {
    const { t, drawn, first, second } = await scanOpen();
    try {
      tap(t, drawn[0]);
      tap(t, drawn[1]); // the chip as it was drawn: the first tap re-drew nothing under it
      const sections = skillSections(t);
      assert.equal(sections.length, 1);
      const skills = sections[0].items[0].skills;
      assert.ok(skills.includes(first) && skills.includes(second), `the group reads "${skills}"`);
      assert.ok(skills.startsWith('SQL, Excel, Tableau'), 'the skills that were there stay');
    } finally { await done(t); }
  });

  it('with no Skills section: one section is made, holding both keywords', async () => {
    const jobs = experience([{ company: 'Harbor Mutual', role: 'Senior Analyst', description: '<ul><li>Cut the claims backlog by 40%</li></ul>' }]);
    const { t, drawn, first, second } = await scanOpen({ extra: { sections: [jobs] } });
    try {
      assert.equal(skillSections(t).length, 0, 'no Skills section to start with');
      tap(t, drawn[0]);
      tap(t, drawn[1]);
      const sections = skillSections(t);
      assert.equal(sections.length, 1, `${sections.length} Skills sections`);
      const all = sections[0].items.map((i) => i.skills).join(', ');
      assert.ok(all.includes(first) && all.includes(second), `the section reads "${all}"`);
    } finally { await done(t); }
  });

  it('a press draws nothing again under the finger: after a tap, the chips are as they were when the next press goes down', async () => {
    const { t, drawn, first } = await scanOpen();
    try {
      const before = chips(t).map(text);
      tap(t, drawn[0]);
      assert.ok(t.store().activeResume.sections.some((s) => s.type === 'skills' && s.items.some((i) => i.skills.includes(first))), 'the keyword was written');
      pressDown(t, drawn[1]); // the second finger goes down inside the pause
      assert.deepEqual(chips(t).map(text), before, 'no chip left or moved under the finger (the scan reads the new résumé after the pause)');
      t.call(drawn[1], 'onClick');
    } finally { await done(t); }
  });

  it('the list does follow the résumé once the pause has passed (so "nothing was redrawn" above is not vacuous)', async () => {
    const { t, drawn, first } = await scanOpen();
    try {
      tap(t, drawn[0]);
      await until(() => !chips(t).some((el) => text(el) === first), `the added keyword ${first} left the missing list after the pause`);
    } finally { await done(t); }
  });
});

describe('the Classic switch right after another fix in the ATS dock', () => {
  it('its Undo keeps what was written a moment before it: the snapshot is the latest résumé\'s, not the drawn one\'s', async () => {
    const t = await openEditor({ path: '?dock=ats', toasts: true, extra: { template: 'sidebar' } });
    try {
      await until(() => buttonNamed(t, 'Switch to Classic'), 'the layout warning offers Switch to Classic');
      const button = buttonNamed(t, 'Switch to Classic');
      const was = t.store().activeResume.settings.fontSize;
      const written = was === 11 ? 12 : 11;
      t.act(() => t.store().updateSetting('fontSize', written)); // a write inside the pause: the panel is still drawn from the résumé before it
      tap(t, button);
      assert.equal(t.store().activeResume.template, 'classic', 'the switch happened');
      // The notices are drawn in the document's body, outside the page.
      const undo = () => t.body().find((el) => el.tagName === 'BUTTON' && text(el) === 'Undo');
      await until(() => undo(), 'the "Template: Classic" notice shows its Undo');
      t.call(undo(), 'onClick');
      assert.equal(t.store().activeResume.template, 'sidebar', 'Undo brings the template back');
      assert.equal(t.store().activeResume.settings.fontSize, written, `Undo kept the size written before the switch (was ${was}, written ${written})`);
    } finally { await done(t); }
  });
});
