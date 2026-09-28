// R4-DVIS-25 (the Header Icon picker's part), with R5-DLG-01 and the picker's R4-DPH-37 / R4-DPH-38
// parts: Personal Info → Choose Icon opened a hand-built modal — a blurred backdrop, a rounded-2xl box
// capped at max-h-[85vh] over a min-h-[220px] grid in a backdrop that did not scroll, a small h3 title,
// a bare ×, a footer that could not wrap, animation classes no stylesheet defines — with no Escape at
// all (pressing it did nothing), and a backdrop that closed on any click reaching it, so selecting the
// search text and releasing beside the box threw the picker away. It is the kit's Dialog at size lg
// now: in a portal, the whole screen below sm and calc(100dvh - 2rem) above, the grid scrolling under
// the search and tabs between the title and a footer that wraps; Escape closes it (not an input
// method's); a click beside it closes it only when the press starts and ends there (also pinned in
// 96-modal-outside-click). It animates out as the kit's dialogs do — Personal Info keeps the field
// while it closes — and each opening still starts fresh, even for the same field.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { setup, teardown, resume, loadModule } from './harness.mjs';
import { mount, reactProps } from './fake-dom.mjs';
import { patchFakeDom } from '../unit/ui-dom-harness.mjs';
import { openModal, classes, label, onPage, openDialog, pressKey, until } from './104-r5-dlg-helpers.mjs';

before(async () => {
  patchFakeDom();
  await setup();
});
after(teardown);

const PATH = '/src/components/HeaderIconPickerModal.jsx';
const SEARCH = 'Search icons (e.g. mail, phone, globe, arrow, star)...';
const picker = (extra = {}) => openModal(PATH, {
  fieldKey: 'email', fieldLabel: 'Email', currentCustomIcon: 'icon:send', onSelectIcon() {}, onPickIconFile() {}, onClearIcon() {}, ...extra,
});

describe('the Header Icon picker is the kit\'s Dialog (R4-DVIS-25)', () => {
  it('is drawn as the other editor dialogs are: a role="dialog" panel in the kit\'s portal, the kit title and close button', async () => {
    const p = await picker();
    try {
      const dialog = p.dialog();
      assert.ok(dialog, 'a role="dialog" panel');
      let layer = dialog;
      while (layer && !layer.hasAttribute?.('data-ui-portal')) layer = layer.parentNode;
      assert.ok(layer, 'in the kit\'s portal layer');
      assert.ok(!p.view.container.contains(dialog), 'at the end of <body>');
      assert.ok(classes(dialog).includes('rounded-lg') && !classes(dialog).includes('rounded-2xl'), classes(dialog).join(' '));
      const title = p.find('H2', 'Select Header Icon');
      assert.ok(title && dialog.contains(title) && classes(title).includes('text-xl'), 'the kit\'s title, an h2');
      assert.ok(label(dialog).includes('Choose a vector icon for Email'), 'the field it is for');
      const close = p.all().find((el) => el.tagName === 'BUTTON' && el.getAttribute('aria-label') === 'Close');
      assert.ok(close && dialog.contains(close), 'the kit\'s close button');
      for (const token of ['backdrop-blur-xs', 'animate-in', 'fade-in']) {
        assert.equal(p.all().find((el) => classes(el).includes(token)), undefined, `no element has ${token}`);
      }
      // Everything it offered is still there.
      for (const text of ['Recommended', 'Style Packs (5)', 'Reset to Default', 'Upload Image', 'Close']) {
        assert.ok(p.all().some((el) => label(el) === text || label(el).startsWith(`${text} (`)), text);
      }
      assert.ok(p.all().some((el) => el.tagName === 'INPUT' && el.getAttribute('type') === 'file'), 'the Upload Image file input');
    } finally { await p.unmount(); }
  });

  it('R5-DLG-01: Escape closes it, from the search box too; an input method\'s Escape does not', async () => {
    const p = await picker();
    try {
      const search = p.all().find((el) => el.tagName === 'INPUT' && el.getAttribute('placeholder') === SEARCH);
      p.view.act(() => reactProps(search).onChange({ target: { value: 'globe' } }));
      pressKey(p.view, search, 'Escape', { keyCode: 229 });
      assert.equal(p.closes(), 0, 'composing: kept open');
      assert.ok(pressKey(p.view, search, 'Escape') > 0, 'the key reaches a handler');
      assert.equal(p.closes(), 1, 'Escape closes it');
    } finally { await p.unmount(); }
  });

  it('R4-DPH-37: it fits the screen that shows — dvh, not 85vh — the grid scrolling under the search, the actions in view', async () => {
    const p = await picker();
    try {
      assert.equal(p.all().find((el) => classes(el).some((t) => /^(max|min)-h-\[\d+(vh|px)\]$/.test(t))), undefined, 'no vh cap, no forced min height');
      const dialog = p.dialog();
      for (const token of ['max-h-[calc(100dvh-2rem)]', 'max-sm:h-dvh', 'max-sm:max-h-dvh']) {
        assert.ok(classes(dialog).includes(token), `the panel has ${token}: ${classes(dialog).join(' ')}`);
      }
      assert.ok(classes(dialog.parentNode).includes('overflow-y-auto'), 'the layer around it scrolls');
      const search = p.all().find((el) => el.tagName === 'INPUT' && el.getAttribute('placeholder') === SEARCH);
      let body = search;
      while (body && body.parentNode !== dialog) body = body.parentNode;
      for (const token of ['overflow-y-auto', 'min-h-0', 'flex-1']) assert.ok(classes(body).includes(token), `the body scrolls (${token})`);
      let strip = search;
      while (strip && strip.parentNode !== body) strip = strip.parentNode;
      assert.ok(classes(strip).includes('sticky') && classes(strip).includes('top-0'), 'the search and tabs stay at the top of the scrolling body');
      const close = p.find('BUTTON', 'Close');
      assert.ok(close && dialog.contains(close) && !body.contains(close), 'Close stays in view, outside the scrolling body');
    } finally { await p.unmount(); }
  });

  it('R4-DPH-38: its actions wrap as one row that never shrinks or breaks a label, Reset held at the start', async () => {
    const p = await picker();
    try {
      const reset = p.find('BUTTON', 'Reset to Default');
      const upload = p.all().find((el) => el.tagName === 'LABEL' && label(el) === 'Upload Image');
      const close = p.find('BUTTON', 'Close');
      assert.ok(reset && upload && close, 'Reset to Default, Upload Image and Close');
      const row = close.parentNode;
      assert.ok(reset.parentNode === row && upload.parentNode === row, 'one row, with no group inside it that cannot wrap');
      assert.ok(classes(row).includes('flex-wrap'), `the row wraps: ${classes(row).join(' ')}`);
      for (const [name, el] of [['Reset', reset], ['Upload Image', upload], ['Close', close]]) {
        for (const token of ['whitespace-nowrap', 'shrink-0']) assert.ok(classes(el).includes(token), `${name} has ${token}: ${classes(el).join(' ')}`);
      }
      assert.ok(classes(reset).includes('mr-auto'), 'Reset stays at the start of the row');
    } finally { await p.unmount(); }
  });
});

