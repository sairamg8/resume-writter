// Word résumé: every entry field prints at the size its PDF prints it, whatever Design → Typography →
// Entry Header says (R2-118, R2-124). The PDF prints an entry's title and its description at the
// Entry Header size (a description half a point under it, a job's at it), and its second field —
// role or company, degree, organisation, subtitle — its location and its dates at Base; Word printed
// the second field at Entry Header and every description at Base, so raising Entry Header grew the
// PDF's descriptions and Word's roles instead. Skills rows, languages and references followed Entry
// Header in the one file and Base in the other too.
// Measured against the PDF itself (pdf.js's item height is the font size), on every template. The
// Sidebar's side column prints its own fixed sizes, not these, and is left out there; the Timeline's
// dates (above the title, a point under Base) are its layout's, not Entry Header's.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, render, read, allItems, renderDocx, TEMPLATES } from './harness.mjs';

before(setup);
after(teardown);

/** The Sidebar's side column (SIDEBAR_COLUMN_TYPES): its own sizes in the PDF. */
const SIDE = ['skills', 'education', 'languages', 'certifications', 'interests', 'references'];

/** One entry in every section with entries, each field a word of its own. */
const cv = (template, settings = {}, titleStyle = undefined) => resume({
  template,
  settings: { fontSizeBase: 11, ...settings },
  personal: { name: 'Robin Sample', title: 'Engineer', email: 'robin@example.com' },
  sections: [
    section('experience', [{ company: 'Acmecorp', role: 'Leadengineer', location: 'Springfield', startDate: '01/2011', endDate: '12/2012', description: '<p>Shippedwidgets daily.</p>', bullets: ['Legacybullet point'] }], titleStyle ? { titleStyle } : {}),
    section('education', [{ institution: 'Stateuni', degree: 'Bachelorarts', location: 'Riverton', startDate: '2005', endDate: '2009', description: '<p>Thesiswork on things.</p>' }]),
    section('projects', [{ name: 'Gadgetapp', technologies: 'Rustlang', description: '<p>Builtgadget for fun.</p>' }]),
    section('volunteering', [{ role: 'Helperrole', org: 'Charityorg', location: 'Lakeside', description: '<p>Volunteerdesc here.</p>' }]),
    section('custom', [{ title: 'Customtitle', subtitle: 'Customsub', location: 'Hillview', description: '<p>Customdesc here.</p>' }], {}, { title: 'Extra' }),
    section('awards', [{ title: 'Prizename', issuer: 'Awardorg', description: '<p>Awarddesc here.</p>' }]),
    section('certifications', [{ name: 'Certname', issuer: 'Issuerorg' }]),
    section('skills', [{ category: 'Toolbox', skills: 'Hammerx, Sawy' }]),
    section('languages', [{ language: 'Esperanto', proficiency: 'Fluentlevel' }]),
    section('references', [{ name: 'Refname', jobTitle: 'Refjob', company: 'Refco' }]),
  ],
});

/** Each field's word, and the section it prints in. */
const FIELDS = {
  Acmecorp: 'experience', Leadengineer: 'experience', Springfield: 'experience', 2011: 'experience', Shippedwidgets: 'experience', Legacybullet: 'experience',
  Stateuni: 'education', Bachelorarts: 'education', Riverton: 'education', Thesiswork: 'education',
  Gadgetapp: 'projects', Rustlang: 'projects', Builtgadget: 'projects',
  Helperrole: 'volunteering', Charityorg: 'volunteering', Lakeside: 'volunteering', Volunteerdesc: 'volunteering',
  Customtitle: 'custom', Customsub: 'custom', Hillview: 'custom', Customdesc: 'custom',
  Prizename: 'awards', Awardorg: 'awards', Awarddesc: 'awards',
  Certname: 'certifications', Issuerorg: 'certifications',
  Toolbox: 'skills', Hammerx: 'skills',
  Esperanto: 'languages', Fluentlevel: 'languages',
  Refname: 'references', Refjob: 'references',
};

/** The fields a template prints at sizes of its own layout, not Entry Header's: left out of the comparison. */
function measured(template) {
  return Object.keys(FIELDS).filter((word) => !(template === 'sidebar' && SIDE.includes(FIELDS[word])) && !(template === 'timeline' && word === '2011'));
}

/** The size the PDF prints each word at, pt. */
async function pdfSizes(r, words) {
  const items = allItems(await read(await render(r)));
  return Object.fromEntries(words.map((word) => {
    const item = items.find((t) => t.str.toUpperCase().includes(word.toUpperCase()));
    assert.ok(item, `${r.template}: "${word}" in the PDF`);
    return [word, Math.round(item.h * 100) / 100];
  }));
}

/** The size Word prints each word at, pt: the w:sz of the run that holds it (half-points). */
async function wordSizes(r, words) {
  const runs = (await renderDocx(r)).xml.split('</w:r>');
  return Object.fromEntries(words.map((word) => {
    const run = runs.find((x) => (x.match(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g) || []).some((t) => t.toUpperCase().includes(word.toUpperCase())));
    assert.ok(run, `${r.template}: "${word}" in the .docx`);
    const sz = run.match(/<w:sz w:val="(\d+)"/)?.[1];
    assert.ok(sz, `${r.template}: "${word}" has a size`);
    return [word, Number(sz) / 2];
  }));
}

async function mismatches(template, settings, titleStyle) {
  const r = cv(template, settings, titleStyle);
  const words = measured(template);
  const [pdf, word] = [await pdfSizes(r, words), await wordSizes(r, words)];
  return words.filter((w) => Math.abs(pdf[w] - word[w]) > 0.01).map((w) => `${template} ${JSON.stringify(settings)}${titleStyle ? ` ${titleStyle}` : ''} "${w}": Word ${word[w]} pt, PDF ${pdf[w]} pt`);
}

describe('Word résumé: entry fields at the PDF\'s sizes, whatever the Entry Header size (R2-118, R2-124)', () => {
  it('every template, Entry Header at Base, 4 pt over it and 2 pt under it', async () => {
    const wrong = [];
    for (const template of TEMPLATES) {
      for (const fontSizeEntryDelta of [0, 4, -2]) wrong.push(...await mismatches(template, { fontSizeEntryDelta }));
    }
    assert.deepEqual(wrong, []);
  });

  it('a job\'s Title "Inline" and "Side by side" too (the Sidebar prints them as the other templates do, not as its cards)', async () => {
    const wrong = [];
    for (const template of ['classic', 'sidebar', 'timeline']) {
      for (const titleStyle of ['inline', 'sidebyside']) wrong.push(...await mismatches(template, { fontSizeEntryDelta: 4 }, titleStyle));
    }
    assert.deepEqual(wrong, []);
  });

  it('Classic, Entry Header 15 pt over Base 11: the job\'s description at 15 pt, its role and location at 11', async () => {
    const r = cv('classic', { fontSizeEntryDelta: 4 });
    const word = await wordSizes(r, ['Acmecorp', 'Leadengineer', 'Springfield', 'Shippedwidgets', 'Thesiswork']);
    assert.deepEqual(word, { Acmecorp: 15, Leadengineer: 11, Springfield: 11, Shippedwidgets: 15, Thesiswork: 14.5 });
  });
});
