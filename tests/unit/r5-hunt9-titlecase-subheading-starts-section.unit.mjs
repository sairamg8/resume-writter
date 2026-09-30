// R5-HUNT9-TITLECASE-SUBHEADING-STARTS-SECTION: in a file with no heading marks (text, PDF, Word with no
// Heading styles), a Title-Case sub-heading inside a job that is also a section's name ("Key
// Achievements:" or after a blank line, "Tech Stack", "Tools") started a new section, and every later job
// or project went into it as awards or skills. Such a label, with another dated entry after it before
// the next heading, stays its entry's part now; a Title-Case section of its own still is one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeFromText } from '../../src/utils/importText.js';

const items = (r, type) => r.sections.find((s) => s.type === type)?.items || [];
const types = (r) => r.sections.map((s) => s.type);

test('“Key Achievements” inside a job, with a colon or after a blank line, stays the job’s', () => {
  for (const sub of ['Key Achievements:', '\nKey Achievements']) {
    const r = resumeFromText(`Jane Doe\njane@x.com\n\nEXPERIENCE\nSoftware Engineer, Acme Corp\t2020 – Present\n• Built the billing platform\n${sub}\n• Won the company hackathon\n\nData Analyst, Beta Inc\t2018 – 2020\n• Built dashboards\n\nEDUCATION\nMIT\t2014 – 2018\nB.S. Computer Science`);
    assert.deepEqual(types(r), ['experience', 'education'], sub);
    const jobs = items(r, 'experience');
    assert.deepEqual(jobs.map((j) => [j.company, j.role, j.startDate]), [['Acme Corp', 'Software Engineer', '2020'], ['Beta Inc', 'Data Analyst', '2018']], sub);
    assert.match(jobs[0].description, /Key Achievements.*Won the company hackathon/, sub);
  }
});

test('“Tech Stack” inside a project stays the project’s, the next project a project', () => {
  const r = resumeFromText('Jane Doe\njane@x.com\n\nPROJECTS\nResume Builder\t2023\n• A React app\n\nTech Stack\n• React, Node\n\nChat App\n2022\n• Realtime chat');
  assert.deepEqual(types(r), ['projects']);
  const p = items(r, 'projects');
  assert.deepEqual(p.map((x) => [x.name, x.startDate]), [['Resume Builder', '2023'], ['Chat App', '2022']]);
  assert.match(p[0].description, /Tech Stack.*React, Node/);
});

test('a Title-Case “Key Achievements” or “Skills” section of its own still is one', () => {
  const a = resumeFromText('Jane Doe\njane@x.com\n\nExperience\nSoftware Engineer, Acme Corp\t2020 – Present\n• Built the billing platform\n\nKey Achievements\n• Won the company hackathon\n\nEducation\nMIT\t2014 – 2018\nB.S. Computer Science');
  assert.deepEqual(types(a), ['experience', 'awards', 'education']);
  const b = resumeFromText('Jane Doe\njane@x.com\n\nExperience\nSoftware Engineer, Acme Corp\t2020 – Present\n• Built the billing platform\n\nKey Achievements\nHackathon Winner\t2019\nTop Seller\t2021');
  assert.deepEqual(items(b, 'awards').map((x) => [x.title, x.date]), [['Hackathon Winner', '2019'], ['Top Seller', '2021']]);
  const c = resumeFromText('Jane Doe\njane@x.com\n\nExperience\nSoftware Engineer, Acme Corp\t2020 – Present\n• Built the billing platform\n\nSkills\nPython, SQL\n\nEducation\nMIT\t2014 – 2018\nB.S. Computer Science');
  assert.deepEqual(types(c), ['experience', 'skills', 'education']);
});
