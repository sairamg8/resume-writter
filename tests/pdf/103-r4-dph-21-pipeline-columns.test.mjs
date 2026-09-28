// R4-DPH-21: the Summary's Pipeline rows gave the step name a 7.5rem column (wider than the
// longest name, "Phone Screen") and 0.75rem gaps, which left the bar only about 54px in the
// two-column cards of a 1280px desktop and about 69px on a phone. The name column is now 6rem and
// the gaps 0.5rem, at every width, so the bar gets about 86px and 101px there. The fake DOM has
// no layout: this pins the row's column template. Fictional data only.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { acme, render } from './100-r4-job-helpers.mjs';

before(setup);
after(teardown);

const tokens = (el) => (el?.getAttribute('class') || '').split(/\s+/).filter(Boolean);

it('each Pipeline row is a 6rem name, the bar and a 5.5rem rate, 0.5rem apart', async () => {
  const { JobSummary } = await loadModule('/src/components/job/JobSummary.jsx');
  const page = await render(JobSummary, { jobs: [acme, { ...acme, id: 'b', company: 'Beta', status: 'phone_screen' }], onOpen: () => {} });
  try {
    // A card is <section><div><h2>title</h2>…</div>…</section>; the Pipeline card holds one <ol>.
    const pipeline = page.all().find((el) => el.tagName === 'SECTION' && el.firstChild?.firstChild?.tagName === 'H2' && el.firstChild.firstChild.textContent === 'Pipeline');
    assert.ok(pipeline, 'the Pipeline card');
    const list = pipeline.childNodes.find((el) => el.tagName === 'OL');
    const rows = list.childNodes.filter((el) => el.tagName === 'LI');
    assert.deepEqual(rows.map((li) => li.firstChild.textContent), ['Applied', 'Phone Screen', 'Interview', 'Offer']);
    for (const li of rows) {
      const t = tokens(li);
      assert.ok(t.includes('grid-cols-[6rem_1fr_5.5rem]'), `a 6rem name column: ${t.join(' ')}`);
      assert.ok(t.includes('gap-2'), `0.5rem gaps: ${t.join(' ')}`);
      assert.ok(!t.includes('grid-cols-[7.5rem_1fr_5.5rem]') && !t.includes('gap-3'), 'not the old 7.5rem column and 0.75rem gaps');
    }
  } finally {
    await page.view.unmount();
  }
});
