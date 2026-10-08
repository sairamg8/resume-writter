// Defect: Documents → Import of a file the reader refuses (an older .doc, a file over 20 MB, a locked PDF)
// says "Could not import <file name>: …". A file name is one unbroken word ("Jane_Doe_Product_Manager_CV_2026_final.doc"),
// and the message sat in a flex item with no `min-w-0` or `break-words`, which cannot shrink below its longest word: on a
// phone it ran past the notice and widened the page. The editor's alerts (EditorAlerts) and the New page already have both.
// Pins: the message's own box can shrink and breaks a long word, and it still carries the file's name.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { patchFakeDom } from '../unit/ui-dom-harness.mjs';
import { reactProps } from './fake-dom.mjs';
import { dashboard, text, until } from './cyc3-dashboard.mjs';

before(async () => {
  patchFakeDom();
  await setup();
  // The document reader, loaded now, as the Dashboard loads it when a file comes.
  await loadModule('/src/utils/importFile.js');
});
after(teardown);

const NAME = `Jane_Doe_Product_Manager_CV_2026_final_${'v'.repeat(60)}.docx`;

it('an import error naming a long file name sits in a box that can shrink and break the word', async () => {
  const page = await dashboard([]);
  try {
    const input = page.all().find((el) => el.tagName === 'INPUT' && el.type === 'file');
    assert.ok(input, 'the Import file input');
    // Over the 20 MB the reader takes: refused before its bytes are read.
    const file = { name: NAME, size: 21 * 1024 * 1024, arrayBuffer: () => Promise.reject(new Error('never read')) };
    page.view.act(() => reactProps(input).onChange({ target: { files: [file], value: '' } }));
    await until(() => page.all().some((el) => el.tagName === 'SPAN' && text(el).startsWith('Could not import')), 'the error');
    const box = page.all().find((el) => el.tagName === 'SPAN' && text(el).startsWith('Could not import'));
    assert.ok(text(box).includes(NAME), 'it names the file');
    const classes = String(reactProps(box).className).split(/\s+/);
    assert.ok(classes.includes('min-w-0'), 'min-w-0: a flex item cannot shrink below its longest word without it');
    assert.ok(classes.includes('break-words'), 'break-words: the file name wraps instead of running past the notice');
  } finally { await page.close(); }
});
