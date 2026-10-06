// UI rebuild B4 (cluster alerts-and-phone): the editor's alert strips in the canvas look (States.dc: a soft card with an icon,
// the message and a quiet Dismiss), over the LIVE texts: the amber import notice (after every import), the red export / import
// error (the PDF / Word advice, the three import problems) and the red Not saved (storage full or blocked, with the export-JSON
// advice). The drawn wording and the Open Documents link are parked. EditorAlerts is still a memo leaf: a keystroke renders it zero times.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { prepare, finish, openEditor, loadModule, until, text, attr } from './180-ui-b3-editor-mount.mjs';
import { createElement } from 'react';
import { mount, elements, reactProps } from './fake-dom.mjs';

before(prepare);
after(finish);

const FULL = 'Not saved: browser storage is full. Export JSON to keep a copy, or remove large photos.';
const BLOCKED = 'Not saved: this browser is blocking site storage. Export JSON to keep a copy.';
const PDF_ERROR = 'PDF export failed (boom). Check your connection and try again.';
const IMPORT_FAILED = 'Import failed (bad zip). Check the file and try again.';
const PARSE = 'Could not parse file. Make sure it\'s a valid CPWT-CV or standard JSON Resume (.json).';
const COULD_NOT = 'Could not import notes.pdf: no text in it.';
const SIGNED_OUT = 'You signed out while notes.pdf was being read. It is kept for that account and comes back when it signs in again.';
const NOTICE = 'Imported as a new résumé: the one you had open is unchanged, on the dashboard. Imported from your file as best we could read it. Check the name, the contacts, every section and its dates, and move what landed in the wrong place.';

const classes = (el) => attr(el, 'class').split(/\s+/).filter(Boolean);
const strips = (root) => [...elements(root)].filter((el) => ['alert', 'status'].includes(attr(el, 'role')));
const dismissOf = (strip) => [...elements(strip)].find((el) => el.tagName === 'BUTTON' && el.textContent === 'Dismiss');

describe('the alert strips: canvas look over the live texts', () => {
  async function draw(props) {
    const { EditorAlerts } = await loadModule('/src/components/EditorHeader.jsx');
    return mount(() => createElement(EditorAlerts, { exportError: null, onDismiss: () => {}, persistError: null, importNotice: null, onDismissImport: () => {}, ...props }), {});
  }

  it('the import notice is an amber status card with the live words and a Dismiss', async () => {
    let dismissed = 0;
    const view = await draw({ importNotice: NOTICE, onDismissImport: () => { dismissed += 1; } });
    try {
      const [strip, ...rest] = strips(view.container);
      assert.equal(rest.length, 0);
      assert.equal(attr(strip, 'role'), 'status');
      assert.ok(classes(strip).includes('cv-notice-warn'), `amber: ${classes(strip)}`);
      assert.ok(classes(strip).includes('border'), 'a card with a border');
      assert.ok(!classes(strip).some((c) => /^(text|bg|border)-(amber|red)-/.test(c)), 'no raw palette colours');
      assert.ok(strip.textContent.includes(NOTICE));
      assert.ok(strip.querySelector?.('svg') ?? [...elements(strip)].some((el) => el.tagName.toLowerCase() === 'svg'), 'with an icon');
      view.act(() => reactProps(dismissOf(strip)).onClick());
      assert.equal(dismissed, 1);
    } finally { await view.unmount(); }
  });

  it('every red message keeps its words: the export advice, the three import problems, and Not saved full / blocked', async () => {
    for (const message of [PDF_ERROR, IMPORT_FAILED, PARSE, COULD_NOT, SIGNED_OUT]) {
      let dismissed = 0;
      const view = await draw({ exportError: message, onDismiss: () => { dismissed += 1; } });
      try {
        const [strip] = strips(view.container);
        assert.equal(attr(strip, 'role'), 'alert');
        assert.ok(classes(strip).includes('cv-notice-bad'), `red: ${classes(strip)}`);
        assert.ok(!classes(strip).some((c) => /^(text|bg|border)-(amber|red)-/.test(c)), 'no raw palette colours');
        assert.equal(text(strip).replace(/Dismiss$/, ''), message);
        view.act(() => reactProps(dismissOf(strip)).onClick());
        assert.equal(dismissed, 1, `Dismiss of: ${message}`);
      } finally { await view.unmount(); }
    }
    for (const [reason, message] of [['full', FULL], ['blocked', BLOCKED]]) {
      const view = await draw({ persistError: reason });
      try {
        const [strip] = strips(view.container);
        assert.equal(attr(strip, 'role'), 'alert');
        assert.ok(classes(strip).includes('cv-notice-bad'));
        assert.equal(text(strip), message);
        assert.equal(dismissOf(strip), undefined, 'Not saved has no Dismiss: it goes when a write fits');
        assert.ok(!/Open Documents/.test(strip.textContent), 'the parked link is not built');
      } finally { await view.unmount(); }
    }
  });

  it('all three show together, notice first', async () => {
    const view = await draw({ importNotice: NOTICE, exportError: PDF_ERROR, persistError: 'full' });
    try {
      assert.deepEqual(strips(view.container).map((el) => attr(el, 'role')), ['status', 'alert', 'alert']);
    } finally { await view.unmount(); }
  });
});

