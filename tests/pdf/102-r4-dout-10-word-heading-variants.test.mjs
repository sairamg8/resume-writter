// R4-DOUT-10: the designed layouts' own section-heading marks in the Word résumé. The PDF draws
// Broadsheet's rule over the title (none under it), Gridline's over and under it, Registry's underline
// dotted, Chronicle's double and Keystone's box with a bar at its left edge (sectionHeadingLook's
// `variant`); Word printed each style's plain form — Broadsheet's rule under the title, on the wrong side.
// Now Word draws each as a paragraph border; Classic's Ruled is as before.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, experience, renderDocx } from './harness.mjs';

before(setup);
after(teardown);

const cv = (template, headingStyle) => resume({
  template,
  settings: { accentColor: '#e11d48', sectionTitleCase: 'upper', headingStyle, sectionBorderWidth: 1 },
  sections: [experience([{}])],
  personal: { name: 'Pat Sample' },
});

/** The heading paragraph's borders: side → its w:val, from <w:pBdr>. */
async function borders(template, headingStyle) {
  const p = (await renderDocx(cv(template, headingStyle))).paragraphs.find((q) => q.text === 'PROFESSIONAL EXPERIENCE');
  assert.ok(p, `${template}: a heading in Word`);
  const pBdr = /<w:pBdr>(.*?)<\/w:pBdr>/s.exec(p.xml)?.[1] || '';
  return Object.fromEntries([...pBdr.matchAll(/<w:(top|bottom|left|right) w:val="(\w+)"/g)].map((m) => [m[1], m[2]]));
}

describe('Word draws the designed layouts\' section-heading marks as the PDF does (R4-DOUT-10)', () => {
  it('Broadsheet: the rule over the title, none under it', async () => {
    assert.deepEqual(await borders('broadsheet', 'ruled'), { top: 'single' });
  });

  it('Gridline: rules over and under the title', async () => {
    assert.deepEqual(await borders('gridline', 'ruled'), { top: 'single', bottom: 'single' });
  });

  it('Registry\'s underline is dotted, Chronicle\'s double', async () => {
    assert.deepEqual(await borders('registry', 'underline'), { bottom: 'dotted' });
    assert.deepEqual(await borders('chronicle', 'underline'), { bottom: 'double' });
  });

  it('Keystone\'s box has a bar at its left edge', async () => {
    assert.deepEqual(await borders('keystone', 'box'), { left: 'single' });
  });

  it('Classic keeps its single rule under the title', async () => {
    assert.deepEqual(await borders('classic', 'ruled'), { bottom: 'single' });
    assert.deepEqual(await borders('classic', 'underline'), { bottom: 'single' });
  });
});
