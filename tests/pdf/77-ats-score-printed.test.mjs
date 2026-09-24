// R2-163 / R2-020 / R2-022: the ATS score and the job match read what the PDF prints, checked
// against the PDF itself. tests/unit/ats-printed-score.unit.mjs and ats-job-match-printed.unit.mjs pin
// the checker's rules; this file renders each case with the app's own react-pdf code, on every
// template, and checks that what the score passes or the match finds is on the page, and what it
// fails or misses is not: a hidden email, Section Options → Show dates off on jobs and degrees, a
// skill group's hidden skills, a language (which the match used to miss), and a keyword only in the
// hidden summary (which it used to find).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, render, read, allText, loadModule, TEMPLATES } from './harness.mjs';

before(setup);
after(teardown);

const checker = () => loadModule('/src/utils/atsChecker.js');
const printed = async (r) => allText(await read(await render(r)));
const item = (res, cat, id) => res.categories[cat].items.find((i) => i.id === id);

function sample(template, { personal = {}, exp = {}, edu = {}, skills = {}, more = [] } = {}) {
  return resume({
    template,
    personal: { name: 'Clara Jansen', email: 'clara@example.com', phone: '+1 555 010 2030', location: 'Austin, TX', ...personal },
    sections: [
      section('experience', [{ company: 'Acme Freight', role: 'Engineer', startDate: '03/2019', endDate: '11/2022', description: '<ul><li>Built 12 services.</li></ul>' }], exp),
      section('education', [{ institution: 'Delft University', degree: 'MSc', startDate: '09/2012', endDate: '06/2014' }], edu),
      section('skills', [{ category: 'Tools', skills: 'Terraform, Ansible, Docker, Helm, Vault, Consul, Nomad, Packer', ...skills }]),
      ...more,
    ],
  });
}

describe('the ATS score passes what the PDF prints and fails what it does not (R2-020)', () => {
  for (const template of TEMPLATES) {
    it(`${template}: a hidden email, Show dates off and hidden skills`, async () => {
      const { analyzeAtsScore } = await checker();
      const shown = sample(template);
      const shownText = await printed(shown);
      const shownRes = analyzeAtsScore(shown);
      for (const word of ['clara@example.com', '2019', '2014', 'Terraform']) assert.ok(shownText.includes(word), `${word} prints`);
      assert.equal(item(shownRes, 'contact', 'email').status, 'pass');
      assert.equal(item(shownRes, 'experience', 'exp_dates').status, 'pass');
      assert.equal(item(shownRes, 'education', 'edu_dates').status, 'pass');
      assert.equal(item(shownRes, 'skills', 'skills_count').status, 'pass', 'eight skills print');

      const hidden = sample(template, {
        personal: { hiddenFields: ['email'] },
        exp: { showDates: false },
        edu: { showDates: false },
        skills: { hiddenFields: ['skills'] },
      });
      const hiddenText = await printed(hidden);
      const res = analyzeAtsScore(hidden);
      for (const word of ['clara@example.com', '2019', '2022', '2014', 'Terraform']) assert.ok(!hiddenText.includes(word), `${word} does not print`);
      assert.equal(item(res, 'contact', 'email').status, 'fail');
      assert.equal(item(res, 'experience', 'exp_dates').status, 'warn');
      assert.equal(item(res, 'education', 'edu_dates').status, 'warn');
      assert.equal(item(res, 'skills', 'skills_count').status, 'fail', 'no skill prints');
    });
  }
});

describe('the job match finds what the PDF prints and misses what it does not (R2-022, R2-027)', () => {
  for (const template of TEMPLATES) {
    it(`${template}: a language is matched, a keyword only in the hidden summary is missing`, async () => {
      const { matchResumeWithJob } = await checker();
      const r = sample(template, {
        personal: { summary: '<p>Seasoned in Kubernetes operations.</p>', hiddenFields: ['summary'] },
        more: [section('languages', [{ language: 'Portuguese', proficiency: 'Fluent' }])],
      });
      const text = await printed(r);
      assert.ok(text.includes('Portuguese'));
      assert.ok(!text.includes('Kubernetes'));
      const m = matchResumeWithJob(r, 'Portuguese Portuguese Kubernetes Kubernetes');
      assert.ok(m.matchedKeywords.includes('Portuguese'), JSON.stringify(m));
      assert.ok(m.missingKeywords.includes('Kubernetes'), JSON.stringify(m));
    });
  }
});
