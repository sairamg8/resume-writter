// Colour helpers: borders must be opaque hex; fills keep alpha; odd inputs stay valid.
import { it } from 'node:test';
import assert from 'node:assert/strict';
import { parseColor, solid, tint } from '../../src/templates/pdf/shared/pdfColors.js';

it('solid() blends a translucent colour onto its background', () => {
  assert.equal(solid('#2563eb', 0x30 / 255), '#d6e2fb'); // 37·0.19 + 255·0.81 = 214 …
  assert.equal(solid('#2563eb30'), '#d6e2fb');
  assert.equal(solid('rgba(255,255,255,0.25)', 1, '#1e293b'), '#565f6c');
  assert.equal(solid('#2563eb'), '#2563eb');
});

it('tint() gives a valid #rrggbbaa for any colour the user can pick or import', () => {
  assert.equal(tint('#2563eb', 0x30 / 255), '#2563eb30');
  assert.equal(tint('#abc', 0.5), '#aabbcc80');
  assert.equal(tint('rgb(37, 99, 235)', 1), '#2563eb');
  assert.equal(tint('red', 0.5), 'red'); // names pass through (react-pdf reads them)
});

it('parseColor() reads #rgb, #rgba, #rrggbb, #rrggbbaa, rgb(), rgba()', () => {
  assert.deepEqual(parseColor('#fff'), [255, 255, 255, 1]);
  assert.deepEqual(parseColor('#0008'), [0, 0, 0, 0x88 / 255]);
  assert.deepEqual(parseColor('rgba(1, 2, 3, 50%)'), [1, 2, 3, 0.5]);
  assert.equal(parseColor('not a colour'), null);
});