describe('from Personal Info: it animates out, and each opening starts fresh (R4-DVIS-25)', () => {
  it('closing keeps the field\'s picker on screen as it fades, then it goes; the same field reopens with an empty search', async () => {
    const { default: PersonalInfoEditor } = await loadModule('/src/components/PersonalInfoEditor.jsx');
    const r = resume({ settings: { contactStyle: 'icon', customContactIcons: {} }, personal: { name: 'Casey Wren', email: 'casey@example.com' } });
    const noop = () => {};
    const view = mount(() => createElement(PersonalInfoEditor, {
      resume: r, personal: r.personal, settings: r.settings, template: r.template, coverLetter: r.coverLetter,
      updatePersonal: noop, toggleFieldVisibility: noop, clearSettings: noop, updateSetting: noop,
    }), {});
    try {
      const button = (text) => onPage(view).find((el) => el.tagName === 'BUTTON' && label(el) === text);
      const search = () => onPage(view).find((el) => el.tagName === 'INPUT' && el.getAttribute('placeholder') === SEARCH);
      view.act(() => reactProps(button('Choose Icon')).onClick());
      assert.ok(openDialog(view), 'the picker opened');
      // The dialog's description line names the field.
      const described = (dialog) => label(onPage(view).find((el) => el.getAttribute('id') === dialog.getAttribute('aria-describedby')));
      const forField = described(openDialog(view));
      assert.match(forField, /^Choose a vector icon for \S/);
      view.act(() => reactProps(search()).onChange({ target: { value: 'octocat' } }));
      view.act(() => reactProps(button('Close')).onClick());
      assert.equal(openDialog(view), null, 'closed');
      const leaving = onPage(view).find((el) => el.getAttribute('role') === 'dialog');
      assert.ok(leaving, 'still on screen, animating out');
      assert.equal(leaving.getAttribute('data-state'), 'closed');
      assert.equal(described(leaving), forField, 'still that field\'s picker, not an empty one');
      await until(view, () => !onPage(view).some((el) => el.getAttribute('role') === 'dialog'));
      assert.equal(onPage(view).find((el) => el.getAttribute('role') === 'dialog'), undefined, 'gone once it has faded');
      view.act(() => reactProps(button('Choose Icon')).onClick());
      assert.ok(openDialog(view), 'open again');
      assert.equal(String(reactProps(search()).value), '', 'the same field\'s picker opens with an empty search');
    } finally { await view.unmount(); }
  });
});
