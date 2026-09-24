// The Export menu says what each item exports (R2-131). On the Cover Letter tab, PDF and Word export
// the letter, while Markdown, ATS Text and JSON Resume export the résumé — and the menu read the same
// on both tabs, so "Export ATS Text (.txt)" on the letter tab silently downloaded the résumé's text.
// The letter tab's menu now names the letter on PDF and Word and the résumé on the text exports, and
// offers the letter's own plain text (generateCoverLetterPlainText); the résumé tab's menu is unchanged.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const noop = () => {};
const HANDLERS = {
  onExportLetterText: noop, onExportPDF: noop, onExportWord: noop, onExportJSON: noop, onExportMarkdown: noop,
  onExportAtsText: noop, onExportJsonResume: noop, onImportJSON: noop, onImportError: noop,
};

/** The open menu's item labels, the Export toggle itself left out. */
async function menuLabels(props) {
  const { ExportDropdown } = await loadModule('/src/components/ExportDropdown.jsx');
  const { mount, elements, reactProps } = await import('./fake-dom.mjs');
  const view = mount(ExportDropdown, { exporting: null, ...HANDLERS, ...props });
  try {
    const buttons = () => [...elements(view.container)].filter((el) => el.tagName === 'BUTTON');
    view.act(() => reactProps(buttons()[0]).onClick());
    return buttons().slice(1).map((b) => b.textContent.replace(/\s+/g, ' ').trim());
  } finally {
    await view.unmount();
  }
}

describe('the Export menu names what each item exports (R2-131)', () => {
  it('on the Cover Letter tab: PDF and Word name the letter; Markdown, ATS Text and JSON Resume the résumé', async () => {
    const labels = await menuLabels({ letter: true });
    assert.deepEqual(labels.slice(0, 6), [
      'Export Cover Letter PDF',
      'Export Cover Letter Word',
      'Export Cover Letter Text (.txt)',
      'Export Résumé as Markdown (.md)',
      'Export Résumé as ATS Text (.txt)',
      'Export Résumé as JSON Resume (.json)',
    ]);
  });

  it('on the résumé tab the menu reads as before', async () => {
    const labels = await menuLabels({});
    assert.deepEqual(labels.slice(0, 5), ['Export PDF', 'Export Word', 'Export Markdown (.md)', 'Export ATS Text (.txt)', 'Export JSON Resume (.json)']);
    assert.ok(!labels.some((l) => l.includes('Cover Letter')), labels.join(' / '));
  });

  it('useEditorExports tells the menu which tab it exports from', async () => {
    const { useEditorExports } = await loadModule('/src/hooks/useEditorExports.js');
    const { mount } = await import('./fake-dom.mjs');
    const seen = {};
    function Harness({ activeTab }) {
      seen[activeTab] = useEditorExports({ resume: { personal: {}, sections: [] }, activeTab, authUser: null, importResume: noop, navigate: noop }).letterTab;
      return null;
    }
    for (const tab of ['resume', 'coverletter']) {
      const view = mount(Harness, { activeTab: tab });
      await view.unmount();
    }
    assert.deepEqual(seen, { resume: false, coverletter: true });
  });

  it('the editor header passes that to the menu', async () => {
    const fs = await import('node:fs');
    const src = fs.readFileSync(new URL('../../src/components/EditorHeader.jsx', import.meta.url), 'utf8');
    assert.match(src, /<ExportDropdown[\s\S]*?letter=\{exportMenu\.letterTab\}[\s\S]*?\/>/);
  });

  it('the Cover Letter Text item downloads the letter, not the résumé', async () => {
    const { useEditorExports } = await loadModule('/src/hooks/useEditorExports.js');
    const { mount } = await import('./fake-dom.mjs');
    let hook;
    function Harness() {
      hook = useEditorExports({ resume: LETTER_RESUME, activeTab: 'coverletter', authUser: null, importResume: noop, navigate: noop });
      return null;
    }
    const saved = { URL: globalThis.URL };
    const files = [];
    globalThis.URL = Object.assign(Object.create(URL), { createObjectURL: (blob) => { files.push(blob); return 'blob:x'; }, revokeObjectURL: noop });
    const view = mount(Harness, {});
    try {
      const realCreate = view.document.createElement.bind(view.document);
      view.document.createElement = (tag) => Object.assign(realCreate(tag), { click: noop });
      await view.act(() => { hook.handleExportLetterText(); });
      for (let i = 0; i < 10; i += 1) await new Promise((r) => { setImmediate(r); });
      assert.equal(hook.exportError, null);
      assert.equal(files.length, 1, 'one file downloaded');
      const text = await files[0].text();
      assert.match(text, /Dear Hiring Team/);
      assert.ok(!text.includes('Staffengineer'), 'no résumé content');
    } finally {
      await view.unmount();
      globalThis.URL = saved.URL;
    }
  });
});

const LETTER_RESUME = {
  personal: { name: 'Pat Sample', title: 'Engineer', email: 'pat@example.com', phone: '+1 555 0100', hiddenFields: [] },
  settings: { dateFormat: 'MM/YYYY' },
  sections: [{ id: 's', type: 'experience', title: 'Work', items: [{ id: 'i', role: 'Staffengineer', company: 'Acme' }] }],
  coverLetter: {
    date: '2026-01-15', recipientName: 'Jordan Reader', recipientTitle: 'Head of Hiring', company: 'Acme Corp',
    subject: 'Re: Staff Engineer', hiddenFields: ['phone'],
    body: '<p>Dear Hiring Team,</p><p>I build <strong>reliable</strong> systems.<br>Second line.</p><ul><li>Led five teams</li><li>Cut costs</li></ul><p>Thank you.</p>',
    closing: 'Best regards', signatureName: 'Pat Sample', signatureDesignation: 'Staff Engineer',
  },
};

describe('the cover letter as plain text (R2-131)', () => {
  it('prints what the letter prints, in its order, with its hidden contacts left out and its date in the Date format', async () => {
    const { generateCoverLetterPlainText } = await loadModule('/src/utils/coverLetterText.js');
    assert.equal(generateCoverLetterPlainText(LETTER_RESUME), [
      'Pat Sample', 'Engineer', 'pat@example.com', '',
      '15/01/2026', '',
      'Jordan Reader', 'Head of Hiring', 'Acme Corp', '',
      'Re: Staff Engineer', '',
      'Dear Hiring Team,', '',
      'I build reliable systems.', 'Second line.', '',
      '- Led five teams', '- Cut costs', '',
      'Thank you.', '',
      'Best regards,', 'Pat Sample', 'Staff Engineer',
    ].join('\n'));
    assert.equal(generateCoverLetterPlainText(null), '');
  });

  it('an empty letter prints the letterhead, the closing and the signature, no blank body', async () => {
    const { generateCoverLetterPlainText } = await loadModule('/src/utils/coverLetterText.js');
    const out = generateCoverLetterPlainText({ personal: { name: 'Pat Sample' }, coverLetter: { body: '<p><br></p>' } });
    assert.equal(out, 'Pat Sample\n\nSincerely,\nPat Sample');
  });
});
