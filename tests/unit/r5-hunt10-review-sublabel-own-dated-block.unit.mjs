// R5-HUNT10 review: the search past a second Title-Case label (R5-HUNT10-TITLECASE-SUBHEADING-PAIR-
// SWALLOWS-JOBS) counted the dated lines right under that label. So a Title-Case "Skills" section, then
// an "Achievements" section whose first award is dated by a range ("President, CS Club ⇥ 2014 – 2016"),
// read as a job's two sub-labels: the skills went into the last job's text, or became a job of their
// own called "Technical Skills". A label with its own dated lines under it heads its own section.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeFromText } from '../../src/utils/importText.js';

const items = (r, type) => r.sections.find((s) => s.type === type)?.items || [];
const types = (r) => r.sections.map((s) => s.type);
const head = 'Jane Doe\njane@x.com | Austin, TX\n\nExperience\nStripe\tMar 2021 - Present\nSenior Software Engineer\n- Led ledger team\n\n';
const tail = '\n\nEducation\nUC Berkeley\t2012 - 2016\nB.S. Computer Science';

test('a Title-Case Skills section, then an Achievements one with an award dated by a range, are two sections', () => {
  for (const [skills, awards] of [
    ['Skills\nPython, SQL', 'Achievements\nPresident, CS Club\t2014 - 2016\nHackathon Winner\t2019'],
    ['Technical Skills\nLanguages: Python, SQL', 'Key Achievements\nMentorship Lead\t2019 - 2021'],
    ['Skills\nPython, SQL', 'Recognitions\nMentorship Lead\t2019 - 2021\n\nHackathon Winner\t2019'],
  ]) {
    const r = resumeFromText(`${head}${skills}\n\n${awards}${tail}`);
    assert.deepEqual(types(r), ['experience', 'skills', 'awards', 'education'], skills);
    const jobs = items(r, 'experience');
    assert.deepEqual(jobs.map((j) => j.company), ['Stripe'], skills);
    assert.doesNotMatch(jobs[0].description, /Python/, skills);
    assert.equal(items(r, 'awards')[0].title, awards.split('\n')[1].split('\t')[0], skills);
  }
});

test('a job’s two sub-labels still stay the job’s, the next job a job', () => {
  for (const [a, b] of [['Key Achievements\n- Cut latency 40%', 'Tech Stack\nGo, Postgres'], ['Tech Stack\nGo, Postgres', 'Key Achievements\n- Cut latency 40%']]) {
    const r = resumeFromText(`${head}${a}\n\n${b}\n\nSquare\tJun 2018 - Feb 2021\nSoftware Engineer\n- Built APIs${tail}`);
    assert.deepEqual(types(r), ['experience', 'education'], a);
    assert.deepEqual(items(r, 'experience').map((j) => j.company), ['Stripe', 'Square'], a);
  }
});
