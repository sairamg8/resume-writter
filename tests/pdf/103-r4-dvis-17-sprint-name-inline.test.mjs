// R4-DVIS-17: a sprint's name in its backlog header. The header is a wrapping flex row (the fold
// chevron, the name, Active, the dates, the count, the actions), and the name's InlineEdit box is
// always calc(100% + 0.75rem) wide so its hover box reaches past the text. As a flex item of the
// header, that 100% was the header's whole width, so the name wrapped onto a line of its own under
// the chevron at every width, and the rest onto a third. The name now sits in a wrapper that is
// the flex item instead: the wrapper is as wide as the text (min-w-0 max-w-full), the box's 100%
// resolves against it, and the name stays beside the chevron. The real Backlog page over fake-dom
// (tests/pdf/103-r4-backlog-page.mjs); fake-dom has no layout, so the structure and classes are checked.
// Run: node --test tests/pdf/103-r4-dvis-17-sprint-name-inline.test.mjs
import { it } from 'node:test';
import assert from 'node:assert/strict';
import { useBacklogPage, mountBacklog, project, futureSprint, issue, tokens } from './103-r4-backlog-page.mjs';

useBacklogPage();

it('R4-DVIS-17: the sprint\'s name is not a header flex item of its own but sits in a wrapper as wide as its text', async () => {
  const page = mountBacklog([project({ mode: 'scrum', sprints: [futureSprint('s2', 'Sprint 2')], issues: [issue('i1', 1, 'Planned', 'c1', { sprintId: 's2' })] })]);
  try {
    const section = page.section('s2');
    const header = page.all(section).find((el) => el.tagName === 'HEADER');
    assert.ok(header, 'the sprint has its header');
    const name = page.button('Sprint 2, edit Sprint name', section);
    assert.ok(name, 'the sprint\'s name is shown, to click and rename');

    const wrapper = name.parentNode;
    assert.ok(wrapper !== header, 'the name\'s box is a flex item of the header: its calc(100% + 0.75rem) takes the whole header');
    assert.equal(wrapper.tagName, 'DIV');
    assert.ok(wrapper.parentNode === header, 'the wrapper is the header\'s flex item, beside the fold chevron');
    const got = tokens(wrapper);
    assert.ok(got.has('min-w-0'), 'the wrapper may shrink in the header\'s row');
    assert.ok(got.has('max-w-full'), 'a long name is held to the header\'s width');
    for (const t of ['w-full', 'flex-1', 'basis-full', 'grow']) assert.equal(got.has(t), false, `${t} puts the name back on a line of its own`);

    // Being renamed, the field stays in the same wrapper.
    page.click(name);
    const field = page.byLabel('Sprint name', section);
    assert.equal(field?.tagName, 'INPUT', 'clicking the name did not open its field');
    assert.ok(field.parentNode === wrapper, 'the field left the wrapper');
  } finally {
    await page.view.unmount();
  }
});
