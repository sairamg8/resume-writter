// R4-DVIS-07 (New Cover Letter's part), with R5-DLG-04 and its R4-DPH-37 part: Dashboard → New Cover
// Letter (several résumés) opened a hand-built modal — a blurred gray backdrop, a rounded-2xl bordered
// box with a purple Mail badge, a body capped at max-h-[70vh] under a header outside the cap in a
// backdrop that did not scroll (a short landscape phone cut it off), rendered inline in the dashboard
// and without a scroll lock, so wheeling or dragging over it scrolled the résumé grid behind, and the
// user came back somewhere else. It is the kit's Dialog at size md now: in a portal at the end of
// <body>, capped at calc(100dvh - 2rem) in an overlay that scrolls, the body the one scroller, the page
// behind held still (body overflow hidden, put back when it closes), the most recent résumé focused.
// The real modal is mounted over tests/pdf/fake-dom.mjs (104-r5-dlg-helpers.mjs).
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume } from './harness.mjs';
import { reactProps } from './fake-dom.mjs';
import { openModal, classes, label, onPage, pressKey, until } from './104-r5-dlg-helpers.mjs';

before(setup);
after(teardown);

const cv = (id, name, personal, updatedAt) => ({ ...resume({ personal }), id, name, updatedAt });
const sources = () => [
  cv('resume_new', 'Newest CV', { name: 'Sam Rivera', title: 'Analyst' }, 3000),
  cv('resume_old', 'Older CV', { name: 'Jo Park', title: 'Planner' }, 1000),
];

it('R4-DVIS-07: New Cover Letter is the kit\'s Dialog, in a portal, drawn as the other dialogs are, the most recent résumé focused', async () => {
  const picks = [];
  const m = await openModal('/src/components/NewLetterModal.jsx', { sources: sources(), onPick: (id) => picks.push(id) });
  try {
    const dialog = m.dialog();
    assert.ok(dialog, 'a role="dialog" panel');
    let layer = dialog;
    while (layer && !layer.hasAttribute?.('data-ui-portal')) layer = layer.parentNode;
    assert.ok(layer, 'in the kit\'s portal layer, at the end of <body>');
    assert.ok(!m.view.container.contains(dialog));
    assert.ok(classes(dialog).includes('rounded-lg') && classes(dialog).includes('md:max-w-lg'), classes(dialog).join(' '));
    for (const token of ['backdrop-blur-sm', 'rounded-2xl', 'bg-purple-600']) {
      assert.equal(m.all().find((el) => classes(el).includes(token)), undefined, `no element has ${token}`);
    }
    const title = m.find('H2', 'New Cover Letter');
    assert.ok(title && classes(title).includes('text-xl'), 'the kit\'s title');
    assert.ok(label(dialog).includes('Start from a résumé: its name, job title, contacts and photo head the letter.'), 'its description');
    const first = m.all().find((el) => el.tagName === 'BUTTON' && label(el).startsWith('Newest CV'));
    assert.ok(first && m.view.document.activeElement === first, 'the most recently edited résumé has the focus');
    // Escape reaches the dialog from there.
    pressKey(m.view, first, 'Escape');
    assert.equal(m.closes(), 1, 'Escape closes it');
    m.view.act(() => reactProps(m.all().find((el) => el.tagName === 'BUTTON' && label(el).startsWith('Blank letter'))).onClick());
    m.view.act(() => reactProps(first).onClick());
    assert.deepEqual(picks, [null, 'resume_new'], 'Blank letter and a résumé are picked as before');
  } finally { await m.unmount(); }
});

it('R4-DPH-37: it fits the screen that shows — no vh cap — with its list the one scroller', async () => {
  const m = await openModal('/src/components/NewLetterModal.jsx', { sources: sources(), onPick() {} });
  try {
    assert.equal(m.all().find((el) => classes(el).some((t) => /^max-h-\[\d+vh\]$/.test(t))), undefined, 'no box capped in vh');
    const dialog = m.dialog();
    assert.ok(classes(dialog).includes('max-h-[calc(100dvh-2rem)]'), classes(dialog).join(' '));
    assert.ok(classes(dialog.parentNode).includes('overflow-y-auto'), 'the layer around it scrolls');
    let body = m.all().find((el) => el.tagName === 'BUTTON' && label(el).startsWith('Blank letter'));
    while (body && body.parentNode !== dialog) body = body.parentNode;
    for (const token of ['overflow-y-auto', 'min-h-0', 'flex-1']) assert.ok(classes(body).includes(token), `the body scrolls (${token})`);
    assert.equal([...onPage(m.view)].filter((el) => dialog.contains(el) && classes(el).includes('overflow-y-auto')).length, 1, 'one scroll area');
  } finally { await m.unmount(); }
});

it('R5-DLG-04: the page behind is held still while it is open, and let go when it closes', async () => {
  const m = await openModal('/src/components/NewLetterModal.jsx', { sources: sources(), onPick() {} });
  const { body } = m.view.document;
  try {
    assert.equal(body.style.overflow, 'hidden', 'the dashboard behind does not scroll');
    m.view.update({ isOpen: false, sources: sources(), onPick() {}, onClose() {} });
    await until(m.view, () => !m.all().some((el) => el.getAttribute('role') === 'dialog'));
    assert.equal(m.all().find((el) => el.getAttribute('role') === 'dialog'), undefined, 'closed');
    assert.notEqual(body.style.overflow, 'hidden', 'the page scrolls again');
  } finally { await m.unmount(); }
});

// R4-DVIS-07 (review): the picker now stays on screen for its 150 ms exit animation. A double-click on a
// résumé (or Blank letter) reached the second onPick while it closed, and the dashboard, which is still
// showing while the editor's page loads, made two letters. A pick while it closes is ignored.
it('R4-DVIS-07: a double-click picks once: nothing is picked while it animates out', async () => {
  const picks = [];
  const onPick = (id) => picks.push(id);
  const m = await openModal('/src/components/NewLetterModal.jsx', { sources: sources(), onPick });
  const button = (text) => m.all().find((el) => el.tagName === 'BUTTON' && label(el).startsWith(text));
  try {
    m.view.act(() => reactProps(button('Newest CV')).onClick());
    assert.deepEqual(picks, ['resume_new']);
    // The dashboard closes it on the pick (Dashboard.newLetter); it animates out.
    m.view.update({ isOpen: false, sources: sources(), onPick, onClose() {} });
    const closing = m.all().find((el) => el.getAttribute('role') === 'dialog');
    assert.equal(closing?.getAttribute('data-state'), 'closed', 'still on screen while it animates out');
    assert.ok(button('Newest CV') && button('Blank letter'), 'its buttons are still there');
    m.view.act(() => reactProps(button('Newest CV')).onClick());
    m.view.act(() => reactProps(button('Blank letter')).onClick());
    assert.deepEqual(picks, ['resume_new'], 'the second click of a double-click makes no second letter');
  } finally { await m.unmount(); }
});
