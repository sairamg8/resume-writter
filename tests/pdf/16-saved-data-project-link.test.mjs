// A project's link is `url`: the editor, the PDF, Word and Markdown read it. The JSON Resume import
// stored it as `link`, which nothing prints or edits, so every imported project lost its link (bug
// audit 2026-09-22). The import now writes `url`; a résumé imported before gets its `link` as its
// `url` as it loads (normalizeResume, whatever its data version).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, render, read, allText, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const normalizer = () => loadModule('/src/utils/normalizeResume.js');

/** A résumé an earlier build's JSON Resume import saved: its projects' links under `link`. */
function importedEarlier() {
  const r = resume({ sections: [section('projects', [
    { name: 'Engine', url: undefined, link: 'https://github.com/ada/engine' },
    { name: 'Typed', url: 'ada.dev/typed', link: 'https://old.example.com' },
    { name: 'None', url: '', link: '' },
  ])] });
  r.dataVersion = 11;
  return JSON.parse(JSON.stringify(r));
}

describe('a project link an earlier import stored as `link`', () => {
  it('becomes the project’s url as the résumé loads, whatever its data version', async () => {
    const { normalizeResume } = await normalizer();
    const items = normalizeResume(importedEarlier()).sections[0].items;
    assert.equal(items[0].url, 'https://github.com/ada/engine');
    assert.equal('link' in items[0], false);
    assert.deepEqual([items[1].url, items[1].link], ['ada.dev/typed', 'https://old.example.com'], 'a url of its own is kept');
    assert.deepEqual([items[2].url, items[2].link], ['', ''], 'nothing to move');
  });

  it('prints in the PDF', async () => {
    const { normalizeResume } = await normalizer();
    const text = allText(await read(await render(normalizeResume(importedEarlier()))));
    assert.match(text, /github\.com\/ada\/engine/);
  });

  it('leaves a résumé with no link to move as the same object, and is idempotent', async () => {
    const { normalizeResume } = await normalizer();
    const once = normalizeResume(importedEarlier());
    assert.equal(normalizeResume(once), once);
  });
});
