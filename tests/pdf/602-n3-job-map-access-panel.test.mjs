// N3 (Job Map access panel): src/components/JobMapAccessPanel.jsx, rendered over tests/pdf/fake-dom.mjs with the
// app's own io (jobMapAccessIo's accessIoOver) on the fake Firestore. An admin sees the addresses (sorted), adds
// one (trimmed, lower-cased, checked, never twice), removes one after a confirm step, cannot remove their own
// address or the last one, and each outcome is a small notice. An account the rules refuse (permission-denied)
// gets nothing drawn, no message, and one read; any other failed read draws a short note with Retry.
// The page loads the panel as a chunk of its own, only once it is open for an account with access.
// Run: node --test tests/pdf/602-n3-job-map-access-panel.test.mjs
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';
import { fakeFirestore } from './fake-firestore.mjs';
import { patchFakeDom } from '../unit/ui-dom-harness.mjs';

// No Firebase in this build, whatever .env holds. Read when setup() starts Vite.
for (const key of ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_APP_ID']) process.env[key] = '';

let Panel;
let accessIoOver;
let AccessPanelSlot;
before(async () => {
  patchFakeDom();
  await setup();
  Panel = (await loadModule('/src/components/JobMapAccessPanel.jsx')).default;
  ({ accessIoOver } = await loadModule('/src/utils/jobMapAccessIo.js'));
  ({ AccessPanelSlot } = await loadModule('/src/pages/JobMap.jsx'));
});
after(teardown);

const settle = async () => { for (let i = 0; i < 15; i += 1) await new Promise((r) => { setImmediate(r); }); };
const all = (view) => [...elements(view.container)];
const buttons = (view, text) => all(view).filter((el) => el.tagName === 'BUTTON' && el.textContent.trim() === text);
const toggle = (view) => all(view).find((el) => el.tagName === 'BUTTON' && el.textContent.startsWith('Job Map access'));
const click = (view, el) => view.act(() => reactProps(el).onClick({ preventDefault() {}, stopPropagation() {} }));
const typeIn = (view, text) => view.act(() => reactProps(all(view).find((el) => el.tagName === 'INPUT')).onChange({ target: { value: text } }));
const submit = async (view) => {
  view.act(() => reactProps(all(view).find((el) => el.tagName === 'FORM')).onSubmit({ preventDefault() {} }));
  await settle();
};
const listed = (view) => all(view).filter((el) => el.tagName === 'LI').map((li) => li.firstChild.textContent);

const seed = (extra = {}) => fakeFirestore({
  'jobmap_access/owner@example.org': { allowed: true },
  'jobmap_access/zed@example.org': { allowed: true, note: 'made in the console' },
  'jobmap_access/amy@example.org': { allowed: true },
  ...extra,
});
const NOW = 1_700_000_000_000;

/** Mounts the panel for `email` over `cloud`, waits for its one read, and opens it. */
async function open(cloud, email = 'Owner@Example.org', { expand = true } = {}) {
  const io = accessIoOver(cloud.fs, cloud.db, () => NOW);
  const view = mount(Panel, { email, io });
  await settle();
  if (expand && toggle(view)) click(view, toggle(view));
  return view;
}

describe('an admin', () => {
  it('sees the count, then the addresses sorted, with their own marked as protected and no remove button on it', async () => {
    const cloud = seed();
    const view = await open(cloud, 'Owner@Example.org', { expand: false });
    try {
      assert.match(toggle(view).textContent, /Job Map access \(3\)/);
      assert.deepEqual(listed(view), [], 'closed until opened');
      click(view, toggle(view));
      assert.deepEqual(listed(view), ['amy@example.org', 'owner@example.org', 'zed@example.org']);
      assert.match(view.container.textContent, /Your address \(protected\)/);
      assert.equal(buttons(view, 'Remove').length, 2, 'a remove button for the two others');
      assert.deepEqual(cloud.reads, ['jobmap_access'], 'one read');
      assert.ok(all(view).some((el) => el.tagName === 'INPUT'), 'the add box');
      assert.match(view.container.textContent, /Add an address/, 'labelled');
    } finally {
      await view.unmount();
    }
  });

  it('adds an address: trimmed and lower-cased, created with allowed and createdAt, listed in order', async () => {
    const cloud = seed();
    const view = await open(cloud);
    try {
      typeIn(view, '  Bob@Example.ORG ');
      await submit(view);
      assert.deepEqual(cloud.doc('jobmap_access/bob@example.org'), { allowed: true, createdAt: NOW });
      assert.deepEqual(listed(view), ['amy@example.org', 'bob@example.org', 'owner@example.org', 'zed@example.org']);
      assert.match(view.container.textContent, /Added bob@example\.org\./);
      assert.equal(all(view).find((el) => el.tagName === 'INPUT') && reactProps(all(view).find((el) => el.tagName === 'INPUT')).value, '', 'the box is empty again');
      assert.deepEqual(cloud.doc('jobmap_access/zed@example.org'), { allowed: true, note: 'made in the console' }, 'other documents keep their fields');
    } finally {
      await view.unmount();
    }
  });

  it('refuses an empty, a malformed and a repeated address with a notice, writing nothing', async () => {
    const cloud = seed();
    const view = await open(cloud);
    try {
      await submit(view);
      assert.match(view.container.textContent, /Enter an e-mail address\./);
      typeIn(view, 'not an address');
      await submit(view);
      assert.match(view.container.textContent, /That does not look like an e-mail address\./);
      typeIn(view, 'AMY@example.org');
      await submit(view);
      assert.match(view.container.textContent, /That address already has access\./);
      assert.deepEqual(cloud.commits.flat(), [], 'nothing written');
      assert.equal(listed(view).length, 3);
    } finally {
      await view.unmount();
    }
  });

  it('refuses a 51st address', async () => {
    const docs = Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`jobmap_access/u${String(i).padStart(2, '0')}@example.org`, { allowed: true }]));
    const cloud = fakeFirestore(docs);
    const view = await open(cloud, 'u00@example.org');
    try {
      typeIn(view, 'one-more@example.org');
      await submit(view);
      assert.match(view.container.textContent, /The list is full \(50 addresses\)\./);
      assert.deepEqual(cloud.commits.flat(), []);
    } finally {
      await view.unmount();
    }
  });

  it('removes an address only after a confirm step; Cancel leaves it', async () => {
    const cloud = seed();
    const view = await open(cloud);
    try {
      click(view, buttons(view, 'Remove')[0]); // amy
      assert.match(view.container.textContent, /Remove this address\?/);
      assert.ok(cloud.doc('jobmap_access/amy@example.org'), 'asking deletes nothing');
      click(view, buttons(view, 'Cancel')[0]);
      assert.doesNotMatch(view.container.textContent, /Remove this address\?/);
      assert.equal(buttons(view, 'Remove').length, 2);
      click(view, buttons(view, 'Remove')[0]);
      click(view, buttons(view, 'Yes, remove')[0]);
      await settle();
      assert.equal(cloud.doc('jobmap_access/amy@example.org'), undefined);
      assert.ok(cloud.doc('jobmap_access/zed@example.org') && cloud.doc('jobmap_access/owner@example.org'), 'only that one');
      assert.deepEqual(listed(view), ['owner@example.org', 'zed@example.org']);
      assert.match(view.container.textContent, /Removed amy@example\.org\./);
    } finally {
      await view.unmount();
    }
  });

  it('cannot remove the last address (when their own is not in the list), and says so without asking', async () => {
    const cloud = fakeFirestore({ 'jobmap_access/amy@example.org': { allowed: true } });
    const view = await open(cloud, 'someone.else@example.org');
    try {
      click(view, buttons(view, 'Remove')[0]);
      assert.match(view.container.textContent, /The last address cannot be removed\./);
      assert.doesNotMatch(view.container.textContent, /Remove this address\?/);
      assert.ok(cloud.doc('jobmap_access/amy@example.org'));
    } finally {
      await view.unmount();
    }
  });

  it('gets an error notice, and the list as it was, when a write fails', async () => {
    const cloud = seed();
    const view = await open(cloud);
    try {
      cloud.fail.commit = Object.assign(new Error('offline'), { code: 'unavailable' });
      click(view, buttons(view, 'Remove')[0]);
      click(view, buttons(view, 'Yes, remove')[0]);
      await settle();
      assert.match(view.container.textContent, /Could not remove amy@example\.org\./);
      assert.equal(listed(view).length, 3);
      typeIn(view, 'new@example.org');
      await submit(view);
      assert.match(view.container.textContent, /Could not add new@example\.org\./);
      assert.equal(listed(view).length, 3);
    } finally {
      await view.unmount();
    }
  });
});

