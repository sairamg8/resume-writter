// R5-HUNT9-BODY-LINE-BRACKET-YEARS-NEW-ENTRY, review: the fix stopped several years in brackets dating
// any line outside Certifications and Awards, so a project's own title printed with them ("Chat App
// (2021, 2022)"), first in its section or over its list, was no entry any more: its title and its list
// went into the next or the last project's description. Such a title still starts its entry; a line
// under a job or a school with them (no list under it) stays that entry's text.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeFromText } from '../../src/utils/importText.js';

const items = (r, type) => r.sections.find((s) => s.type === type)?.items || [];

test('a project titled with years in brackets, first in its section, is an entry of its own', () => {
  const p = items(resumeFromText('Jane Doe\n\nProjects\nChat App (2021, 2022)\n• Realtime chat\nResume Builder\t2023\n• A React app'), 'projects');
  assert.deepEqual(p.map((x) => x.name), ['Chat App', 'Resume Builder']);
  assert.match(p[0].description, /Realtime chat/);
  assert.doesNotMatch(p[1].description, /Chat App|Realtime chat/);
});

test('a project titled with years in brackets over its list, after another, is an entry of its own', () => {
  const p = items(resumeFromText('Jane Doe\n\nProjects\nResume Builder\t2023\n• A React app\nChat App (2021, 2022)\n• Realtime chat'), 'projects');
  assert.deepEqual(p.map((x) => x.name), ['Resume Builder', 'Chat App']);
  assert.doesNotMatch(p[0].description, /Chat App|Realtime chat/);
});

test('a job’s line with years in brackets and no list under it still is the job’s text', () => {
  const jobs = items(resumeFromText('Jane Doe\n\nExperience\nSales Manager, Acme Corp\t2018 – Present\n• Exceeded quota\nNamed top seller (2019 and 2021)\nAccount Executive, Beta Inc\t2015 – 2018\n• Closed deals'), 'experience');
  assert.deepEqual(jobs.map((j) => j.company), ['Acme Corp', 'Beta Inc']);
  assert.match(jobs[0].description, /Named top seller \(2019 and 2021\)/);
});
