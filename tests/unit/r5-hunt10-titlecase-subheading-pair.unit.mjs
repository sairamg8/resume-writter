// R5-HUNT10-TITLECASE-SUBHEADING-PAIR-SWALLOWS-JOBS: in a file with no heading marks, a job with two
// Title-Case sub-labels in a row ("Key Achievements", then "Tech Stack") still made the first an Awards
// section, and every later job went into one award's description: the search for a next dated job
// stopped at the second label. Both labels stay the job's now, the next job a job.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeFromText } from '../../src/utils/importText.js';

const items = (r, type) => r.sections.find((s) => s.type === type)?.items || [];
const types = (r) => r.sections.map((s) => s.type);
const head = 'Jane Doe\njane@x.com | Austin, TX\n\nExperience\nStripe\tMar 2021 - Present\nSenior Software Engineer\n- Led ledger team\n\n';
const tail = 'Square\tJun 2018 - Feb 2021\nSoftware Engineer\n- Built onboarding APIs\n\nEducation\nUC Berkeley\t2012 - 2016\nB.S. Computer Science';

test('“Key Achievements” then “Tech Stack” / “Tools” / “Technologies” inside a job stay the job’s', () => {
  for (const second of ['Tech Stack\nGo, Postgres, Kafka', 'Tools\n- Go, Postgres', 'Technologies\nGo, Postgres']) {
    const r = resumeFromText(`${head}Key Achievements\n- Cut latency 40%\n\n${second}\n\n${tail}`);
    assert.deepEqual(types(r), ['experience', 'education'], second);
    const jobs = items(r, 'experience');
    assert.deepEqual(jobs.map((j) => [j.company, j.role, j.startDate]), [['Stripe', 'Senior Software Engineer', 'Mar 2021'], ['Square', 'Software Engineer', 'Jun 2018']], second);
    assert.match(jobs[0].description, /Key Achievements.*Cut latency 40%/, second);
  }
});

test('a Title-Case “Skills” section, then a “Key Achievements” one of dated awards, are still two sections', () => {
  const r = resumeFromText(`${head}Skills\nPython, SQL\n\nKey Achievements\nHackathon Winner\t2019\nTop Seller\t2021`);
  assert.deepEqual(types(r), ['experience', 'skills', 'awards']);
  assert.deepEqual(items(r, 'awards').map((x) => [x.title, x.date]), [['Hackathon Winner', '2019'], ['Top Seller', '2021']]);
});