// The harness mounts the Editor's bar, the alerts, the tab area, the pill and the dock (not the row's wrapper div):
// the cards on screen are the alert / status elements that carry a cv-notice class (the toast stack is a status too).
const cardsOf = (t) => t.all().filter((el) => ['alert', 'status'].includes(attr(el, 'role')) && classes(el).some((c) => c.startsWith('cv-notice')));
const kindOf = (el) => classes(el).find((c) => c.startsWith('cv-notice'));
/** Whether the Editor's tree (as written) has an element with this title. */
function hasTitle(node, title) {
  if (Array.isArray(node)) return node.some((child) => hasTitle(child, title));
  if (!node || typeof node !== 'object' || !node.props) return false;
  return node.props.title === title || hasTitle(node.props.children, title);
}

describe('in the editor', () => {
  it('an import notice and an export error show and Dismiss clears each; a keystroke renders the alerts zero times', async () => {
    const t = await openEditor();
    try {
      assert.equal(cardsOf(t).length, 0, 'no card to start with');
      t.act(() => t.live.navigate(`/resume/${t.id}`, { state: { importNotice: NOTICE } }));
      await until(() => cardsOf(t).length === 1, 'the notice shows');
      assert.ok(text(cardsOf(t)[0]).includes(NOTICE));
      t.act(() => t.header().exportMenu.setExportError(PDF_ERROR));
      await until(() => cardsOf(t).length === 2, 'the error shows');
      assert.deepEqual(cardsOf(t).map(kindOf), ['cv-notice-warn', 'cv-notice-bad']);
      const w = await t.measure(() => t.typeInSummary());
      assert.equal(w.count('alerts'), 0, `a keystroke renders the alerts. ${w.report()}`);
      t.call(dismissOf(cardsOf(t)[1]), 'onClick');
      await until(() => cardsOf(t).length === 1, 'the error is dismissed');
      assert.deepEqual(cardsOf(t).map(kindOf), ['cv-notice-warn']);
      t.call(dismissOf(cardsOf(t)[0]), 'onClick');
      await until(() => cardsOf(t).length === 0, 'the notice is dismissed');
    } finally { await t.close(); }
  });

  it('on a phone the card shows, and there is no resize handle (there is one on a desktop)', async () => {
    const t = await openEditor();
    try {
      assert.ok(hasTitle(t.live.tree, 'Drag to resize panel'), 'a desktop in split view has the handle');
      t.goPhone();
      await until(() => !hasTitle(t.live.tree, 'Drag to resize panel'), 'the handle goes on a phone');
      t.act(() => t.header().exportMenu.setExportError(PDF_ERROR));
      await until(() => cardsOf(t).length === 1, 'the error shows on a phone');
      assert.equal(kindOf(cardsOf(t)[0]), 'cv-notice-bad');
      assert.ok(text(cardsOf(t)[0]).includes(PDF_ERROR));
    } finally { await t.close(); }
  });
});
