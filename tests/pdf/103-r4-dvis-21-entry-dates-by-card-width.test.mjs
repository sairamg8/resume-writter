// R4-DVIS-21: an open Experience, Education, Projects, Volunteering or Custom entry put its Start and End
// dates side by side from `sm:` — the window's 640 px. On a tablet or a desktop the editor is a 360 px
// panel however wide the window, so each date had about 125 px while a month picker needs about 153
// (177 with its ×): the Start picker's year and × ran under the End one, and End's year and × were cut
// off at the entry card's edge. The rows go two-up by the entry card's own width now (`@sm:grid-cols-2`
// against ItemCard's body, a size container), so in the panel and on a phone the dates stack, and a
// picker's selects may shrink to their cell. The fake DOM has no layout, so this reads the classes the
// browser lays out by, on the real entry components (tests/pdf/fake-dom.mjs, loaded through Vite).
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements } from './fake-dom.mjs';

before(setup);
after(teardown);

const classes = (el) => (el.getAttribute('class') || '').split(/\s+/).filter(Boolean);
const noop = () => {};

/** The nearest ancestor of `el` carrying class `token`, or null. */
function ancestorWith(el, token) {
  for (let n = el.parentNode; n && n.nodeType === 1; n = n.parentNode) if (classes(n).includes(token)) return n;
  return null;
}

const ENTRIES = [
  ['ExperienceItem', 'Start Date', { id: 'e1', company: 'Acme', role: 'Dev', startDate: 'Jan 2020', endDate: 'Mar 2022', current: false, description: '' }],
  ['EducationItem', 'Start Date', { id: 'd1', institution: 'State U', degree: 'BSc', startDate: 'Sep 2014', endDate: 'Jun 2018', description: '' }],
  ['ProjectItem', 'Start Date', { id: 'p1', name: 'Tidewatch', startDate: 'Jan 2021', endDate: 'Feb 2022', description: '' }],
  ['VolunteeringItem', 'Start Date', { id: 'v1', org: 'Harbor Trust', role: 'Guide', startDate: 'May 2019', endDate: 'Aug 2019', description: '' }],
  ['CustomItem', 'Date / Period', { id: 'c1', title: 'Talk', subtitle: 'Conf', date: 'Jan 2020', location: 'Oslo', description: '' }],
];

for (const [name, dateLabel, item] of ENTRIES) {
  it(`R4-DVIS-21: an open ${name}'s date row goes two-up by the card's width, not the window's, and its pickers fit their cells`, async () => {
    const component = (await loadModule('/src/components/SectionEditorEntryItems.jsx'))[name];
    const view = mount(component, { item, onUpdate: noop, onRemove: noop, onDuplicate: noop, defaultOpen: true });
    try {
      const all = [...elements(view.container)];
      const label = all.find((el) => el.tagName === 'LABEL' && el.textContent.trim() === dateLabel);
      assert.ok(label, `the open entry shows its ${dateLabel}`);
      const grid = ancestorWith(label, 'grid');
      assert.ok(grid, `${dateLabel} sits in a grid row`);
      const own = classes(grid);
      assert.ok(own.includes('grid-cols-1'), `one column by default: ${own.join(' ')}`);
      assert.ok(own.includes('@sm:grid-cols-2'), `two once the entry card is wide enough: ${own.join(' ')}`);
      assert.ok(!own.includes('sm:grid-cols-2') && !own.includes('grid-cols-2'), `not two by the window's width: ${own.join(' ')}`);
      assert.ok(ancestorWith(grid, '@container'), 'the entry card\'s body is the size container the row is measured against');

      const selects = all.filter((el) => el.tagName === 'SELECT' && / (month|year)$/.test(el.getAttribute('aria-label') || ''));
      assert.ok(selects.length >= 2, `the date pickers show: ${selects.map((s) => s.getAttribute('aria-label')).join(', ')}`);
      for (const select of selects) {
        assert.ok(classes(select).includes('min-w-0'), `${select.getAttribute('aria-label')} may shrink to its cell: ${classes(select).join(' ')}`);
      }
    } finally {
      await view.unmount();
    }
  });
}
