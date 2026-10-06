// UI rebuild B3 (cluster frame): the one dock on the editor's right. The bar's ATS chip and Design button (and
// ?dock=) open it with Design or ATS, ONE at a time, mounted only while open (so no ATS scan runs while it is
// closed), with Design's single DesignPanel instance and its Undo notices going when it closes, its own scroll
// box that goes back to the top when the dock changes, and the Template state kept by the Editor. The real Editor
// page over the real store (tests/pdf/180-ui-b3-editor-mount.mjs). Opening a dock from the letter switches to
// the Résumé (EDIT-171, EDIT-089's live rule kept: the Resume switch is its negative twin) and picking the
// Cover letter closes an open dock.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { prepare, finish, openEditor, until, sleep, text, attr, reactProps, elements } from './180-ui-b3-editor-mount.mjs';

before(prepare);
after(finish);

const has = (t, id) => t.all().some((el) => attr(el, 'data-testid') === id);
/** The Design panel's instances on screen: each has one "Browse templates" button. */
const designPanels = (t) => t.all().filter((el) => attr(el, 'data-testid') === 'browse-templates').length;
/** The ATS panel's instances on screen: each has one posting box. */
const atsPanels = (t) => t.all().filter((el) => el.tagName === 'TEXTAREA' && attr(el, 'placeholder').startsWith('Paste job posting')).length;
const scrollBoxOf = (t, dockId) => [...elements(t.byTid(dockId))].find((el) => el.tagName === 'DIV' && /\boverflow-y-auto\b/.test(attr(el, 'class')));

describe('the bar opens one dock at a time', () => {
  it('closed: no dock, no panel, one ATS chip and one Design button, and the address has neither', async () => {
    const t = await openEditor();
    try {
      assert.ok(!has(t, 'dock-design') && !has(t, 'dock-ats'));
      assert.equal(designPanels(t), 0, 'the Design panel is not mounted while the dock is closed');
      assert.equal(atsPanels(t), 0, 'the ATS panel is not mounted while the dock is closed');
      for (const id of ['ats-chip', 'design-button']) assert.equal(t.all().filter((el) => attr(el, 'data-testid') === id).length, 1, id);
      assert.equal(t.url(), '/resume/' + t.id);
    } finally { await t.close(); }
  });

  it('the Design button opens the Design dock with ONE DesignPanel, and a second press closes it', async () => {
    const t = await openEditor();
    try {
      const w = await t.measure(() => t.press('design-button'));
      assert.ok(has(t, 'dock-design') && !has(t, 'dock-ats'));
      assert.equal(designPanels(t), 1, 'one DesignPanel instance');
      assert.ok(w.count('designPanel') >= 1, `the panel rendered as it opened. ${w.report()}`);
      assert.equal(t.url(), `/resume/${t.id}?dock=design`);
      assert.equal(atsPanels(t), 0);
      await t.press('design-button');
      assert.ok(!has(t, 'dock-design'));
      assert.equal(designPanels(t), 0, 'the panel is gone with the dock');
      assert.equal(t.url(), `/resume/${t.id}`);
    } finally { await t.close(); }
  });

  it('the ATS chip opens the ATS dock, mounting the panel only while it is open; a second press closes it', async () => {
    const t = await openEditor();
    try {
      await t.press('ats-chip');
      assert.ok(has(t, 'dock-ats') && !has(t, 'dock-design'));
      assert.equal(atsPanels(t), 1);
      assert.equal(t.url(), `/resume/${t.id}?dock=ats`);
      await t.press('ats-chip');
      assert.ok(!has(t, 'dock-ats'));
      assert.equal(atsPanels(t), 0, 'the scan is not mounted once the dock is closed');
    } finally { await t.close(); }
  });

  it('one dock at a time: the chip over an open Design dock replaces it, and the Design button over ATS does too', async () => {
    const t = await openEditor();
    try {
      await t.press('design-button');
      await t.press('ats-chip');
      assert.ok(has(t, 'dock-ats') && !has(t, 'dock-design'));
      assert.equal(designPanels(t), 0, 'the Design panel unmounted');
      assert.equal(atsPanels(t), 1);
      assert.equal(t.all().filter((el) => /^dock-/.test(attr(el, 'data-testid')) && el.tagName === 'ASIDE').length, 1, 'one dock element');
      await t.press('design-button');
      assert.ok(has(t, 'dock-design') && !has(t, 'dock-ats'));
      assert.equal(atsPanels(t), 0);
      assert.equal(designPanels(t), 1);
    } finally { await t.close(); }
  });

  it('?dock=ats in the link opens the ATS dock; the old ?tab=design opens the Design dock', async () => {
    let t = await openEditor({ path: '?dock=ats' });
    try { assert.ok(has(t, 'dock-ats')); assert.equal(atsPanels(t), 1); } finally { await t.close(); }
    t = await openEditor({ path: '?tab=design' });
    try { assert.ok(has(t, 'dock-design')); assert.equal(designPanels(t), 1); assert.equal(t.url(), `/resume/${t.id}?dock=design`); } finally { await t.close(); }
  });

  it('the dock\'s close X (shown below 1100 px) closes it', async () => {
    const t = await openEditor({ path: '?dock=design' });
    try {
      await t.press('dock-close');
      assert.ok(!has(t, 'dock-design'));
      assert.equal(t.url(), `/resume/${t.id}`);
    } finally { await t.close(); }
  });
});