describe('an account the rules refuse', () => {
  it('gets nothing drawn and no message, after one read', async () => {
    const cloud = seed();
    cloud.auth = 'plain-account'; // permission-denied on jobmap_access, as firestore.rules answers a non-admin
    const view = await open(cloud, 'plain@example.org');
    try {
      assert.equal(view.container.childNodes.length, 0, 'no element at all');
      assert.equal(view.container.textContent, '');
      assert.equal(cloud.reads.length, 1, 'one read, no retry, no other call');
    } finally {
      await view.unmount();
    }
  });
});

describe('a read that failed for another reason', () => {
  it('shows a short note with Retry, and Retry asks again', async () => {
    const cloud = seed();
    cloud.fail.read = Object.assign(new Error('Failed to get documents from server.'), { code: 'unavailable' });
    const view = await open(cloud, 'Owner@Example.org', { expand: false });
    try {
      assert.match(view.container.textContent, /Could not check the Job Map access settings\./);
      assert.doesNotMatch(view.container.textContent, /amy@example\.org/);
      assert.equal(cloud.reads.length, 1);
      cloud.fail.read = null;
      click(view, buttons(view, 'Retry')[0]);
      await settle();
      assert.equal(cloud.reads.length, 2);
      assert.match(toggle(view).textContent, /Job Map access \(3\)/);
      assert.doesNotMatch(view.container.textContent, /Could not check/);
    } finally {
      await view.unmount();
    }
  });
});

