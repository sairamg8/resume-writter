// R5-HUNT9-RESUME-NAME-NOT-TEXT: a native .json's own "name" that is not text. Dashboard → Import takes
// any file with `personal` and a list of `sections`, and store.importResume only runs normalizeResume on
// it, which made every text field text except the record's own name. An object there ({"en": "My CV"})
// reached the editor's header and the dashboard card as a React child: both threw ("Objects are not
// valid as a React child") on every load, and on every device the record synced to, with no card left
// to delete it from. A number (2026) rendered, but Rename threw ("….trim is not a function"). No name
// at all gave a blank card, 'Delete "undefined"?' and 'your résumé "undefined"' on /new.
// Now normalizeResume stores the name as text (a number as its digits), and one with no text in it as
// the name a new record gets: 'Untitled Resume', or 'Cover Letter' for a letter. Mounted with
// react-dom/client over tests/pdf/fake-dom.mjs; fictional data only.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

before(setup);
after(teardown);

/** The file as Dashboard → Import reads it, through the store's import (normalizeResume). */
async function imported(extra) {
  const { normalizeResume } = await loadModule('/src/utils/normalizeResume.js');
  return normalizeResume({ id: 'resume_n', updatedAt: 1, personal: { name: 'Jane Doe' }, sections: [], ...extra });
}

const byTitle = (view, title) => [...elements(view.container)].find((el) => el.getAttribute('title') === title);
const input = (view) => [...elements(view.container)].find((el) => el.tagName === 'INPUT');

/** The dashboard card over `r`: what it shows, and what its Rename box opens on. */
async function card(r) {
  const { ResumeCard } = await loadModule('/src/components/ResumeCard.jsx');
  const view = mount(ResumeCard, { resume: r, onOpen() {}, onDuplicate() {}, onDelete() {}, onRename() {} });
  try {
    const text = view.container.textContent;
    const rename = byTitle(view, 'Rename');
    assert.ok(rename, 'the card has its Rename button');
    view.act(() => reactProps(rename).onClick({ preventDefault() {}, stopPropagation() {}, target: rename, currentTarget: rename }));
    return { text, draft: input(view).value };
  } finally { await view.unmount(); }
}

describe('a résumé record whose own name is not text', () => {
  it('an object: the name a new résumé gets, and the card renders and renames', async () => {
    const r = await imported({ name: { en: 'My CV' } });
    assert.equal(r.name, 'Untitled Resume', 'before: the object, which React refused to render');
    const { text, draft } = await card(r);
    assert.ok(text.includes('Untitled Resume'), text);
    assert.equal(draft, 'Untitled Resume');
  });

  it('a number: its digits, and Rename opens on them', async () => {
    const r = await imported({ name: 2026 });
    assert.equal(r.name, '2026', 'before: 2026, which Rename threw on (….trim is not a function)');
    assert.equal((await card(r)).draft, '2026');
  });

  it('none, blank or a list: text, never "undefined" or a blank card', async () => {
    assert.equal((await imported({})).name, 'Untitled Resume', 'before: undefined');
    assert.equal((await imported({ name: '   ' })).name, 'Untitled Resume');
    assert.equal((await imported({ name: ['My', 'CV'] })).name, 'My, CV');
    assert.equal((await imported({ kind: 'letter', name: null })).name, 'Cover Letter', 'a letter');
  });

  it('a name that is text is kept exactly, and a second load changes nothing', async () => {
    const r = await imported({ name: '  Harbor Pilot CV ' });
    assert.equal(r.name, '  Harbor Pilot CV ');
    const { normalizeResume } = await loadModule('/src/utils/normalizeResume.js');
    const fixed = await imported({ name: { en: 'x' } });
    assert.equal(normalizeResume(fixed), fixed, 'the same object');
  });
});
