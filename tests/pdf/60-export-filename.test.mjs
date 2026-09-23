// An exported file is named after the résumé, not after whoever is signed in (AUD-30).
//
// Every Export-menu download (PDF, Word, JSON, Markdown, ATS text, JSON Resume, and the cover
// letter's PDF and Word) took its file name from buildExportFilename() in
// src/hooks/useEditorExports.js, which put the signed-in account's `displayName` ahead of the
// résumé's own `personal.name`. The résumé's name was only a fallback, and a Google sign-in always
// has a display name, so every file followed the account: the owner's demo account ("Sairam") saved
// "Alex Developer"'s résumé as Sairam_Data_Engineer.pdf, and anyone keeping a CV for someone else,
// or whose Google name differs from the name on the CV, got the wrong name on every file. The ATS
// tab's own "Download .txt" already used the résumé's name, so the same text file was named two ways.
// The file name now comes from the résumé alone: its name (trimmed, 'resume' when blank) and title.
//
// The hook is mounted as Editor.jsx mounts it (react-dom/client through tests/pdf/fake-dom.mjs) and
// every export runs for real, the PDF and Word renders included; only the download link's click() is
// caught, to read the name the browser would save the file under.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, loadModule } from './harness.mjs';
import { mount } from './fake-dom.mjs';

before(setup);
after(teardown);

/** A Google account whose display name is not the name on the résumé. */
const ACCOUNT = { uid: 'u1', email: 'someone@example.com', displayName: 'Google Person' };

const flush = async () => {
  for (let i = 0; i < 5; i += 1) await new Promise((r) => { setImmediate(r); });
};

/**
 * The editor's exports over `r`, signed in as ACCOUNT. Returns `hook` (the live hook result),
 * `downloads` (every file name a download link was clicked with, in order), `tab(name)` (switch
 * the editor tab) and `unmount()`.
 */
async function editorExports(r) {
  const { useEditorExports } = await loadModule('/src/hooks/useEditorExports.js');
  const state = { hook: null };
  function Editor({ resume: data, tab }) {
    state.hook = useEditorExports({ resume: data, activeTab: tab, authUser: ACCOUNT, importResume: () => {}, navigate: () => {} });
    return null;
  }
  const view = mount(Editor, { resume: r, tab: 'resume' });
  const downloads = [];
  const make = view.document.createElement.bind(view.document);
  view.document.createElement = (tag) => {
    const el = make(tag);
    if (String(tag).toLowerCase() === 'a') el.click = () => { downloads.push(el.download); };
    return el;
  };
  return {
    get hook() { return state.hook; },
    downloads,
    tab: (name) => view.update({ resume: r, tab: name }),
    /** Run one export handler to the end and check it did not fail. */
    async run(name) {
      await state.hook[name]();
      await flush();
      assert.equal(state.hook.exportError, null, `${name} failed: ${state.hook.exportError}`);
    },
    unmount: () => view.unmount(),
  };
}

const RESUME_EXPORTS = ['handleExportPDF', 'handleExportWord', 'handleExportJSON', 'handleExportMarkdown', 'handleExportAtsText', 'handleExportJsonResume'];

describe('AUD-30: export file names follow the résumé, not the signed-in account', () => {
  it('all eight Export-menu files carry the résumé\'s name and title', async () => {
    const editor = await editorExports(resume({ personal: { name: 'Alex Developer', title: 'Data Engineer' } }));
    try {
      for (const name of RESUME_EXPORTS) await editor.run(name);
      editor.tab('coverletter');
      await editor.run('handleExportPDF');
      await editor.run('handleExportWord');

      const base = 'Alex_Developer_Data_Engineer';
      assert.deepEqual(editor.downloads, [
        `${base}.pdf`,
        `${base}.docx`,
        `${base}.json`,
        `${base}.md`,
        `${base}_ATS.txt`,
        `${base}_resume.json`,
        `${base}_cover_letter.pdf`,
        `${base}_cover_letter.docx`,
      ]);
      for (const file of editor.downloads) assert.ok(!file.includes('Google_Person'), `${file} is named after the account`);
    } finally {
      await editor.unmount();
    }
  });

  it('a résumé with no name falls back to "resume", never to the account', async () => {
    for (const blank of ['', '   ']) {
      const editor = await editorExports(resume({ personal: { name: blank, title: 'Data Engineer' } }));
      try {
        for (const name of ['handleExportJSON', 'handleExportMarkdown', 'handleExportAtsText', 'handleExportJsonResume']) await editor.run(name);
        assert.deepEqual(editor.downloads, [
          'resume_Data_Engineer.json',
          'resume_Data_Engineer.md',
          'resume_Data_Engineer_ATS.txt',
          'resume_Data_Engineer_resume.json',
        ], `name ${JSON.stringify(blank)}`);
      } finally {
        await editor.unmount();
      }
    }
  });

  it('spaces around the name and title do not become stray underscores', async () => {
    const editor = await editorExports(resume({ personal: { name: '  Alex   Developer ', title: ' Data Engineer  ' } }));
    try {
      await editor.run('handleExportJSON');
      assert.deepEqual(editor.downloads, ['Alex_Developer_Data_Engineer.json']);
    } finally {
      await editor.unmount();
    }
  });

  it('a résumé with no title is named after the person alone', async () => {
    const editor = await editorExports(resume({ personal: { name: 'Alex Developer', title: '' } }));
    try {
      await editor.run('handleExportJSON');
      assert.deepEqual(editor.downloads, ['Alex_Developer.json']);
    } finally {
      await editor.unmount();
    }
  });
});
