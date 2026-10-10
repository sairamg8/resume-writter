// A field hidden with its eye (the entry's `hiddenFields`, as a Backup JSON, an import or an older build carries
// them) prints nowhere on an Education, Project, Certification, Award, Volunteering, Reference, Interest or Custom
// entry — in the PDF (every template), Word, Markdown, the ATS text and the JSON Resume file alike. Until now
// only the dates (R1-LEFT-b) and a job's fields read the flag in the PDF and Word: a hidden institution, link,
// issuer, description or contact still printed there while Markdown, the ATS text and the JSON Resume left it out.
// Every hidden value below holds the word "hidden"; the visible fields beside it must still print.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, render, read, allText, renderDocx, loadModule, TEMPLATES } from './harness.mjs';

before(setup);
after(teardown);

/** The entries: a shown field, and fields the eye hides (`hide`) — or, `eyes` off, the same entries with nothing hidden. */
function entries(template, eyes = true) {
  const eye = (...keys) => ({ hiddenFields: eyes ? keys : [] });
  return resume({ template, sections: [
    section('education', [{
      institution: 'Harbor College', degree: 'Hiddendegree', fieldOfStudy: 'Hiddenfield', gpa: '3.9 Hiddengpa', location: 'Hiddenplace',
      startDate: 'Sep 2015', endDate: 'Jun 2019', description: '<p>Hiddenedudesc</p>', ...eye('degree', 'fieldOfStudy', 'gpa', 'location', 'description'),
    }]),
    section('projects', [{
      name: 'Tidewatch', technologies: 'Hiddentech', url: 'https://hiddenlink.example.com', description: '<p>Hiddenprojdesc</p>',
      ...eye('technologies', 'url', 'description'),
    }]),
    section('certifications', [{
      name: 'Cert Visible', issuer: 'Hiddenissuer', date: 'Mar 2020', credentialId: 'Hiddencred', url: 'https://hiddencert.example.com', ...eye('issuer', 'credentialId', 'url'),
    }]),
    section('awards', [{ title: 'Award Visible', issuer: 'Hiddenawardissuer', date: 'May 2021', description: '<p>Hiddenawarddesc</p>', ...eye('issuer', 'description') }]),
    section('volunteering', [{
      org: 'Shore Crew', role: 'Hiddenrole', location: 'Hiddenvolplace', startDate: 'Jan 2018', endDate: 'Apr 2019', description: '<p>Hiddenvoldesc</p>',
      ...eye('role', 'location', 'description'),
    }]),
    section('references', [{
      name: 'Ref Visible', jobTitle: 'Hiddenjob', company: 'Hiddenco', relationship: 'Hiddenrel', email: 'hiddenref@example.com', phone: 'Hiddenphone',
      ...eye('jobTitle', 'company', 'relationship', 'email', 'phone'),
    }]),
    section('interests', [{ interests: 'Hikingvisible' }, { interests: 'Hiddeninterest', ...eye('interests') }]),
    section('custom', [{
      title: 'Custom Visible', subtitle: 'Hiddensub', location: 'Hiddencustloc', date: 'Feb 2022', description: '<p>Hiddencustdesc</p>', ...eye('subtitle', 'location', 'description'),
    }]),
  ] });
}

const SHOWN = ['Harbor College', 'Tidewatch', 'Cert Visible', 'Award Visible', 'Shore Crew', 'Ref Visible', 'Hikingvisible', 'Custom Visible'];
const flat = (text) => text.replace(/\s+/g, ' ');

function assertHidden(text, label) {
  assert.deepEqual(flat(text).match(/hidden\w*/gi) ?? [], [], `${label}: prints a hidden field\n${text}`);
  for (const kept of SHOWN) assert.ok(flat(text).toLowerCase().includes(kept.toLowerCase()), `${label}: lost the shown ${kept}\n${text}`);
}

describe('a hidden field on any entry prints nowhere (PDF, Word, Markdown, ATS text, JSON Resume)', () => {
  for (const template of TEMPLATES) {
    it(`${template}: the PDF leaves it out`, async () => {
      assertHidden(allText(await read(await render(entries(template)))), template);
    });
  }

  it('Word, Markdown, ATS text and the JSON Resume file leave it out too', async () => {
    const { generateMarkdownResume } = await loadModule('/src/utils/markdownExport.js');
    const { generateAtsPlainText } = await loadModule('/src/utils/atsPlainText.js');
    const r = entries('classic');
    assertHidden((await renderDocx(r)).texts.join('\n'), 'Word');
    assertHidden(generateMarkdownResume(r), 'Markdown');
    assertHidden(generateAtsPlainText(r), 'ATS text');
    const { cpwtResumeToJsonResume } = await loadModule('/src/utils/jsonResumeExport.js');
    assert.deepEqual(JSON.stringify(cpwtResumeToJsonResume(r)).match(/hidden\w*/gi) ?? [], [], 'JSON Resume: a hidden field is in the file');
  });

  it('nothing is lost when no eye is off: every one of those fields prints in the PDF and in Word', async () => {
    const r = entries('classic', false);
    const pdf = flat(allText(await read(await render(r))));
    const word = flat((await renderDocx(r)).texts.join('\n'));
    // Word prints no relationship, and Classic's PDF no credential ID: those two are left out of the check.
    const both = ['Hiddendegree', 'Hiddengpa', 'Hiddenplace', 'Hiddenedudesc', 'Hiddentech', 'Hiddenprojdesc', 'Hiddenissuer', 'Hiddenawardissuer',
      'Hiddenawarddesc', 'Hiddenrole', 'Hiddenvolplace', 'Hiddenvoldesc', 'Hiddenjob', 'Hiddenco', 'Hiddenphone', 'Hiddeninterest', 'Hiddensub', 'Hiddencustloc', 'Hiddencustdesc'];
    for (const [label, text, extra] of [['PDF', pdf, ['Hiddenrel']], ['Word', word, []]]) {
      for (const shown of [...both, ...extra]) assert.ok(text.includes(shown), `${label}: ${shown} is not printed\n${text}`);
    }
  });

  it('the résumé the user holds is not changed by printing it (the eyes stay)', async () => {
    const r = entries('classic');
    const before = JSON.stringify(r);
    await render(r);
    await renderDocx(r);
    assert.equal(JSON.stringify(r), before);
  });
});
