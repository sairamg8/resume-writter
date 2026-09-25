// The Résumé tab's structure actions had no gate test on the real components (R2-158): Add Section,
// a section's title box, its eye, its ⋯ → Delete section (with its confirm), an entry's Add and
// Delete (with its confirm), and a section or an entry dropped on another, which ends in the tab's
// and the section's own onDragEnd (handleSectionDragEnd → updateSections(arrayMove), handleItemDragEnd
// → reorderItems). Each runs on the Résumé tab over the real store (resume-tab.mjs) and is checked in
// what the store then holds, what the tab shows, and what the PDF (= the preview) prints.
// parity/40-structure already pins the store's reorder and hide on every template; the keyboard's
// way through dnd-kit's own sensor is 96-structure-keyboard.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, loadModule, render, read, allText } from './harness.mjs';
import { reactProps } from './fake-dom.mjs';
import { resumeTab } from './resume-tab.mjs';

before(setup);
after(teardown);

/** A fictional pilot's résumé: two jobs, a project, a skill group — in that order. */
const sample = () => resume({
  personal: { name: 'Wren Calloway', title: 'Harbor Pilot' },
  sections: [
    section('experience', [
      { role: 'Lamplighter', company: 'Brightwater Light' },
      { role: 'Ferry Pilot', company: 'Saltmarsh Line' },
    ]),
    section('projects', [{ name: 'Tidewatch' }]),
    section('skills', [{ category: 'Seamanship', skills: 'Knots, Charts' }]),
  ],
});

/** The PDF's text, runs joined, in reading order. */
const printed = async (r) => allText(await read(await render(r)));

/** `words` each print, in this order. */
function printsInOrder(text, words) {
  const at = words.map((w) => text.indexOf(w));
  assert.ok(at.every((i) => i >= 0), `each of ${words.join(', ')} prints: ${text}`);
  assert.deepEqual([...at].sort((a, b) => a - b), at, `${words.join(' → ')} in this order: ${text}`);
}

/** `confirm` answering `answer()`, each question kept in `asked`; restored by the returned function. */
function confirming(answer) {
  const asked = [];
  const saved = globalThis.confirm;
  globalThis.confirm = (question) => { asked.push(question); return answer(); };
  return { asked, restore: () => { if (saved === undefined) delete globalThis.confirm; else globalThis.confirm = saved; } };
}

describe('the Résumé tab: sections (R2-158)', () => {
  it('Add Section → a type: that section at the end, open with its first entry; the picker closes; the PDF prints its title', async () => {
    const tab = await resumeTab(sample());
    let added;
    try {
      tab.click(tab.button('Add Section'));
      tab.click(tab.button('Awards & Honors'));
      added = tab.saved();
      assert.deepEqual(added.sections.map((s) => s.type), ['experience', 'projects', 'skills', 'awards']);
      assert.equal(added.sections[3].title, 'Awards & Honors');
      assert.equal(added.sections[3].items.length, 1, 'with its first, blank entry');
      assert.deepEqual(tab.titles(), ['Professional Experience', 'Projects', 'Skills', 'Awards & Honors']);
      assert.ok(tab.button('Add Award', tab.card('Awards & Honors')), 'open, with its Add button');
      assert.ok(!tab.all().some((el) => el.tagName === 'BUTTON' && el.textContent.trim() === 'Awards & Honors'), 'the picker closed');
    } finally { await tab.close(); }
    assert.match(await printed(added), /awards & honors/i);
  });

  it("a section's title box renames it: the store keeps the new title, the PDF prints it", async () => {
    const tab = await resumeTab(sample());
    let renamed;
    try {
      const box = tab.all().find((el) => el.getAttribute('aria-label') === 'Section title' && el.value === 'Projects');
      tab.view.act(() => reactProps(box).onChange({ target: { value: 'Side Voyages' } }));
      renamed = tab.saved();
      assert.deepEqual(renamed.sections.map((s) => s.title), ['Professional Experience', 'Side Voyages', 'Skills']);
      assert.deepEqual(tab.titles(), ['Professional Experience', 'Side Voyages', 'Skills']);
    } finally { await tab.close(); }
    const text = await printed(renamed);
    assert.match(text, /side voyages/i);
    assert.doesNotMatch(text, /projects/i);
  });

  it("a section's eye hides it and shows it again: the card says Hidden, the PDF leaves it out, then prints as before", async () => {
    const tab = await resumeTab(sample());
    let original;
    let hidden;
    let shown;
    try {
      original = tab.saved();
      tab.click(tab.button('Hide section from resume', tab.card('Projects')));
      hidden = tab.saved();
      assert.equal(hidden.sections[1].visible, false);
      assert.deepEqual(hidden.sections.map((s) => s.visible), [true, false, true], 'only that section');
      assert.match(tab.card('Projects').textContent, /Hidden/);
      tab.click(tab.button('Show section on resume', tab.card('Projects')));
      shown = tab.saved();
      assert.equal(shown.sections[1].visible, true);
      assert.doesNotMatch(tab.card('Projects').textContent, /Hidden/);
    } finally { await tab.close(); }
    const text = await printed(hidden);
    assert.ok(!text.includes('Tidewatch'), 'the hidden section prints nothing of itself');
    assert.doesNotMatch(text, /projects/i);
    printsInOrder(text, ['Lamplighter', 'Seamanship']);
    assert.equal(await printed(shown), await printed(original), 'shown again, it prints as before');
  });

  it('Delete section asks first, naming the section and its entries: Cancel keeps it, OK deletes it; the PDF drops it', async () => {
    const tab = await resumeTab(sample());
    let answer = false;
    const confirm = confirming(() => answer);
    let deleted;
    try {
      const before = tab.saved();
      const deleteFrom = (title) => {
        tab.click(tab.button('Section options', tab.card(title)));
        tab.click(tab.button('Delete section', tab.card(title)));
      };
      deleteFrom('Professional Experience');
      assert.deepEqual(confirm.asked, ['Delete the "Professional Experience" section and its 2 entries?']);
      assert.equal(tab.saved(), before, 'Cancel: nothing changes');
      assert.ok(!tab.all().some((el) => el.tagName === 'BUTTON' && el.textContent.trim() === 'Delete section'), 'the menu closed');
      answer = true;
      deleteFrom('Projects');
      assert.equal(confirm.asked[1], 'Delete the "Projects" section and its 1 entry?');
      deleted = tab.saved();
      assert.deepEqual(deleted.sections.map((s) => s.type), ['experience', 'skills']);
      assert.deepEqual(tab.titles(), ['Professional Experience', 'Skills']);
    } finally { confirm.restore(); await tab.close(); }
    const text = await printed(deleted);
    assert.ok(!text.includes('Tidewatch'));
    printsInOrder(text, ['Lamplighter', 'Ferry Pilot', 'Seamanship']);
  });
});

