// R2-145 / R2-140: the Privacy page said every piece of content syncs and is restored after the
// browser's storage is cleared, while the Job Tracker's jobs and the boards never left
// localStorage. They sync now (collectionSyncEngine.js), and the page says exactly what syncs —
// résumés, jobs and boards — and that signing out takes them off the browser. A job or a project
// the cloud will not take (over Firestore's 1 MiB document limit) is held back on its own, and the
// board pages and the Job Tracker name it (SyncHeldNotice) instead of letting it look synced.
// Rendered through Vite's loader (tests/pdf/harness.mjs) with react-dom/server.
import { before, after, afterEach, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { setup, teardown, loadModule } from './harness.mjs';

let PrivacyPage;
let Boards;
let SyncHeldNotice;
let syncHeld;
let boardStore;
before(async () => {
  await setup();
  PrivacyPage = (await loadModule('/src/pages/PrivacyPage.jsx')).default;
  ({ Boards } = await loadModule('/src/pages/Boards.jsx'));
  ({ SyncHeldNotice } = await loadModule('/src/components/SyncHeldNotice.jsx'));
  ({ syncHeld } = await loadModule('/src/utils/collectionSyncMeta.js'));
  boardStore = await loadModule('/src/hooks/useBoardStore.js');
});
after(teardown);
afterEach(() => {
  syncHeld.set('jobs', []);
  syncHeld.set('boards', []);
  delete globalThis.localStorage;
});

/** Visible text of `markup`: inline tags dropped, the rest a space, spaces collapsed. */
const text = (markup) => markup.replace(/<\/?(strong|em|a|span)\b[^>]*>/g, '').replace(/<[^>]+>/g, ' ').replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ');

const at = (path, element) => renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [path] },
  createElement(Routes, null, createElement(Route, { path, element }))));

it('the Privacy page names what syncs with an account — résumés, jobs and boards — and no more', () => {
  const page = text(at('/privacy', createElement(PrivacyPage)));
  assert.doesNotMatch(page, /all content you enter into CPWT-CV, synced/i, 'the old claim that everything syncs');
  assert.match(page, /Resume data: your résumés, synced to Firebase Firestore/);
  assert.match(page, /Job Tracker data: your jobs[^.]*synced the same way/);
  assert.match(page, /Boards: your projects[^.]*synced the same way/);
  assert.match(page, /sync your résumés, jobs and boards across devices/);
  // Without an account, all three stay in this browser.
  assert.match(page, /résumés[^.]*the Job Tracker's jobs, and your boards — is stored exclusively in your browser's localStorage/);
  // Signing out takes them off the browser; what is added signed out stays local until the next sign-in.
  assert.match(page, /When you sign out, your résumés, jobs and boards are removed from this browser/);
  assert.match(page, /Anything you add while signed out stays in this browser only/);
});

it('a project the cloud holds back is named on the board pages; none held, no notice', () => {
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {}, key: () => null, length: 0 };
  boardStore._resetBoardStoreForTest();
  const grid = () => text(at('/boards', createElement(Boards)));
  assert.doesNotMatch(grid(), /too large to sync/);
  syncHeld.set('boards', [{ id: 'board_big', name: 'Kitchen refit' }]);
  assert.match(grid(), /This project is too large to sync to your account and stays on this device only: Kitchen refit\./);
});

it('the jobs the cloud holds back are named, each of them', () => {
  const notice = () => text(renderToStaticMarkup(createElement(SyncHeldNotice, { name: 'jobs' })));
  assert.equal(notice().trim(), '');
  syncHeld.set('jobs', [{ id: 'j1', name: 'Northwind — Analyst' }, { id: 'j2', name: 'Contoso — Designer' }]);
  assert.match(notice(), /These jobs are too large to sync to your account and stay on this device only: Northwind — Analyst, Contoso — Designer\./);
  // The boards' notice is its own: a held job does not show on the board pages.
  assert.equal(text(renderToStaticMarkup(createElement(SyncHeldNotice, { name: 'boards' }))).trim(), '');
});
