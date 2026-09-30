// R5-HUNT10 review: the brackets put round an award's or a certificate's unbracketed years (R5-HUNT10-
// AWARD-UNBRACKETED-YEARS-AS-ISSUER) went round every line of the section, its entries' text too: a
// list item under an award, "Placed first of 200 teams, 2019, 2020", came in as "Placed first of 200
// teams (2019, 2020)". Only an entry's own line is read so; the text under it stays as typed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeFromText } from '../../src/utils/importText.js';

const items = (r, type) => r.sections.find((s) => s.type === type)?.items || [];
const awards = (body) => items(resumeFromText(`Jane Doe\njane@x.com\n\nAWARDS\n${body}`), 'awards');

test('a list item under an award keeps its years as typed', () => {
  const a = awards("Hackathon Winner\t2019\n- Placed first of 200 teams, 2019, 2020\nDean's List\t2015");
  assert.deepEqual(a.map((x) => [x.title, x.date]), [['Hackathon Winner', '2019'], ["Dean's List", '2015']]);
  assert.match(a[0].description, /Placed first of 200 teams, 2019, 2020/);
  assert.doesNotMatch(a[0].description, /\(2019, 2020\)/);
});

test('in a list of awards, a line under an item keeps its years; the items’ own years are still bracketed', () => {
  const a = awards("• Hackathon Winner, 2019\nPlaced first of 200 teams, 2019 and 2020\n• Dean's List, 2014, 2015");
  assert.deepEqual(a.map((x) => [x.title, x.date]), [['Hackathon Winner', '2019'], ["Dean's List (2014, 2015)", '']]);
  assert.match(a[0].description, /Placed first of 200 teams, 2019 and 2020/);
});
