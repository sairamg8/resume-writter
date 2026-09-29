// R5-HUNT6-ROLE-FIRST-FIRM-VOTE (review of R5-HUNT6-ROLE-FIRST-SECTION): a section's jobs vote on
// whether the role comes first, and a job whose words do not tell takes the vote's order. A firm named
// with a role word in the plural ("Summit Partners", "Gensler Architects") voted "role first", so in a
// company-first résumé one such employer swapped every other job with no role word ("Starbucks —
// Barista" came back as company "Barista", role "Starbucks"). A plural role word names a firm and no
// longer votes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeFromText } from '../../src/utils/importText.js';

const jobs = (...lines) => resumeFromText(['Jane Doe', '', 'EXPERIENCE', ...lines].join('\n'))
  .sections.find((s) => s.type === 'experience').items.map((j) => [j.company, j.role]);

test('a firm named "… Partners" does not swap the section\'s other jobs', () => {
  const got = jobs(
    'Starbucks — Barista', 'Jan 2019 – Dec 2019', '• Made coffee', '',
    'Summit Partners — Receptionist', 'Jan 2020 – Dec 2020', '• Greeted clients', '',
    'Target — Cashier', 'Jan 2021 – Dec 2021', '• Ran the till',
  );
  assert.deepEqual(got[0], ['Starbucks', 'Barista']);
  assert.deepEqual(got[2], ['Target', 'Cashier']);
});

test('the PDF layout: a firm named "… Architects" over its role does not swap the others', () => {
  const got = jobs(
    'Starbucks\tJan 2019 – Dec 2019', 'Barista', '• Made coffee',
    'Gensler Architects\tJan 2020 – Dec 2020', 'Receptionist', '• Greeted clients',
    'Target\tJan 2021 – Dec 2021', 'Cashier', '• Ran the till',
  );
  assert.deepEqual(got[0], ['Starbucks', 'Barista']);
  assert.deepEqual(got[2], ['Target', 'Cashier']);
});

test('a role-first section still decides for a job with no role word', () => {
  assert.deepEqual(jobs(
    'Kitchen Manager — Nopa', 'Mar 2021 – Jun 2023', '• Ran the line', '',
    'Barista — Blue Bottle', 'May 2017 – Dec 2018', '• Made coffee',
  ), [['Nopa', 'Kitchen Manager'], ['Blue Bottle', 'Barista']]);
});
