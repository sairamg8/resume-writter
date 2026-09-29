// R5-HUNT7-DASH-STARTER-DROPS-PAPER-AND-ICONS: a role starter on /new takes the user's own name and
// contacts from the résumé it starts from (starterFrom), but kept the starter's settings wholesale: no
// page size (A4) and no uploaded contact icons. A US Letter user's new résumé printed on A4, with stock
// icons beside their own contacts. Now the paper and the uploaded icons come with the user's details,
// as a look picked on /new keeps them (resumeFrom); A4 stays stored as none.
// Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildResumeFromStarter } from '../../src/utils/starterTemplates.js';
import { starterFrom } from '../../src/utils/newResume.js';
import { pageSizeOf } from '../../src/constants/pageSize.js';

const ICON = 'data:image/png;base64,iVBORw0KGgo=';
const mine = (settings) => ({
  id: 'r_mine', name: 'My résumé', updatedAt: 5,
  personal: { name: 'Pat Example', email: 'pat@example.org', linkedin: 'linkedin.com/in/pat-example', hiddenFields: [] },
  settings,
  sections: [],
});

test('a US Letter user’s role starter stays on US Letter', () => {
  const built = starterFrom(buildResumeFromStarter('software-engineer', 'r_new'), mine({ pageSize: 'LETTER' }));
  assert.equal(built.settings.pageSize, 'LETTER');
  assert.equal(pageSizeOf(built.settings), 'LETTER');
});

test('the contact icons the user uploaded come with their contacts', () => {
  const source = mine({ customContactIcons: { linkedin: ICON } });
  const built = starterFrom(buildResumeFromStarter('software-engineer', 'r_new'), source);
  assert.deepEqual(built.settings.customContactIcons, { linkedin: ICON });
  // A copy: an icon changed on the new résumé does not change the user's own.
  built.settings.customContactIcons.github = ICON;
  assert.deepEqual(source.settings.customContactIcons, { linkedin: ICON });
});

test('the rest of the starter’s design is kept, and A4 is stored as none', () => {
  const sample = buildResumeFromStarter('software-engineer', 'r_new');
  const built = starterFrom(buildResumeFromStarter('software-engineer', 'r_new'), mine({ pageSize: 'A4', accentColor: '#ff0000', customContactIcons: [] }));
  assert.deepEqual(built.settings, sample.settings);
  assert.equal(Object.hasOwn(built.settings, 'pageSize'), false);
  const none = starterFrom(buildResumeFromStarter('software-engineer', 'r_new'), mine(undefined));
  assert.deepEqual(none.settings, sample.settings);
});
