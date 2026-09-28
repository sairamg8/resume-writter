// R4-DVIS-08: a job page's "Posting" link copied the kit button's classes by hand and fell behind
// them: no pressed state (active:bg-brand-subtle), no select-none, no whitespace-nowrap or
// shrink-0, a shorter transition, and its icon could be squeezed. It now takes the kit's
// buttonClass() and lays out its icon and label as Button does, so it matches the Edit button
// beside it; it is still a plain link to the posting in a new tab. Fictional data only.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { setup, teardown, loadModule } from './harness.mjs';
import { acme, atRoute } from './100-r4-job-helpers.mjs';

before(setup);
after(teardown);

const tokens = (value) => String(value || '').split(/\s+/).filter(Boolean).sort();

it('the Posting link wears the kit\'s buttonClass, with a shrink-0 icon and a truncating label', async () => {
  const { buttonClass } = await loadModule('/src/components/ui/Button.jsx');
  const { JobDetail } = await loadModule('/src/pages/JobDetail.jsx');
  const page = await atRoute('/jobs/a', { '/jobs/:id': h(JobDetail, { store: { appState: { resumes: [] } } }) }, [{ ...acme, url: 'https://jobs.acme.example/1' }]);
  try {
    const link = page.all().find((el) => el.tagName === 'A' && el.getAttribute('title') === 'Open job posting');
    assert.ok(link, 'the Posting link');
    assert.equal(link.getAttribute('href'), 'https://jobs.acme.example/1');
    assert.equal(link.getAttribute('target'), '_blank');
    assert.equal(link.getAttribute('rel'), 'noopener noreferrer');
    const look = tokens(link.getAttribute('class'));
    assert.deepEqual(look, tokens(buttonClass()), 'the kit\'s secondary md button');
    for (const t of ['shrink-0', 'whitespace-nowrap', 'select-none', 'active:bg-brand-subtle']) assert.ok(look.includes(t), `${t} in "${link.getAttribute('class')}"`);
    const icon = link.childNodes.find((el) => el.tagName === 'svg');
    assert.ok(icon && tokens(icon.getAttribute('class')).includes('shrink-0'), 'the icon never shrinks');
    const label = link.childNodes.find((el) => el.tagName === 'SPAN');
    assert.equal(label?.textContent, 'Posting');
    assert.ok(tokens(label.getAttribute('class')).includes('truncate'), 'the label truncates, as a Button\'s does');
  } finally {
    await page.view.unmount();
    delete globalThis.localStorage;
  }
});
