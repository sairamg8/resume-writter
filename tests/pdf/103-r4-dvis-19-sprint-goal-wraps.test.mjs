// R4-DVIS-19: a sprint's goal in its backlog header. The goal is a full-width line of the header's
// wrapping flex row (basis-full), but a flex item is never narrower than its longest word, so a goal
// holding a link ("https://example.com/aaaa…") ran past the header and the sprint's section, and the
// backlog's scroll box scrolled sideways, at every width. The goal now may shrink below that word
// (min-w-0) and breaks it at the line's edge (break-words), as the checklist's items do. The real
// Backlog page over fake-dom (tests/pdf/103-r4-backlog-page.mjs); fake-dom has no layout, so the
// class tokens that make the browser wrap it are checked. Fictional data only.
import { it } from 'node:test';
import assert from 'node:assert/strict';
import { useBacklogPage, mountBacklog, project, futureSprint, issue, tokens } from './103-r4-backlog-page.mjs';

useBacklogPage();

const goal = `https://example.com/${'a'.repeat(200)}`;

it('R4-DVIS-19: a sprint goal with a long unbroken word may shrink and breaks the word at the header\'s edge', async () => {
  const page = mountBacklog([project({ mode: 'scrum', sprints: [{ ...futureSprint('s2', 'Sprint 2'), goal }], issues: [issue('i1', 1, 'Planned', 'c1', { sprintId: 's2' })] })]);
  try {
    const section = page.section('s2');
    assert.ok(section, 'the sprint\'s section');
    const header = page.all(section).find((el) => el.tagName === 'HEADER');
    assert.ok(header, 'the sprint has its header');
    const line = page.all(header).find((el) => el.tagName === 'P' && el.textContent === goal);
    assert.ok(line, 'the goal is shown in the sprint\'s header');
    assert.ok(line.parentNode === header, 'the goal is a flex item of the header');

    const got = tokens(line);
    assert.ok(got.has('basis-full'), 'the goal still takes a line of its own under the name');
    assert.ok(got.has('min-w-0'), 'the goal may be narrower than its longest word, so the header keeps its width');
    assert.ok(got.has('break-words'), 'the long word breaks at the line\'s edge instead of running past it');
    assert.ok(got.has('pl-9'), 'the goal stays indented under the name');
  } finally {
    await page.view.unmount();
  }
});
