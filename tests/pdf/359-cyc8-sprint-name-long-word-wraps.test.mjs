// A sprint named with one long unbroken token (a pasted address, 60+ characters) made the Backlog scroll sideways: the name's button
// has no wrapping rule of its own, so the token was as wide as the whole header and widened it past the screen (the goal line got
// min-w-0 break-words from round 1, the name did not). The name now breaks anywhere ([overflow-wrap:anywhere], as the project Summary
// does for its description) inside its wrapper, which is held to the header's width (min-w-0 max-w-full, tests/pdf/103-r4-dvis-17).
// The fake DOM has no layout: the real Backlog page over fake-dom (tests/pdf/103-r4-backlog-page.mjs) is read for the classes the
// browser lays the name out by.
// Run: node --test tests/pdf/359-cyc8-sprint-name-long-word-wraps.test.mjs
import { it } from 'node:test';
import assert from 'node:assert/strict';
import { useBacklogPage, mountBacklog, project, futureSprint, issue, tokens } from './103-r4-backlog-page.mjs';

useBacklogPage();

const LONG = `https://example.com/${'planning'.repeat(9)}`;

it('a sprint named with a 90-character unbroken token wraps inside the header instead of widening the backlog', async () => {
  const page = mountBacklog([project({ mode: 'scrum', sprints: [futureSprint('s2', LONG)], issues: [issue('i1', 1, 'Planned', 'c1', { sprintId: 's2' })] })]);
  try {
    const section = page.section('s2');
    const name = page.button(`${LONG}, edit Sprint name`, section);
    assert.ok(name, 'the sprint name is shown, to click and rename');
    assert.ok(tokens(name).has('[overflow-wrap:anywhere]'), `the name breaks at the header's edge: ${[...tokens(name)].join(' ')}`);
    const wrapper = name.parentNode;
    assert.ok(tokens(wrapper).has('min-w-0') && tokens(wrapper).has('max-w-full'), 'and its wrapper is held to the header width');
  } finally {
    await page.view.unmount();
  }
});
