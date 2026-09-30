// R5-HUNT10-AWARD-UNBRACKETED-YEARS-AS-ISSUER: an award dated with several years not in brackets
// ("Dean's List ⇥ 2014, 2015, 2016") got the earlier years as its Issuer and only the last as its date;
// "Dean's List, 2014 and 2015" first in its section was no entry at all. Such years stay with the title
// now, as they do in brackets ("Dean's List (2014, 2015, 2016)"): no issuer invented, no year dropped.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeFromText } from '../../src/utils/importText.js';

const items = (r, type) => r.sections.find((s) => s.type === type)?.items || [];
const awards = (body) => items(resumeFromText(`Jane Doe\njane@x.com\n\nAWARDS\n${body}`), 'awards').map((a) => [a.title, a.issuer, a.date]);

test('an award’s years after a tab or a comma are no issuer', () => {
  assert.deepEqual(awards("Hackathon Winner, TechCrunch Disrupt\t2019\nDean's List\t2014, 2015, 2016\nNational Merit Scholar\t2012"), [
    ['Hackathon Winner, TechCrunch Disrupt', '', '2019'], ["Dean's List (2014, 2015, 2016)", '', ''], ['National Merit Scholar', '', '2012']]);
  assert.deepEqual(awards("Dean's List\t2014, 2015\nNational Merit Scholar\t2012"), [["Dean's List (2014, 2015)", '', ''], ['National Merit Scholar', '', '2012']]);
  assert.deepEqual(awards("Dean's List, 2014 and 2015\nHackathon Winner\t2019"), [["Dean's List (2014 and 2015)", '', ''], ['Hackathon Winner', '', '2019']]);
  assert.deepEqual(awards("• Dean's List, 2014, 2015\n• Hackathon Winner, 2019"), [["Dean's List (2014, 2015)", '', ''], ['Hackathon Winner', '', '2019']]);
});

test('a certificate’s years likewise; one date after a dash or a comma still dates it', () => {
  const certs = items(resumeFromText('Jane Doe\njane@x.com\n\nCERTIFICATIONS\nAWS Solutions Architect\t2019, 2022\nCKA - CNCF - Jun 2021'), 'certifications');
  assert.deepEqual(certs.map((c) => [c.name, c.issuer, c.date]), [['AWS Solutions Architect (2019, 2022)', '', ''], ['CKA', 'CNCF', 'Jun 2021']]);
});