describe('the dock and the document', () => {
  it('opened from the letter, a dock switches to the Résumé: the preview and Export follow the résumé (EDIT-171)', async () => {
    const t = await openEditor({ path: '?tab=coverletter' });
    try {
      assert.equal(t.preview().activeTab, 'coverletter');
      assert.equal(t.header().exportMenu.letterTab, true);
      for (const id of ['design-button', 'ats-chip']) {
        await t.press(id);
        assert.equal(t.preview().activeTab, 'resume', `${id}: the stage shows the résumé`);
        assert.equal(t.header().exportMenu.letterTab, false, `${id}: Export follows the résumé`);
        assert.equal(t.url(), `/resume/${t.id}?dock=${id === 'ats-chip' ? 'ats' : 'design'}`);
        await t.press('doc-switch-letter');
        assert.equal(t.preview().activeTab, 'coverletter');
      }
    } finally { await t.close(); }
  });

  it('picking the Cover letter closes an open dock', async () => {
    for (const id of ['design-button', 'ats-chip']) {
      const t = await openEditor();
      try {
        await t.press(id);
        assert.ok(has(t, 'dock-design') || has(t, 'dock-ats'));
        await t.press('doc-switch-letter');
        assert.ok(!has(t, 'dock-design') && !has(t, 'dock-ats'), `${id}: the dock closed`);
        assert.equal(designPanels(t) + atsPanels(t), 0);
        assert.equal(t.preview().activeTab, 'coverletter');
        assert.equal(t.url(), `/resume/${t.id}?tab=coverletter`);
      } finally { await t.close(); }
    }
  });

  it('negative twin: the Resume switch opens no dock, and from the letter it shows the résumé', async () => {
    const t = await openEditor({ path: '?tab=coverletter' });
    try {
      await t.press('doc-switch-resume');
      assert.equal(t.preview().activeTab, 'resume');
      assert.ok(!has(t, 'dock-design') && !has(t, 'dock-ats'));
      assert.equal(t.url(), `/resume/${t.id}`);
    } finally { await t.close(); }
  });

  it('the Resume switch leaves an open dock open', async () => {
    const t = await openEditor({ path: '?dock=ats' });
    try {
      await t.press('doc-switch-resume');
      assert.ok(has(t, 'dock-ats'));
      assert.equal(t.url(), `/resume/${t.id}?dock=ats`);
    } finally { await t.close(); }
  });
});

describe('what the dock keeps and drops', () => {
  it('its scroll box goes back to the top when the dock changes; opening it leaves the editor panel where it was', async () => {
    const t = await openEditor({ path: '?dock=design' });
    try {
      const box = scrollBoxOf(t, 'dock-design');
      assert.ok(box, 'the dock has a scroll box of its own');
      box.scrollTop = 800;
      const panel = t.all().find((el) => el !== box && /\bmax-md:pb-16\b/.test(attr(el, 'class')) && /\boverflow-y-auto\b/.test(attr(el, 'class')));
      assert.ok(panel, 'the editor panel\'s scroll box');
      panel.scrollTop = 300;
      await t.press('ats-chip');
      assert.equal(scrollBoxOf(t, 'dock-ats').scrollTop, 0, 'ATS opened at its top, not at the offset Design was scrolled to');
      assert.equal(panel.scrollTop, 300, 'the editor panel keeps its scroll');
    } finally { await t.close(); }
  });

  it('Design\'s Template open state is the Editor\'s: closed, it stays closed when the dock closes and opens again', async () => {
    const t = await openEditor({ path: '?dock=design' });
    try {
      assert.equal(t.live.dockProps.design.templateOpen, true);
      t.act(() => t.live.dockProps.design.onTemplateOpenChange(false));
      assert.equal(t.live.dockProps.design.templateOpen, false);
      await t.press('design-button');
      await t.press('design-button');
      assert.ok(has(t, 'dock-design'));
      assert.equal(t.live.dockProps.design.templateOpen, false, 'the Template section is still closed');
    } finally { await t.close(); }
  });

  it('Browse templates in the dock opens the gallery (the Editor\'s, wired from day one)', async () => {
    const t = await openEditor({ path: '?dock=design' });
    try {
      assert.equal(t.live.gallery.open, false);
      const browse = t.all().find((el) => attr(el, 'data-testid') === 'browse-templates');
      t.act(() => reactProps(browse).onClick());
      assert.equal(t.live.gallery.open, true);
    } finally { await t.close(); }
  });

  it('closing the dock dismisses the section reset\'s Undo notice, and the notice stays while the dock is open', async () => {
    const t = await openEditor({ path: '?dock=design', toasts: true });
    try {
      const shown = () => t.body().filter((el) => el.getAttribute('data-toast') !== null).length;
      t.act(() => t.live.toast({ id: 'design-section-reset', title: 'Section style reset', duration: Infinity }));
      await until(() => shown() === 1, 'the notice shows');
      await sleep(300);
      assert.equal(shown(), 1, 'it stays while the dock is open');
      await t.press('design-button');
      await until(() => shown() === 0, 'the Design panel went with the dock and took its Undo notice with it');
    } finally { await t.close(); }
  });

  it('the dock reads the résumé: a setting written in the Design dock reaches the store, one panel instance throughout', async () => {
    const t = await openEditor({ path: '?dock=design' });
    try {
      t.act(() => t.store().updateSetting('fontSize', 11));
      await sleep(50);
      assert.equal(t.store().activeResume.settings.fontSize, 11);
      assert.equal(designPanels(t), 1);
      assert.match(text(t.byTid('dock-design')), /Template/);
    } finally { await t.close(); }
  });
});
