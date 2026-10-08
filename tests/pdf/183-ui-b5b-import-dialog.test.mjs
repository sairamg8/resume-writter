// UI rebuild B5b: Import opens a dialog (ImportDialog.jsx, a lazy chunk): what can be imported, what to check
// afterwards, "Choose a file" (and, in a demo account, "Import as my original"). The file input stays in the
// Dashboard, so picking works as it did; if the dialog's code cannot be had, Import opens the picker at once.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { setup, teardown } from './harness.mjs';
import { elements } from './fake-dom.mjs';
import { patchFakeDom } from '../unit/ui-dom-harness.mjs';
import { cv, dashboard, text, until } from './182-ui-b5a-mount.mjs';

// The demo accounts of this test's build (VITE_DEMO_ACCOUNTS): a made-up one, read when setup() starts Vite.
const DEMO = { uid: 'demo-uid', email: 'demo@example.com', displayName: 'Demo' };
process.env.VITE_DEMO_ACCOUNTS = DEMO.email;

before(async () => {
  patchFakeDom();
  await setup();
});
after(teardown);

const list = () => [cv('resume_a', 'A CV', 1000)];
const dialog = (page) => page.all().find((el) => el.getAttribute('role') === 'dialog' && el.getAttribute('data-state') !== 'closed');
const inDialog = (page, label) => [...elements(dialog(page))].find((el) => el.tagName === 'BUTTON' && text(el) === label);
/** The picker: the Dashboard's hidden file input, whose click is counted. */
function picker(page) {
  const input = page.all().find((el) => el.tagName === 'INPUT' && el.type === 'file');
  assert.ok(input, 'the Dashboard\'s file input');
  const box = { clicks: 0 };
  input.click = () => { box.clicks += 1; };
  return box;
}

it('Import opens the dialog with the types and the check-afterwards note; Cancel closes it and picks nothing', async () => {
  const page = await dashboard(list());
  try {
    const box = picker(page);
    page.press(page.button('Import'));
    await until(() => dialog(page), 'the import dialog');
    const body = text(dialog(page));
    assert.match(body, /Import a file/);
    for (const t of ['PDF', 'Word', 'Markdown', 'Text', 'JSON backup', 'JSON Resume']) assert.match(body, new RegExp(t));
    assert.match(body, /read best-effort: review the result/);
    assert.ok(!/Import as my original/.test(body), 'no original import outside a demo account');
    page.press(inDialog(page, 'Cancel'));
    await page.settle();
    assert.equal(box.clicks, 0, 'nothing picked');
  } finally { await page.close(); }
});

it('Choose a file starts the native picker once and closes the dialog', async () => {
  const page = await dashboard(list());
  try {
    const box = picker(page);
    page.press(page.button('Import'));
    await until(() => dialog(page), 'the import dialog');
    page.press(inDialog(page, 'Choose a file'));
    await page.settle();
    assert.equal(box.clicks, 1, 'the picker opened once');
    await until(() => !dialog(page), 'the dialog closed');
  } finally { await page.close(); }
});

it('a demo account also gets Import as my original, with what it means', async () => {
  const page = await dashboard(list(), { user: DEMO });
  try {
    const box = picker(page);
    page.press(page.button('Import'));
    await until(() => dialog(page), 'the import dialog');
    assert.match(text(dialog(page)), /Your originals come back whenever none of them is left/);
    page.press(inDialog(page, 'Import as my original'));
    assert.equal(box.clicks, 1);
  } finally { await page.close(); }
});

it('with the dialog\'s code unreachable Import opens the picker straight away: no dialog, no reload', async () => {
  const page = await dashboard(list(), { fail: ['import'] });
  try {
    const box = picker(page);
    page.press(page.button('Import'));
    await until(() => box.clicks === 1, 'the picker opened');
    assert.equal(dialog(page), undefined, 'no dialog');
    assert.equal(page.calls.reloads, 0);
  } finally { await page.close(); }
});

it('the dialog is off the start-up path, and the old dropdown is gone', () => {
  const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
  for (const file of ['src/pages/Dashboard.jsx', 'src/components/lazyPiece.jsx']) {
    assert.doesNotMatch(read(file), /^import\s[^;]*from\s+'@\/components\/ImportDialog'/m, `${file} imports the dialog statically`);
  }
  assert.match(read('src/components/lazyPiece.jsx'), /import\('@\/components\/ImportDialog'\)/);
  assert.ok(!existsSync(new URL('../../src/components/ImportMenu.jsx', import.meta.url)), 'ImportMenu.jsx is replaced by the dialog');
});
