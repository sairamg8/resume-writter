// R4-DVIS-32: the Job Tracker's Summary shows the Career History panel in an aside beside JobSummary's
// kit cards (a 6 px radius, the `border-line` edge, flat, the ink tokens), but the panel kept the
// résumé side's look there (a 16 px radius, a shadow, a gray-100 edge, gray text), so the one card
// looked out of place. CareerHistoryPanel now takes `variant`: 'workspace', which the Job Tracker
// passes, draws it as the kit's cards are drawn; the default, 'dashboard', is the Dashboard's look it
// always had, beside the Dashboard's own cards. The fake DOM has no layout, so this pins the classes on
// the real JobTracker (?view=summary) and CareerHistoryPanel, mounted with react-dom/client over
// tests/pdf/fake-dom.mjs, with a fictional résumé and job.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { setup, teardown, loadModule, resume, experience } from './harness.mjs';
import { acme, atRoute, render } from './100-r4-job-helpers.mjs';

before(setup);
after(teardown);

const tokens = (el) => (el?.getAttribute('class') || '').split(/\s+/).filter(Boolean);
const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();
const within = (el) => {
  const out = [];
  const walk = (n) => { if (n.nodeType === 1) out.push(n); n.childNodes.forEach(walk); };
  walk(el);
  return out;
};

const cv = () => Object.assign(
  resume({ personal: { name: 'Idris Vane', title: 'Lighthouse Keeper' }, sections: [experience([{ company: 'Brightwater Light', role: 'Keeper' }])] }),
  { name: 'Lighthouse CV', updatedAt: 1000 },
);

it('on the Job Tracker\'s Summary the Career History panel is drawn as the kit cards beside it', async () => {
  const { patchFakeDom } = await import('../unit/ui-dom-harness.mjs');
  patchFakeDom();
  const { JobTracker } = await loadModule('/src/pages/JobTracker.jsx');
  const one = cv();
  const page = await atRoute('/jobs?view=summary', { '/jobs': h(JobTracker, { store: { appState: { resumes: [one], activeId: one.id } } }) }, [acme]);
  try {
    const aside = page.all().find((el) => el.tagName === 'ASIDE' && el.getAttribute('aria-label') === 'Career history');
    assert.ok(aside, 'the Summary view, with its career history');
    const panel = aside.childNodes.at(-1);
    assert.ok(text(panel).includes('Idris Vane') && text(panel).includes('Brightwater Light'), 'the panel, with the résumé\'s name and job');

    // A kit card of JobSummary's: <section><div><h2>title</h2>…</div>…</section>.
    const card = page.all().find((el) => el.tagName === 'SECTION' && el.firstChild?.firstChild?.tagName === 'H2' && el.firstChild.firstChild.textContent === 'Pipeline');
    assert.ok(card, 'the Pipeline card beside it');
    for (const t of ['rounded-md', 'border', 'border-line', 'bg-white']) {
      assert.ok(tokens(card).includes(t), `the kit card has ${t}`);
      assert.ok(tokens(panel).includes(t), `the panel has ${t}, as the kit card beside it: ${tokens(panel).join(' ')}`);
    }
    for (const t of ['rounded-2xl', 'shadow-sm', 'border-gray-100']) {
      assert.ok(!tokens(panel).includes(t), `no ${t}: the résumé side's look beside flat kit cards`);
    }
    const [header] = panel.childNodes;
    assert.ok(tokens(header).includes('border-line') && !tokens(header).includes('border-gray-100'), 'the header\'s rule is the kit\'s line');

    const inside = within(panel);
    const name = inside.find((el) => el.tagName === 'P' && text(el) === 'Idris Vane');
    assert.ok(tokens(name).includes('text-ink') && tokens(name).includes('font-semibold'), `the name in the kit's ink, as a kit card's title: ${tokens(name).join(' ')}`);
    const company = inside.find((el) => el.tagName === 'P' && text(el) === 'Brightwater Light');
    assert.ok(tokens(company).includes('text-ink'), `the company in the kit's ink: ${tokens(company).join(' ')}`);
    const muted = inside.find((el) => el.tagName === 'P' && text(el) === 'Lighthouse Keeper');
    assert.ok(tokens(muted).includes('text-ink-subtlest'), `the job title in the kit's subtlest ink: ${tokens(muted).join(' ')}`);
    const gray = inside.filter((el) => tokens(el).some((t) => /^text-gray-\d+$/.test(t)));
    assert.deepEqual(gray.map((el) => `${el.tagName} ${text(el)}`), [], 'no gray text of the résumé side left in the panel');
  } finally {
    await page.view.unmount();
    delete globalThis.localStorage;
  }
});

it('the Dashboard\'s panel (the default look) keeps the Dashboard cards\' look', async () => {
  const { CareerHistoryPanel } = await loadModule('/src/components/CareerHistoryPanel.jsx');
  const one = cv();
  function Panel() {
    return h(MemoryRouter, null, h(CareerHistoryPanel, { resumes: [one], activeId: one.id }));
  }
  const page = await render(Panel, {});
  try {
    const panel = page.view.container.firstChild;
    assert.ok(text(panel).includes('Idris Vane'), 'the panel');
    for (const t of ['rounded-2xl', 'border', 'border-gray-100', 'shadow-sm', 'bg-white']) {
      assert.ok(tokens(panel).includes(t), `the Dashboard's panel keeps ${t}: ${tokens(panel).join(' ')}`);
    }
    assert.ok(!tokens(panel).includes('border-line'), 'not the workspace look on the Dashboard');
    const name = within(panel).find((el) => el.tagName === 'P' && text(el) === 'Idris Vane');
    assert.ok(tokens(name).includes('text-gray-900') && tokens(name).includes('font-bold'), 'its name as before');
  } finally { await page.view.unmount(); }
});