describe('the Résumé tab: entries (R2-158)', () => {
  it("Add adds a blank entry of the section's type at its end; Delete takes an untouched one at once, and asks first for one with content", async () => {
    const { NEW_ITEM } = await loadModule('/src/components/SectionEditorLeafItems.jsx');
    const tab = await resumeTab(sample());
    let answer = false;
    const confirm = confirming(() => answer);
    let left;
    try {
      const exp = tab.card('Professional Experience');
      tab.click(tab.button('Add Experience', exp));
      const items = tab.saved().sections[0].items;
      assert.equal(items.length, 3);
      const { id, ...fields } = items[2];
      const { id: _blankId, ...blank } = NEW_ITEM.experience();
      assert.match(id, /^exp_/);
      assert.ok(!items.slice(0, 2).some((i) => i.id === id), 'an id of its own');
      assert.deepEqual(fields, blank, 'blank, as Add Experience makes it');
      assert.deepEqual(tab.entries(exp), ['Lamplighter', 'Ferry Pilot', 'New Entry']);

      const deletes = () => tab.all(exp).filter((el) => el.getAttribute('aria-label') === 'Delete entry');
      tab.click(deletes()[2]);
      assert.deepEqual(confirm.asked, [], 'an untouched new entry goes without asking');
      assert.deepEqual(tab.entries(exp), ['Lamplighter', 'Ferry Pilot']);

      const before = tab.saved();
      tab.click(deletes()[1]);
      assert.deepEqual(confirm.asked, ['Delete this entry?']);
      assert.equal(tab.saved(), before, 'Cancel: nothing changes');
      answer = true;
      tab.click(deletes()[1]);
      left = tab.saved();
      assert.deepEqual(left.sections[0].items.map((i) => i.role), ['Lamplighter']);
      assert.deepEqual(tab.entries(exp), ['Lamplighter']);
      assert.deepEqual(left.sections.slice(1), before.sections.slice(1), 'the other sections keep theirs');
    } finally { confirm.restore(); await tab.close(); }
    const text = await printed(left);
    assert.ok(!text.includes('Ferry Pilot'), 'the deleted entry no longer prints');
    printsInOrder(text, ['Lamplighter', 'Tidewatch']);
  });
});

describe('the Résumé tab: a drop ends in its own handlers (R2-158)', () => {
  /** The section's own grip: the first sortable handle in its card (its entries' come after). */
  const sectionGrip = (tab, title) => tab.all(tab.card(title)).find((el) => el.getAttribute('aria-roledescription') === 'sortable');

  it('a section dropped on another takes its place; dropped on itself nothing changes; the PDF prints the new order', async () => {
    const tab = await resumeTab(sample());
    let moved;
    try {
      const [exp, , skills] = tab.saved().sections.map((s) => s.id);
      tab.drop(sectionGrip(tab, 'Skills'), skills, exp);
      moved = tab.saved();
      assert.deepEqual(moved.sections.map((s) => s.type), ['skills', 'experience', 'projects']);
      assert.deepEqual(tab.titles(), ['Skills', 'Professional Experience', 'Projects']);
      tab.drop(sectionGrip(tab, 'Skills'), skills, skills);
      assert.equal(tab.saved(), moved, 'on itself: no change, no edit');
    } finally { await tab.close(); }
    printsInOrder(await printed(moved), ['Seamanship', 'Lamplighter', 'Tidewatch']);
  });

  it("an entry dropped on another takes its place in its section; on itself or on nothing, nothing changes; the PDF prints the new order", async () => {
    const tab = await resumeTab(sample());
    let moved;
    try {
      const exp = tab.card('Professional Experience');
      const [first, second] = tab.saved().sections[0].items.map((i) => i.id);
      const grip = () => tab.all(exp).filter((el) => el.getAttribute('aria-label') === 'Reorder entry')[1];
      const before = tab.saved();
      tab.drop(grip(), second, first);
      moved = tab.saved();
      assert.deepEqual(moved.sections[0].items.map((i) => i.role), ['Ferry Pilot', 'Lamplighter']);
      assert.deepEqual(tab.entries(exp), ['Ferry Pilot', 'Lamplighter']);
      assert.deepEqual(moved.sections.slice(1), before.sections.slice(1), 'the other sections keep their order');
      tab.drop(grip(), first, first);
      tab.drop(grip(), first, null);
      assert.equal(tab.saved(), moved, 'on itself or on nothing: no change, no edit');
    } finally { await tab.close(); }
    printsInOrder(await printed(moved), ['Ferry Pilot', 'Lamplighter', 'Tidewatch']);
  });
});
