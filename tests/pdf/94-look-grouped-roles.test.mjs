// R2-147 (grouped roles) — Experience's Section Options → "Group roles by company" (settings.groupRoles):
// consecutive roles at one company (trimmed, any case) print under one employer header — the company
// once, then each role with its own dates and description — in the PDF (= the preview) on every
// template and layout, in one column and in Grids 2, whatever the Title and Alignment, and in Word and
// Markdown. A location printed only where a role's differs from the first's; the ATS text keeps every
// role with its company. Off (unset or false) prints exactly as before. Every role printed its company.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, experience, render, read, allText, renderDocx, loadModule, TEMPLATES } from './harness.mjs';
import { snapshot } from './parity/measure.mjs';

before(setup);
after(teardown);

const JOBS = [
  { company: 'Northwind Labs', role: 'Staff Engineer', location: 'Lisbon', startDate: '01/2021', endDate: '', current: true, description: '<p>Ran the billing rewrite.</p>' },
  // The same company typed another way: still the same employer.
  { company: ' northwind LABS ', role: 'Lead Engineer', location: 'Porto', startDate: '06/2019', endDate: '12/2020', description: '<p>Moved the payment jobs.</p>' },
  { company: 'Contoso Retail', role: 'Senior Engineer', location: 'Braga', startDate: '03/2017', endDate: '05/2019', description: '<p>Built the checkout.</p>' },
];
const cv = (template, section = {}, settings = {}, jobs = JOBS) => resume({ template, settings, sections: [experience(jobs, section)] });
/** Every template, and the Sidebar's Single · ATS-safe layout (Classic's page). */
const VARIANTS = [...TEMPLATES.map((t) => [t, {}]), ['sidebar', { sidebarSingleColumn: true }]];

const times = (text, re) => (text.match(new RegExp(re, 'gi')) || []).length;
const textOf = async (r) => allText(await read(await render(r))).replace(/\s+/g, ' ');

describe('Experience: Group roles by company (R2-147)', () => {
  it('every template and layout: on, the company prints once over both roles, each with its dates; off, with each role', async () => {
    const wrong = [];
    for (const [template, settings] of VARIANTS) {
      const on = await textOf(cv(template, { groupRoles: true }, settings));
      const off = await textOf(cv(template, {}, settings));
      const name = `${template}${settings.sidebarSingleColumn ? ' single' : ''}`;
      if (times(on, 'northwind labs') !== 1) wrong.push(`${name} on: "Northwind Labs" ${times(on, 'northwind labs')}×`);
      if (times(off, 'northwind labs') !== 2) wrong.push(`${name} off: "Northwind Labs" ${times(off, 'northwind labs')}×`);
      for (const t of ['Staff Engineer', 'Lead Engineer', 'Contoso Retail', 'Senior Engineer', '12/2020', 'Porto', 'Moved the payment jobs']) {
        if (!on.includes(t)) wrong.push(`${name} on: "${t}" does not print`);
      }
    }
    assert.deepEqual(wrong, []);
  });

  it('Title, Alignment and Grids 2: the company prints once with each', async () => {
    const wrong = [];
    for (const template of ['classic', 'executive', 'sidebar', 'timeline']) {
      for (const opts of [{ titleStyle: 'inline' }, { titleStyle: 'sidebyside' }, { alignment: 'center' }, { columns: 2 }, { titleOrder: 'role' }, { titleOrder: 'company' }]) {
        const on = await textOf(cv(template, { groupRoles: true, ...opts }));
        if (times(on, 'northwind labs') !== 1 || !on.includes('Lead Engineer')) wrong.push(`${template} ${JSON.stringify(opts)}: ${on.slice(0, 200)}`);
      }
    }
    assert.deepEqual(wrong, []);
  });

  it('off (unset or false), and on with no two roles at one company, print exactly as before', async () => {
    const apart = [JOBS[0], JOBS[2], JOBS[1]]; // a job between the two Northwind roles keeps them apart
    for (const [template, settings] of VARIANTS) {
      const was = (await snapshot(await render(cv(template, {}, settings)))).drawing;
      assert.equal((await snapshot(await render(cv(template, { groupRoles: false }, settings)))).drawing, was, `${template}: false`);
      const alone = (await snapshot(await render(cv(template, {}, settings, apart)))).drawing;
      assert.equal((await snapshot(await render(cv(template, { groupRoles: true }, settings, apart)))).drawing, alone, `${template}: nothing to group`);
    }
  });

  it('Word groups them as the PDF does: one employer paragraph, a paragraph per role', async () => {
    for (const template of ['classic', 'sidebar', 'timeline']) {
      const on = (await renderDocx(cv(template, { groupRoles: true }))).texts;
      const off = (await renderDocx(cv(template))).texts;
      assert.equal(on.filter((t) => /northwind labs/i.test(t)).length, 1, `${template} on: ${on.join(' / ')}`);
      assert.equal(off.filter((t) => /northwind labs/i.test(t)).length, 2, `${template} off: ${off.join(' / ')}`);
      for (const t of ['Staff Engineer', 'Lead Engineer', 'Porto', 'Contoso Retail']) assert.ok(on.some((p) => p.includes(t)), `${template} on: "${t}"`);
    }
  });

  it('Markdown groups them; the ATS text keeps every role with its company, on or off', async () => {
    const { generateMarkdownResume } = await loadModule('/src/utils/markdownExport.js');
    const { generateAtsPlainText } = await loadModule('/src/utils/atsPlainText.js');
    const [on, off] = [cv('classic', { groupRoles: true }), cv('classic')];
    const md = generateMarkdownResume(on);
    assert.equal(times(md, 'northwind labs'), 1, md);
    assert.match(md, /^### \*\*Northwind Labs\*\*$/m);
    assert.match(md, /^#### \*\*Staff Engineer\*\*$/m);
    assert.match(md, /^#### \*\*Lead Engineer\*\*$/m);
    assert.match(md, /Porto/);
    assert.match(md, /^### \*\*Contoso Retail\*\* — \*Senior Engineer\*$/m);
    assert.equal(generateMarkdownResume(cv('classic', { groupRoles: false })), generateMarkdownResume(off));
    assert.equal(generateAtsPlainText(on), generateAtsPlainText(off));
    assert.equal(times(generateAtsPlainText(on), 'northwind labs'), 2);
  });
});
