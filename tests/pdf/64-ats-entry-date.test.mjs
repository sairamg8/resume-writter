// ATS-2: an entry's date lies inside the header an item-based parser reads. OpenResume ends a job's
// header at the first bullet glyph; with none (paragraphs, a numbered list) at the first line that is
// one run of 8+ words, else after 2 lines — 1 for a project. Anything past it is description, so a
// date printed there is lost (model: ats-entry-header.mjs). The date used to print:
//   - on a line of its own under the header under Alignment "Center" — line 3 in Title "Stacked",
//     and under a one-run 8-word header line in "Inline" / "Side by side";
//   - on line 2 of every project, under "name · technologies · link".
// Now the date sits on the entry's first line, as its own run: right-aligned beside the name
// (Left), or after " · " (Center). A project's technologies and link move to the line under it.
// The default left-aligned job header already kept its date on line 1 (73d1d2f); guarded below.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, read, render, loadModule, TEMPLATES } from './harness.mjs';
import { lines, blocks, headerText } from './ats-entry-header.mjs';

before(setup);
after(teardown);

const ALL = [...TEMPLATES, 'sidebar-single'];
const OL = '<ol><li>Led the checkout rebuild.</li><li>Built the design system.</li></ol>';
const PARAS = '<p>Tech: React, Node.js</p><p>Shipped it.</p>';

/** The demo résumé of `template` ('sidebar-single': the Sidebar's ATS-safe column), `edit`ed. */
async function demo(template, edit) {
  const { DEMO_RESUMES } = await loadModule('/tests/fixtures/sampleResumes.js');
  const id = template === 'sidebar-single' ? 'sidebar' : template;
  const r = structuredClone(DEMO_RESUMES.find((x) => x.template === id));
  if (template === 'sidebar-single') r.settings = { ...r.settings, sidebarSingleColumn: true };
  edit(r);
  return r;
}

/** Per entry of `type`: its date string, unless it is inside the header the parser reads. */
async function lostDates(r, type, cap) {
  const [{ dateRange, presentLabel }, { resolveSection }, { templateId }] = await Promise.all([
    loadModule('/src/utils/dates.js'),
    loadModule('/src/templates/pdf/shared/templateSectionDefaults.js'),
    loadModule('/src/constants/templates.js'),
  ]);
  const sec = resolveSection(r.sections.find((s) => s.type === type), templateId(r.template));
  const items = sec.items.filter((i) => i.visible !== false);
  const anchors = items.map((i) => (type === 'projects' ? i.name : (sec.settings.titleOrder === 'role' ? i.role : i.company)));
  const found = blocks(lines(await read(await render(r))), anchors, { after: sec.title });
  const lost = [];
  items.forEach((item, k) => {
    const end = item.current ? presentLabel(r.settings) : item.endDate;
    const date = dateRange(item.startDate, end, r.settings);
    if (!found[k]) lost.push(`${anchors[k]}: entry not found`);
    else if (!headerText(found[k], cap).includes(date)) lost.push(`${anchors[k]}: ${date} not in header [${headerText(found[k], cap)}]`);
  });
  return lost;
}

/** Experience laid out with `settings`, every job described by `description`. */
const jobs = (settings, description, role1) => (r) => {
  const exp = r.sections.find((s) => s.type === 'experience');
  exp.settings = { ...exp.settings, ...settings };
  exp.items.forEach((i) => { i.description = description; });
  if (role1) exp.items[0].role = role1;
};

describe('Alignment Center keeps every job\'s date inside the parser\'s header (ATS-2)', () => {
  for (const template of ALL) {
    it(`${template}: Title Stacked, a numbered-list description`, async () => {
      const r = await demo(template, jobs({ alignment: 'center', titleStyle: 'stacked' }, OL));
      assert.deepEqual(await lostDates(r, 'experience', 2), []);
    });
  }
  // 9 words with no digit, and short enough to share its line with the date.
  const LONG = 'Lead UI Engineer, Design Systems Team';
  for (const template of ALL.filter((t) => t !== 'sidebar')) {
    for (const titleStyle of ['inline', 'sidebyside']) {
      it(`${template}: Title ${titleStyle}, a header line of 8+ words`, async () => {
        const r = await demo(template, jobs({ alignment: 'center', titleStyle }, OL, LONG));
        assert.deepEqual(await lostDates(r, 'experience', 2), []);
      });
    }
  }
});

describe('every project\'s date is on its first line, the one line a parser gives a project (ATS-2)', () => {
  for (const template of ALL) {
    for (const alignment of ['left', 'center']) {
      it(`${template}, ${alignment}: paragraph descriptions`, async () => {
        const r = await demo(template, (x) => {
          const p = x.sections.find((s) => s.type === 'projects');
          p.settings = { ...p.settings, alignment };
          p.items.forEach((i) => { i.description = PARAS; });
        });
        assert.deepEqual(await lostDates(r, 'projects', 1), []);
      });
    }
  }
});

describe('left-aligned jobs keep the date in the header in every Title style (guard, 73d1d2f)', () => {
  for (const template of ALL) {
    for (const titleStyle of ['stacked', 'inline', 'sidebyside']) {
      it(`${template}, Title ${titleStyle}`, async () => {
        const r = await demo(template, jobs({ alignment: 'left', titleStyle }, OL));
        assert.deepEqual(await lostDates(r, 'experience', 2), []);
      });
    }
  }
});
