// R4-DPH-19: the job form's Interview Stage section on a phone. The picked stage's pill beside the
// heading kept its one-line width (shrink-0 ml-4) in a header that could not wrap: a predefined stage
// squeezed the description into a narrow column, and a long custom stage (they have no length cap) ran
// past the section's border. The section also kept p-6 where the form's other sections are p-4 sm:p-6.
// Now the header wraps (the pill goes under the heading when the two do not fit), the pill is at most
// the section's width and its stage wraps inside it, and the section is p-4 on a phone. The fake DOM
// has no layout, so this reads the classes the browser lays the section out by, on the real component
// (tests/pdf/fake-dom.mjs, loaded through Vite).
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const LONG = 'x'.repeat(60);

it('R4-DPH-19: the picked stage\'s pill wraps under the heading and inside itself, in a section padded as its siblings', async () => {
  const { InterviewStageSelector } = await loadModule('/src/components/job/InterviewStageSelector.jsx');
  const dom = await import('./fake-dom.mjs');
  const view = dom.mount(InterviewStageSelector, {
    stage: LONG, onStageChange: () => {}, customStages: [LONG], addCustomStage: () => null, removeCustomStage: () => {},
  });
  try {
    const all = [...dom.elements(view.container)];
    const classes = (el) => (el.getAttribute('class') || '').split(/\s+/).filter(Boolean);

    const section = all.find((el) => el.tagName === 'SECTION');
    const s = classes(section);
    assert.ok(s.includes('p-4') && s.includes('sm:p-6') && !s.includes('p-6'), `p-4 on a phone, p-6 from sm up: ${s.join(' ')}`);

    const heading = all.find((el) => el.tagName === 'H2' && el.textContent === 'Interview Stage');
    const header = heading.parentNode.parentNode;
    const h = classes(header);
    assert.ok(h.includes('flex') && h.includes('flex-wrap'), `the header wraps: ${h.join(' ')}`);
    assert.ok(h.includes('gap-x-4') && h.includes('gap-y-2'), `spaced both ways: ${h.join(' ')}`);

    const pill = all.find((el) => el.tagName === 'DIV' && el.textContent === LONG);
    assert.ok(pill, 'the picked stage shows in its pill');
    assert.equal(pill.parentNode, header, 'beside (or under) the heading');
    const p = classes(pill);
    assert.ok(p.includes('bg-brand-subtle'), `the pill: ${p.join(' ')}`);
    assert.ok(p.includes('max-w-full') && p.includes('min-w-0'), `at most the section's width: ${p.join(' ')}`);
    assert.ok(p.includes('[overflow-wrap:anywhere]'), `a long stage wraps inside it: ${p.join(' ')}`);
    assert.ok(!p.includes('shrink-0') && !p.includes('ml-4'), `no fixed width, and no margin left over when it wraps: ${p.join(' ')}`);
  } finally {
    await view.unmount();
  }
});
