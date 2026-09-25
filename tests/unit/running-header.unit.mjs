// ATS-7, option A: the running header's words and its place in the top margin (constants/runningHeader.js),
// which the PDF (PdfRunningHeader) and Word (a header on every page but the first) both read. It must sit
// inside the margin, clear of the text, or be left out — it never moves the page's text.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  RUNNING_HEADER_PT, RUNNING_HEADER_LINE_PT, runningHeaderLead, runningHeaderText, runningHeaderTop,
} from '../../src/constants/runningHeader.js';

const MM = 72 / 25.4;

test('the words: "Name · Page N", the name on one line; "Page N" with no name', () => {
  assert.equal(runningHeaderText('Pat Lee', 2), 'Pat Lee · Page 2');
  assert.equal(runningHeaderText('  Pat \n Lee  ', 3), 'Pat Lee · Page 3');
  assert.equal(runningHeaderLead('Pat Lee'), 'Pat Lee · Page ');
  for (const name of ['', '   ', null, undefined]) assert.equal(runningHeaderText(name, 2), 'Page 2', JSON.stringify(name));
});

test('it is a caption: smaller than the smallest body size the editor offers', () => {
  assert.ok(RUNNING_HEADER_PT < 8, `${RUNNING_HEADER_PT} pt`);
  assert.equal(RUNNING_HEADER_LINE_PT, RUNNING_HEADER_PT * 1.2);
});

test('every margin with room holds it centred and clear of the text: 2 pt above and below at least', () => {
  for (let mm = 5; mm <= 40; mm += 1) {
    const top = runningHeaderTop(mm);
    assert.ok(top != null, `${mm} mm`);
    const margin = mm * MM;
    assert.ok(top >= 2 - 1e-9, `${mm} mm: ${top} pt from the paper's edge`);
    assert.ok(top + RUNNING_HEADER_LINE_PT <= margin - 2 + 1e-9, `${mm} mm: its line ends at ${top + RUNNING_HEADER_LINE_PT} pt, the text starts at ${margin}`);
    assert.ok(Math.abs(top + RUNNING_HEADER_LINE_PT / 2 - margin / 2) < 1e-9, `${mm} mm: not centred`);
  }
});

test('a margin with no room for it, or none at all, leaves it out', () => {
  for (const mm of [0, 1, 2, 3, 4, -5, NaN, undefined, null, 'x']) assert.equal(runningHeaderTop(mm), null, String(mm));
  assert.equal(runningHeaderTop('14'), runningHeaderTop(14));
});

test('a band along the paper\'s top edge (the Banner\'s strip) is kept clear: it prints between the band and the text', () => {
  for (const [mm, inset] of [[14, 6], [10, 6], [40, 6], [8, 6]]) {
    const top = runningHeaderTop(mm, inset);
    assert.ok(top != null, `${mm} mm under a ${inset} pt band`);
    assert.ok(top >= inset + 2 - 1e-9, `${mm} mm: ${top} pt, the band ends at ${inset}`);
    assert.ok(top + RUNNING_HEADER_LINE_PT <= mm * MM - 2 + 1e-9, `${mm} mm: it reaches the text`);
  }
  assert.equal(runningHeaderTop(5, 6), null, 'no room under the band');
  assert.equal(runningHeaderTop(14, 0), runningHeaderTop(14));
});
