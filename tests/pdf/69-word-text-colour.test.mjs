// Word's section bodies print in the colours the PDF prints them in — Design → Text Color's shades,
// and the accent where the PDF uses it (R2-063). Word printed descriptions in a fixed #374151, the
// company, role, skills and issuers in black, and skill categories in the accent where the PDF
// prints them in the Text colour: a navy résumé came out navy in the PDF and black and grey in Word.
// The PDF is the reference: each word's fill, as it shows on the white page, is the colour its Word
// run must carry.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { setup, teardown, resume, experience, section, render, renderDocx, loadModule, TEMPLATES } from './harness.mjs';

before(setup);
after(teardown);

const TEXT = '#1e3a8a';
const ACCENT = '#e11d48';

/** One entry in every section type, each field a word of its own to find in both files. */
const cv = (template, textColor = TEXT, skillsStyle = 'inline') => resume({
  template,
  settings: { textColor, accentColor: ACCENT },
  personal: { name: 'Pat Sample', title: 'Engineer' },
  sections: [
    experience([{ company: 'Acmecorp', role: 'Stafflead', location: 'Lisbontown', description: '<p>Grewrevenue.</p>', bullets: ['Legacybullet'] }]),
    section('education', [{ institution: 'Uniname', degree: 'Degreename', description: '<p>Studydesc.</p>' }]),
    section('skills', [{ category: 'Frontendstuff', skills: 'Reactjs, Vuejs' }], { skillsStyle }),
    section('projects', [{ name: 'Projname', technologies: 'Techstack', description: '<p>Projdesc.</p>' }]),
    section('languages', [{ language: 'Portuguese', proficiency: 'Fluentlevel' }]),
    section('certifications', [{ name: 'Cloudcert', issuer: 'Issuerorg', credentialId: 'Credid42' }]),
    section('awards', [{ title: 'Awardname', issuer: 'Awardgiver', description: '<p>Awarddesc.</p>' }]),
    section('volunteering', [{ role: 'Volrole', org: 'Volorg', description: '<p>Voldesc.</p>' }]),
    section('references', [{ name: 'Refperson', jobTitle: 'Refjob', relationship: 'Refrel' }]),
    section('interests', [{ interests: 'Chessplay, Hiking' }]),
    section('custom', [{ title: 'Customtitle', subtitle: 'Customsub', description: '<p>Customdesc.</p>' }]),
  ],
});

/** [section type, word] for every field the PDF prints in a colour of the résumé. */
const WORDS = [
  ['experience', 'Acmecorp'], ['experience', 'Stafflead'], ['experience', 'Lisbontown'], ['experience', 'Grewrevenue'], ['experience', 'Legacybullet'],
  ['education', 'Uniname'], ['education', 'Degreename'], ['education', 'Studydesc'],
  ['skills', 'Frontendstuff'], ['skills', 'Reactjs'],
  ['projects', 'Projname'], ['projects', 'Techstack'], ['projects', 'Projdesc'],
  ['languages', 'Portuguese'], ['languages', 'Fluentlevel'],
  ['certifications', 'Cloudcert'], ['certifications', 'Issuerorg'], ['certifications', 'Credid42'],
  ['awards', 'Awardname'], ['awards', 'Awardgiver'], ['awards', 'Awarddesc'],
  ['volunteering', 'Volrole'], ['volunteering', 'Volorg'], ['volunteering', 'Voldesc'],
  ['references', 'Refperson'], ['references', 'Refjob'], ['references', 'Refrel'],
  ['interests', 'Chessplay'],
  ['custom', 'Customtitle'], ['custom', 'Customsub'], ['custom', 'Customdesc'],
];

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const hex = (c) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

