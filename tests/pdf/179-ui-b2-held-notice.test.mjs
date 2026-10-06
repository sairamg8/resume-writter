// UI redesign B2 (cluster account): the held-items notice (SyncHeldNotice) in the canvas look. It is the
// canvas's warning notice (.cv-notice-warn), not the old amber utility classes, and keeps its words, its
// role="status", the named items and the className that places it in the page's column.
import { before, after, afterEach, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { setup, teardown, loadModule } from './harness.mjs';

after(teardown);

let syncHeld;
let SyncHeldNotice;
// One hook: the modules load through the Vite instance setup() starts (two separate before hooks left loadModule with none).
before(async () => {
  await setup();
  ({ syncHeld } = await loadModule('/src/utils/collectionSyncMeta.js'));
  ({ SyncHeldNotice } = await loadModule('/src/components/SyncHeldNotice.jsx'));
});
afterEach(() => { syncHeld.set('jobs', []); syncHeld.set('boards', []); });

const render = (name) => renderToStaticMarkup(createElement(SyncHeldNotice, { name, className: 'mb-3' }));

it('names the held jobs in a .cv-notice-warn strip, in the page\'s own column', () => {
  assert.equal(render('jobs'), '', 'nothing held: nothing shown');
  syncHeld.set('jobs', [{ id: 'j1', name: 'Northwind — Analyst' }]);
  const html = render('jobs');
  assert.match(html, /^<div class="mb-3"><p role="status" class="[^"]*\bcv-notice-warn\b/);
  assert.ok(!/amber|bg-|border-/.test(html), `no legacy colour classes: ${html}`);
  assert.match(html.replace(/<[^>]*>/g, ''), /^This job is too large to sync to your account and stays on this device only: Northwind — Analyst\. Make it smaller/);
});

it('says "These projects ... stay" for several held boards, naming each', () => {
  syncHeld.set('boards', [{ id: 'b1', name: 'Kitchen refit' }, { id: 'b2', name: 'Garden' }]);
  const text = render('boards').replace(/<[^>]*>/g, '');
  assert.match(text, /^These projects are too large to sync to your account and stay on this device only: Kitchen refit, Garden\. Make them smaller/);
  assert.match(render('boards'), /\bcv-notice-warn\b/);
});
