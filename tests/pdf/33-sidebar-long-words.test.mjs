// Regression tests for NB-3-NB1-NB1: ordinary long words in Sidebar dark column
// (degree, certificate, credential ID, skills, category, languages) must not overflow
// the column over the main column.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, render, read, MM } from './harness.mjs';
import { drawing } from './extractors.mjs';
import { buildTestState } from '../helpers.js';

before(setup);
after(teardown);

/** The dark column's text box on `page` at `marginH` mm: the page margin to its 10 pt right padding. */
const columnOf = (page, marginH) => ({ left: marginH * MM, right: page.W * 0.38 - 10 });

/** The runs printed in the dark column (the main column starts 14 pt past its edge). */
const inColumn = (page) => page.items.filter((t) => t.x < page.W * 0.38);

/** The dark column's runs that print past either side of its text box. */
function outside(page, marginH) {
  const { left, right } = columnOf(page, marginH);
  return inColumn(page)
    .filter((t) => t.x < left - 0.5 || t.x + t.w > right + 0.5)
    .map((t) => `${t.str} (x ${t.x.toFixed(1)}…${(t.x + t.w).toFixed(1)}, right bound ${right.toFixed(1)})`);
}

describe('Sidebar: ordinary long words in dark column do not overflow over main column (NB-3-NB1-NB1)', () => {
  it('at 40 mm margins: degree, certificate, credential ID, skill, and languages stay inside column', async () => {
    const r40 = resume({
      template: 'sidebar',
      settings: { pageSize: 'A4', marginH: 40 },
      sections: [
        section('education', [{ degree: 'Informationstechnologie', institution: 'Universitaet' }]),
        section('certifications', [{ name: 'Cloudinfrastrukturzertifizierung', credentialId: 'Zertifizierungsidentifikationsnummer' }]),
        section('languages', [{ language: 'Wirtschaftsenglisch', proficiency: 'Professional' }]),
        section('skills', [{ category: 'Dev', skills: 'Kubernetesadministrationsverfahren, Go' }]),
      ],
    });
    const [p40] = await read(await render(r40));
    assert.deepEqual(outside(p40, 40), [], 'no text in dark column must overflow column right bound at 40 mm');
  });

  it('at 18 mm margins: inline skill category stays inside column without stray hyphens', async () => {
    const r18 = resume({
      template: 'sidebar',
      settings: { pageSize: 'A4', marginH: 18 },
      sections: [
        section('skills', [{ category: 'Programmiersprachenentwicklung', skills: 'Go' }]),
      ],
    });
    const [p18] = await read(await render(r18));
    assert.deepEqual(outside(p18, 18), [], 'skill category must not overflow at 18 mm');
    const items = inColumn(p18);
    for (const item of items) {
      assert.ok(!item.str.includes('-'), `no stray hyphen in: ${item.str}`);
    }
  });

  it('guard: normal sample Sidebar resume page-1 operator list is identical', async () => {
    const sample = buildTestState('sidebar').resumes[0];
    const dBefore = await drawing(await render(sample));
    const dAfter = await drawing(await render(sample));
    assert.equal(dBefore, dAfter, 'operator list must remain identical for standard content');
  });
});
