// R4-DVIS-31: in the default 360 px split panel, a signed-in user's editor header showed the account's
// first name beside the avatar (`hidden sm:block` keys on the window, over 640 px beside the panel),
// and the résumé's name, which takes what the row leaves, got ~60 px: 'Software…', or only the
// ellipsis beside a long first name. The editor's header in the split panel now passes AuthBar
// `hideName`, which keeps the first name off the screen at every width (sm:sr-only from sm up, so the
// account button still reads it out as before). Editor-only and the phone layout, whose header spans
// the window, and the workspace top bar and the Dashboard, which also render AuthBar, keep the name.
// The fake DOM has no layout: this pins the classes on the real components, rendered with
// react-dom/server. Fictional data.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { setup, teardown, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const noop = () => {};
const USER = { uid: 'u_alexandra', displayName: 'Alexandra Smith', email: 'alexandra@example.com', photoURL: null };
const auth = { user: USER, authLoading: false, cloudAvailable: true, signInWithGoogle: noop, signOut: noop };
const sync = { syncStatus: 'synced', lastSynced: null, isOnline: true, heldResumes: [] };

/** The classes of the span holding the first name, or null when none is rendered. */
function firstNameClasses(html) {
  const m = /<span class="([^"]*)">Alexandra<\/span>/.exec(html);
  return m ? m[1].split(/\s+/).filter(Boolean) : null;
}

/** The editor header, signed in, in `layoutMode` (the phone layout when `isMobile`). */
async function editorHeader(layoutMode, isMobile = false) {
  const { EditorHeader } = await loadModule('/src/components/EditorHeader.jsx');
  return renderToStaticMarkup(createElement(MemoryRouter, null, createElement(EditorHeader, {
    name: 'Software Engineer CV',
    rename: { editing: false, draft: '', setDraft: noop, commit: noop, cancel: noop, start: noop },
    layoutMode, setLayoutMode: noop, isMobile,
    exportMenu: { exporting: false, importing: false, keeps: false, letterTab: false },
    auth, sync,
  })));
}

it('the editor header in the split panel keeps the account\'s first name off the screen, leaving the résumé name the room', async () => {
  const html = await editorHeader('split');
  assert.ok(html.includes('Software Engineer CV'), 'the header shows the résumé\'s name');
  const cls = firstNameClasses(html);
  assert.ok(cls, 'the account button still carries the first name, for screen readers');
  assert.ok(cls.includes('hidden'), 'off the screen below sm, as before');
  assert.ok(cls.includes('sm:sr-only'), `and from sm up too, where the 360 px panel sits in a wider window: ${cls.join(' ')}`);
});

it('editor-only and the phone layout, whose header spans the window, still show the first name from sm up', async () => {
  for (const [layoutMode, isMobile] of [['editor', false], ['split', true]]) {
    const cls = firstNameClasses(await editorHeader(layoutMode, isMobile));
    assert.ok(cls, `${layoutMode}${isMobile ? ' (phone layout)' : ''}: the first name is there`);
    assert.ok(cls.includes('sm:block'), `${layoutMode}${isMobile ? ' (phone layout)' : ''}: shown from sm up`);
    assert.ok(!cls.includes('sm:sr-only'), `${layoutMode}${isMobile ? ' (phone layout)' : ''}: only the narrow split panel hides it: ${cls.join(' ')}`);
  }
});

it('elsewhere (the workspace top bar, the Dashboard) the account button still shows the first name from sm up', async () => {
  const { default: AuthBar } = await loadModule('/src/components/AuthBar.jsx');
  for (const compact of [true, false]) {
    const cls = firstNameClasses(renderToStaticMarkup(createElement(AuthBar, { ...auth, ...sync, compact })));
    assert.ok(cls, `compact=${compact}: the first name is there`);
    assert.ok(cls.includes('sm:block'), `compact=${compact}: shown from sm up`);
    assert.ok(!cls.includes('sm:sr-only'), `compact=${compact}: only the editor's header hides it`);
  }
});
