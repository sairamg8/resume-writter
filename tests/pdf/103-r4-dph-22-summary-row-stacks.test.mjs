// R4-DPH-22: a Job Summary row ("Upcoming deadlines", "Follow-ups due") on a phone. The row put
// the avatar, the company and role, the status lozenge and the date pill side by side, so in a
// ~300px card the lozenge ("PHONE SCREEN", ~93px) and the pill ("3d overdue", ~82px) left the
// company and role about 66px, nine characters. The lozenge and the pill now share one wrapper
// at the row's right, which below sm stacks them (flex-col, right-aligned, 4px apart); from sm up
// it is a row with the same 0.75rem gap the button had, so tablet and desktop look as before.
// The fake DOM has no layout: this pins the row's structure and the wrapper's class tokens, on
// the real JobSummary (tests/pdf/fake-dom.mjs, loaded through Vite). Fictional data only.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { acme, dayFromToday, render } from './100-r4-job-helpers.mjs';

before(setup);
after(teardown);

const tokens = (el) => (el?.getAttribute('class') || '').split(/\s+/).filter(Boolean);
const kids = (el) => el.childNodes.filter((n) => n.nodeType === 1);

// A deadline ahead lists the job under "Upcoming deadlines"; a follow-up of today under "Follow-ups due".
const job = { ...acme, status: 'phone_screen', role: 'Senior Software Engineer', deadline: dayFromToday(3), followUpDate: dayFromToday(0) };

it('R4-DPH-22: a summary row\'s status and date share one wrapper that stacks them below sm', async () => {
  const { JobSummary } = await loadModule('/src/components/job/JobSummary.jsx');
  const { datePillInfo } = await loadModule('/src/utils/uiFormat.js');
  const page = await render(JobSummary, { jobs: [job], onOpen: () => {} });
  try {
    for (const [title, date] of [['Upcoming deadlines', job.deadline], ['Follow-ups due', job.followUpDate]]) {
      // A card is <section><div><h2>title</h2>…</div><ul><li><button>…</section>.
      const card = page.all().find((el) => el.tagName === 'SECTION' && el.firstChild?.firstChild?.tagName === 'H2' && el.firstChild.firstChild.textContent === title);
      assert.ok(card, `the ${title} card`);
      const list = kids(card).find((el) => el.tagName === 'UL');
      assert.ok(list, `${title}: the job is listed`);
      const [row] = kids(list);
      const button = kids(row)[0];
      assert.equal(button?.tagName, 'BUTTON', `${title}: the row is one button`);

      const parts = kids(button);
      assert.equal(parts.length, 3, `${title}: the avatar, the company and role, then one wrapper, not the lozenge and the pill apart`);
      assert.match(parts[1].textContent, /^AcmeSenior Software Engineer$/, `${title}: the company and role are the middle part`);
      const wrapper = parts[2];
      const [lozenge, pill] = kids(wrapper);
      assert.equal(lozenge?.textContent, 'Phone Screen', `${title}: the status lozenge is in the wrapper`);
      assert.equal(pill?.getAttribute('title'), datePillInfo(date, new Date()).title, `${title}: the date pill is in the wrapper, under the lozenge`);

      const got = tokens(wrapper);
      for (const t of ['flex', 'shrink-0', 'items-center', 'gap-3']) assert.ok(got.includes(t), `${title}: from sm up a row with the old 0.75rem gap (${t}): ${got.join(' ')}`);
      for (const t of ['max-sm:flex-col', 'max-sm:items-end', 'max-sm:gap-1']) assert.ok(got.includes(t), `${title}: on a phone a right-aligned column (${t}): ${got.join(' ')}`);
      assert.ok(!got.includes('flex-col'), `${title}: tablet and desktop keep them side by side: ${got.join(' ')}`);
    }
  } finally {
    await page.view.unmount();
  }
});