describe('the page loads the panel as a chunk of its own', () => {
  it('draws the panel once its chunk has loaded, with the account\'s address, and nothing if the chunk fails', async () => {
    const seen = [];
    const Stub = (props) => { seen.push(props.email); return createElement('i', null, 'panel'); };
    const view = mount(AccessPanelSlot, { email: 'a@example.org', load: () => Promise.resolve({ default: Stub }) });
    try {
      await settle();
      assert.equal(view.container.textContent, 'panel');
      assert.equal(seen.at(-1), 'a@example.org');
    } finally {
      await view.unmount();
    }
    const failed = mount(AccessPanelSlot, { email: 'a@example.org', load: () => Promise.reject(new Error('chunk failed to load')) });
    try {
      await settle();
      assert.equal(failed.container.textContent, '');
    } finally {
      await failed.unmount();
    }
  });

  it('only JobMap.jsx reaches it, by a dynamic import: no start-up file imports the panel or the access calls', () => {
    const root = new URL('../../', import.meta.url).pathname;
    const files = readdirSync(join(root, 'src'), { recursive: true }).filter((f) => /\.jsx?$/.test(f)).map((f) => join('src', f));
    const importers = (re) => files.filter((f) => re.test(readFileSync(join(root, f), 'utf8')));
    const staticImport = (name) => new RegExp(`^\\s*(?:import|export)\\b[^;]*from\\s+['"][^'"]*${name}['"]`, 'm');
    assert.deepEqual(importers(staticImport('JobMapAccessPanel')), [], 'never a static import');
    assert.deepEqual(importers(/import\(\s*['"]@\/components\/JobMapAccessPanel['"]\s*\)/), [join('src', 'pages', 'JobMap.jsx')]);
    assert.deepEqual(importers(staticImport('jobMapAccessIo')), [join('src', 'components', 'JobMapAccessPanel.jsx')]);
    const page = readFileSync(join(root, 'src/pages/JobMap.jsx'), 'utf8');
    assert.match(page, /<AccessPanelSlot email=\{auth\.user\.email\} \/>/, 'drawn in the page body, after the guards that send a refused account away');
    assert.ok(page.indexOf('<AccessPanelSlot') > page.indexOf("allowed === 'failed') return"), 'only for an account with access');
  });
});
