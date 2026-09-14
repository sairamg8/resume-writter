// Template headers: the header rule and the header controls, checked on real PDFs.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { setup, teardown, resume, render, read, drawState } from './harness.mjs';

before(setup);
after(teardown);

const ACCENT = '#e11d48';
const PERSONAL = {
  email: 'alex@example.com', phone: '+1 555 0100', location: 'San Francisco, CA',
  website: 'alexjohnson.dev', linkedin: 'linkedin.com/in/alexj', github: 'github.com/alexj',
  summary: '<p>An experienced engineer.</p>',
};

/**
 * Page 1 as drawn: every operator with its arguments (numbers to 0.01 pt, per-document
 * font/image ids made neutral). Two renders are equal exactly when they print the same.
 */
async function drawing(bytes) {
  const doc = await pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, verbosity: 0 }).promise;
  const ops = await (await doc.getPage(1)).getOperatorList();
  const neutral = (_, v) => (typeof v === 'number' ? Math.round(v * 100) / 100
    : typeof v === 'string' ? v.replace(/_d\d+_/g, '_d_') : v);
  const out = ops.fnArray.map((fn, k) => `${fn} ${JSON.stringify(ops.argsArray[k], neutral)}`).join('\n');
  await doc.loadingTask.destroy();
  return out;
}

const drawn = async (template, settings) =>
  drawing(await render(resume({ template, personal: PERSONAL, settings: { accentColor: ACCENT, ...settings } })));

/**
 * Every control Header Customization shows for Classic, Minimal and Executive, as
 * [label, settings it starts from, settings the control sets].
 */
const HEADER_CONTROLS = [
  ['Text Alignment: Center', {}, { headerAlign: 'center' }],
  ['Name & Title Layout: Inline', {}, { headerLayout: 'inline' }],
  ['Name & Title Spacing', { headerLayout: 'inline' }, { headerLayout: 'inline', headerInlineGap: 24 }],
  ['Header Bottom Border', { showHeaderBorder: false }, { showHeaderBorder: true }],
  ['Border Thickness', { showHeaderBorder: true }, { showHeaderBorder: true, headerBorderWidth: 6 }],
  ['Contact Layout: Single', {}, { contactLayout: 'single' }],
  ['Contact Layout: 2 Grid', {}, { contactLayout: '2grid' }],
  ['Contact Style: Bullet', {}, { contactStyle: 'bullet' }],
  ['Contact Style: Bar', {}, { contactStyle: 'bar' }],
  ['Icon set: Classic', {}, { iconSet: 'lucide' }],
  ['Icon set: Bold', {}, { iconSet: 'bold' }],
  ['Icon size', {}, { iconSize: 16 }],
];

describe('header controls', () => {
  it('a résumé rendered twice draws the same page (the comparison below is sound)', async () => {
    assert.equal(await drawn('executive', {}), await drawn('executive', {}));
  });

  for (const template of ['executive', 'classic', 'minimal']) {
    it(`${template}: every Header Customization control changes the PDF (FIDA-50, FIDA-20)`, async () => {
      const unchanged = [];
      for (const [label, from, to] of HEADER_CONTROLS) {
        if (await drawn(template, from) === await drawn(template, to)) unchanged.push(label);
      }
      assert.deepEqual(unchanged, [], `controls with no effect on the ${template} PDF`);
    });
  }
});

/** Does the header print its accent rule? No sections and no contacts: the rule is the only accent stroke. */
async function headerRule(template, settings) {
  const pages = await read(await render(resume({ template, settings: { accentColor: ACCENT, ...settings } })));
  return pages[0].strokes.has(ACCENT);
}

describe('header rule', () => {
  it('executive: no rule unless the toggle turns it on — not for older résumés without the setting (FIDA-18)', async () => {
    assert.equal(await headerRule('executive', { showHeaderBorder: undefined }), false, 'unset');
    assert.equal(await headerRule('executive', { showHeaderBorder: false }), false, 'off');
    assert.equal(await headerRule('executive', { showHeaderBorder: true }), true, 'on');
  });

  it('minimal: the Header Bottom Border toggle draws the rule; unset stays off (FIDA-20)', async () => {
    assert.equal(await headerRule('minimal', { showHeaderBorder: undefined }), false, 'unset');
    assert.equal(await headerRule('minimal', { showHeaderBorder: false }), false, 'off');
    assert.equal(await headerRule('minimal', { showHeaderBorder: true }), true, 'on');
  });

  it('classic: an unset setting keeps the rule (the Classic design), the toggle still turns it off', async () => {
    assert.equal(await headerRule('classic', { showHeaderBorder: undefined }), true, 'unset');
    assert.equal(await headerRule('classic', { showHeaderBorder: false }), false, 'off');
  });
});

describe('modern banner summary (FIDB-11)', () => {
  const SUMMARY = '<p>SumPlain <strong>SumBold</strong></p><ul><li>SumItem</li></ul>';

  it('prints at 85% of the header text colour, however the colour is written', async () => {
    const cases = [
      ['#ffffff', '#ffffff'], ['#fff', '#ffffff'], ['#FFF', '#ffffff'], ['#FFFFFF', '#ffffff'], ['white', '#ffffff'],
      ['rgb(255,255,255)', '#ffffff'], ['#1e293b', '#1e293b'], ['#F8FAFC', '#f8fafc'],
    ];
    for (const [headerTextColor, fill] of cases) {
      const bytes = await render(resume({ template: 'modern', personal: { summary: SUMMARY }, settings: { headerTextColor } }));
      for (const word of ['SumPlain', 'SumBold', 'SumItem']) {
        const hits = await drawState(bytes, word);
        assert.equal(hits.length, 1, `${headerTextColor}: "${word}" drawn once`);
        assert.equal(hits[0].fill, fill, `${headerTextColor}: "${word}" in the header text colour`);
        assert.ok(Math.abs(hits[0].alpha - 0.85) < 0.005, `${headerTextColor}: "${word}" at alpha ${hits[0].alpha}`);
      }
    }
  });

  it('a header text colour with its own alpha keeps it, times 85% (as CSS opacity would)', async () => {
    const bytes = await render(resume({ template: 'modern', personal: { summary: SUMMARY }, settings: { headerTextColor: 'rgba(255,255,255,0.5)' } }));
    const [hit] = await drawState(bytes, 'SumPlain');
    assert.ok(Math.abs(hit.alpha - 0.425) < 0.005, `alpha ${hit.alpha}`);
  });
});
