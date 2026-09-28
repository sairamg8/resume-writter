// R4-DOUT-02: Executive's and Academic's PDF passes italicSubs, so an entry's second field, its
// location and a certification's or an award's issuer print italic, and Title "Inline" joins the two
// fields with ", " ("Acme, Engineer"). Their Word file printed all of it upright and joined with " — ".
// Word now italicises the same runs and joins an Inline title with ", " on those two templates;
// Classic (no italicSubs) keeps upright runs and " — ". Fictional data only.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, renderDocx } from './harness.mjs';

before(setup);
after(teardown);

const cv = (template, titleStyle) => resume({
  template,
  personal: { name: 'Robin Sample', title: 'Engineer' },
  sections: [
    section('experience', [{ company: 'Acmecorp', role: 'Leadengineer', location: 'Springfield', startDate: '01/2011', endDate: '12/2012' }], { titleStyle, titleOrder: 'company', showLocation: true }),
    section('certifications', [{ name: 'Cloudcert', issuer: 'Fictionboard', date: '2015' }]),
    section('awards', [{ title: 'Topprize', issuer: 'Samplesociety', date: '2016' }]),
  ],
});

/** Every run of the document, as { text, props } — props its <w:rPr> XML. */
const runs = (doc) => doc.xml.split('</w:r>')
  .map((run) => ({ text: /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/.exec(run)?.[1], props: /<w:rPr>.*<\/w:rPr>/s.exec(run)?.[0] || '' }))
  .filter((run) => run.text !== undefined);
/** Is the run holding `needle` italic? */
function italic(doc, needle) {
  const run = runs(doc).find((r) => r.text.includes(needle));
  assert.ok(run, `a run holding "${needle}": ${JSON.stringify(runs(doc).map((r) => r.text))}`);
  return /<w:i\/>/.test(run.props);
}

describe('Word: Executive and Academic italicise the second field, location and issuer, and join Inline with ", " (R4-DOUT-02)', () => {
  for (const template of ['executive', 'academic']) {
    it(`${template}: Inline "Acmecorp, Leadengineer", the role, location and issuers italic, the first field upright`, async () => {
      const doc = await renderDocx(cv(template, 'inline'));
      assert.ok(doc.texts.some((t) => t.startsWith('Acmecorp, Leadengineer')), doc.texts.join(' | '));
      assert.ok(!doc.texts.some((t) => t.includes('Acmecorp — Leadengineer')), 'no " — " joiner');
      for (const needle of ['Leadengineer', 'Springfield', 'Fictionboard', 'Samplesociety']) assert.equal(italic(doc, needle), true, `${template}: "${needle}" italic`);
      assert.equal(italic(doc, 'Acmecorp'), false, `${template}: the first field upright`);
    });

    it(`${template}: Stacked prints the role on its own line, italic, with an italic location`, async () => {
      const doc = await renderDocx(cv(template, 'stacked'));
      assert.ok(doc.texts.some((t) => t.startsWith('Acmecorp\t') && t.includes('\nLeadengineer')), doc.texts.join(' | '));
      assert.equal(italic(doc, 'Leadengineer'), true);
      assert.equal(italic(doc, 'Springfield'), true);
    });
  }

  it('classic: upright runs and the " — " joiner, as its PDF prints them', async () => {
    const doc = await renderDocx(cv('classic', 'inline'));
    assert.ok(doc.texts.some((t) => t.startsWith('Acmecorp — Leadengineer')), doc.texts.join(' | '));
    for (const needle of ['Leadengineer', 'Springfield', 'Fictionboard', 'Samplesociety']) assert.equal(italic(doc, needle), false, `classic: "${needle}" upright`);
  });
});