/** The fill of the first string the PDF draws holding `word`, as it shows on the white page (its opacity blended in). */
async function pdfInk(bytes, word) {
  const doc = await getDocument({ data: bytes.slice(), isEvalSupported: false, verbosity: 0 }).promise;
  const O = OPS;
  try {
    for (let n = 1; n <= doc.numPages; n += 1) {
      const ops = await (await doc.getPage(n)).getOperatorList();
      let state = { fill: '#000000', alpha: 1 };
      const stack = [];
      for (let k = 0; k < ops.fnArray.length; k += 1) {
        const fn = ops.fnArray[k];
        const a = ops.argsArray[k];
        if (fn === O.save) stack.push({ ...state });
        else if (fn === O.restore) state = stack.pop() || state;
        else if (fn === O.setFillRGBColor) state.fill = typeof a[0] === 'string' ? a[0] : hex(a.slice(0, 3));
        else if (fn === O.setGState) { for (const [key, v] of a[0]) if (key === 'ca') state.alpha = v; }
        else if (fn === O.showText) {
          const s = a[0].map((g) => (g && typeof g === 'object' ? g.unicode : '')).join('');
          if (s.toUpperCase().includes(word.toUpperCase())) return hex(rgb(state.fill).map((v) => v * state.alpha + 255 * (1 - state.alpha)));
        }
      }
    }
    return null;
  } finally {
    await doc.loadingTask.destroy();
  }
}

/** The colour of the Word run holding `word`: its w:color, black ('auto') where it sets none. */
function wordInk(xml, word) {
  const run = xml.split('</w:r>').find((r) => (r.match(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g) || []).some((t) => t.toUpperCase().includes(word.toUpperCase())));
  if (!run) return null;
  const c = /<w:color w:val="([0-9A-Fa-f]{6})"/.exec(run)?.[1];
  return c ? `#${c.toLowerCase()}` : '#000000';
}

/** Within 2 per channel: the rounding of two blends. */
const near = (a, b) => a && b && rgb(a).every((v, i) => Math.abs(v - rgb(b)[i]) <= 2);

/** Every word whose Word colour is not the PDF's, for `template` and `textColor` ("word: pdf ≠ word"). */
async function mismatches(template, textColor, skillsStyle) {
  const { inSidebarColumn } = await loadModule('/src/constants/templates.js');
  const r = cv(template, textColor, skillsStyle);
  const [bytes, docx] = [await render(r), await renderDocx(r)];
  const out = [];
  for (const [type, word] of WORDS) {
    // The Sidebar's side column prints light on its dark panel; Word has no panel, so its colours are the page's.
    if (inSidebarColumn(template, type, r.settings)) continue;
    const [pdf, docxInk] = [await pdfInk(bytes, word), wordInk(docx.xml, word)];
    if (!pdf || !docxInk) out.push(`${word}: not found (pdf ${pdf}, word ${docxInk})`);
    else if (!near(pdf, docxInk)) out.push(`${word}: pdf ${pdf} ≠ word ${docxInk}`);
  }
  return out;
}

describe('Word section bodies print in the PDF\'s colours: Design → Text Color and the accent (R2-063)', () => {
  for (const template of TEMPLATES) {
    it(`${template}: every entry field, a navy Text colour`, async () => {
      assert.deepEqual(await mismatches(template, TEXT), []);
    });
  }

  it('classic: the default Text colour and a dark red one too', async () => {
    for (const textColor of ['#111111', '#7c2d12']) assert.deepEqual(await mismatches('classic', textColor), [], textColor);
  });

  it('every skills style prints its category and skills in the PDF\'s colours', async () => {
    const wrong = [];
    for (const template of ['classic', 'modern', 'minimal']) {
      for (const skillsStyle of ['inline', 'bullet', 'stacked', 'tags', 'bars']) {
        for (const m of await mismatches(template, TEXT, skillsStyle)) if (/^(Frontendstuff|Reactjs)/.test(m)) wrong.push(`${template} ${skillsStyle} ${m}`);
      }
    }
    assert.deepEqual(wrong, []);
  });
});
