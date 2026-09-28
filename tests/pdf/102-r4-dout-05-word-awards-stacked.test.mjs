// R4-DOUT-05: the Word résumé printed an award on one line, "Title — Issuer<TAB>Date", and " — Issuer"
// with a leading dash when the award had no title, where the PDF's AwardsSection stacks the title
// (bold), the issuer and the date on lines of their own, with no dash. Now Word stacks them too, in the
// colours its siblings print those fields in (the issuer as a certificate's issuer, the date as a job's
// date), and a certificate with no name prints no leading " — " either. Fictional data only.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, experience, renderDocx } from './harness.mjs';

before(setup);
after(teardown);

/** The run of `xml` holding exactly `text`. */
const runOf = (xml, text) => xml.split('</w:r>').find((run) => run.includes(`>${text}<`)) || '';
const colourOf = (xml, text) => runOf(xml, text).match(/<w:color w:val="([0-9a-fA-F]{6})"/)?.[1]?.toLowerCase();

function sample() {
  return resume({
    sections: [
      experience([{ company: 'Fabrikam Studio', role: 'Lead Designer', startDate: '2019', endDate: '' }]),
      section('awards', [
        { title: 'Best Paper', issuer: 'Harbor Guild', date: '2021' },
        { title: '', issuer: 'Northwind Society', date: '05/2020' },
      ], { columns: 1 }),
      section('certifications', [{ name: '', issuer: 'Cloud Board', credentialId: 'ZX-42' }], { columns: 1 }),
    ],
  });
}

it('Word stacks an award\'s title, issuer and date on lines of their own, as the PDF does, with no dash or tab', async () => {
  const { texts, xml } = await renderDocx(sample());
  assert.ok(texts.includes('Best Paper\nHarbor Guild\n2021'), texts.join(' | '));
  assert.ok(texts.includes('Northwind Society\n05/2020'), `no title: the issuer leads, no " — ": ${texts.join(' | ')}`);
  assert.ok(!texts.some((t) => t.includes('Harbor Guild') && /—|\t/.test(t)), texts.join(' | '));
  // The title bold, the issuer and date not; the issuer in a certificate issuer's colour, the date in a job's.
  assert.match(runOf(xml, 'Best Paper'), /<w:b\/>/);
  assert.doesNotMatch(runOf(xml, 'Harbor Guild'), /<w:b\/>/);
  assert.ok(colourOf(xml, 'Harbor Guild'));
  assert.equal(colourOf(xml, 'Harbor Guild'), colourOf(xml, 'Cloud Board'));
  assert.ok(colourOf(xml, '2019'));
  assert.equal(colourOf(xml, '2021'), colourOf(xml, '2019'));
});

it('Word prints a certificate with no name from its issuer, with no leading " — "', async () => {
  const { texts } = await renderDocx(sample());
  const cert = texts.find((t) => t.includes('Cloud Board'));
  assert.equal(cert, 'Cloud Board · ID: ZX-42');
  assert.ok(!texts.some((t) => /^\s*[—·]/.test(t)), texts.join(' | '));
});
