// R4-DPH-34: the Cover Letter tab's text fields are 16 px on a touch screen. iOS Safari zooms the page
// into any field it focuses whose text is under 16 px, and every one of the tab's text fields — Date,
// Recipient Name, Recipient Title, Company, Subject, Closing Phrase, Signature Name and Signature
// Designation (CoverLetterPanelShared's Field) — was 14 px (text-sm) with nothing for a touch screen,
// while the letter body beside them (RichTextEditor) was already 16 px there. Field's box now carries
// pointer-coarse:text-base, as the body and the kit's controlClass do; with a mouse it stays 14 px.
// The real panel is rendered to HTML (react-dom/server), as tests/pdf/21-cover-letter-looks-panel
// renders it; there is no layout or media query to measure, so each box's class tokens are checked.
// Run: node --test tests/pdf/103-r4-dph-34-letter-fields-touch-text.test.mjs
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { setup, teardown, resume, loadModule } from './harness.mjs';

before(setup);
after(teardown);

/** Each Field of the tab, by the placeholder it shows for this résumé (the signature's are the name and title). */
const FIELDS = {
  Date: '15 January 2026',
  'Recipient Name': 'Jane Smith',
  'Recipient Title': 'Hiring Manager',
  Company: 'Company name',
  Subject: 'Application for the Senior Engineer role',
  'Closing Phrase': 'Sincerely',
  'Signature Name': 'Pat Sample',
  'Signature Designation': 'Staff Engineer',
};

/** Every `<input>` of `html`: its placeholder and its class tokens. */
const inputsOf = (html) => [...html.matchAll(/<input\b[^>]*>/g)].map(([tag]) => ({
  placeholder: /\splaceholder="([^"]*)"/.exec(tag)?.[1] ?? null,
  tokens: new Set((/\sclass="([^"]*)"/.exec(tag)?.[1] ?? '').split(/\s+/).filter(Boolean)),
}));

it('R4-DPH-34: Date, Recipient, Company, Subject, Closing and Signature are 16 px on a touch screen, 14 px with a mouse', async () => {
  const { default: CoverLetterPanel } = await loadModule('/src/components/CoverLetterPanel.jsx');
  const r = resume({
    template: 'classic',
    personal: { name: 'Pat Sample', title: 'Staff Engineer', email: 'pat@example.com', hiddenFields: [] },
    coverLetter: { body: '<p>Dear Sarah,</p>' },
  });
  const html = renderToString(createElement(CoverLetterPanel, {
    resume: r, coverLetter: r.coverLetter, personal: r.personal, settings: r.settings, template: r.template,
    updateCoverLetter: () => {}, updateSetting: () => {}, clearSettings: () => {},
  }));
  const inputs = inputsOf(html);
  for (const [label, placeholder] of Object.entries(FIELDS)) {
    const box = inputs.find((i) => i.placeholder === placeholder);
    assert.ok(box, `the ${label} box (placeholder "${placeholder}") is on the tab`);
    assert.ok(box.tokens.has('pointer-coarse:text-base'), `the ${label} box is 14 px on a touch screen: iOS zooms the page into it`);
    assert.ok(box.tokens.has('text-sm'), `the ${label} box keeps its 14 px with a mouse`);
    assert.equal(box.tokens.has('text-base'), false, `the ${label} box is 16 px with a mouse too`);
  }
});
