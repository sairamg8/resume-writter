// One list of photo choices, read by both the panel that offers them and the PDF that clamps to
// them (AUD-25). The clamp used to restate the four lists in two more files, so a chip added to the
// panel would have been drawn as the default instead — silently, with no test able to see it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PHOTO_OPTIONS, PHOTO_DEFAULTS, photoOption } from '../../src/constants/photoOptions.js';

const KEYS = ['photoShape', 'photoSize', 'photoBorder', 'photoHeight', 'photoTextAlign'];
const read = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

test('photoOption: a value the panel offers is kept, anything else is the control default', () => {
  assert.equal(photoOption('photoShape', 'square'), 'square');
  assert.equal(photoOption('photoShape', 'oval'), 'circle', "an imported 'oval' is not drawn");
  assert.equal(photoOption('photoHeight', 'portrait'), 'match', 'a height no build offered');
  assert.equal(photoOption('photoSize', undefined), 'md');
  assert.equal(photoOption('photoBorder', null), 'accent');
  assert.equal(photoOption('photoTextAlign', 'middle'), 'center');
  for (const key of KEYS) {
    assert.equal(photoOption(key, PHOTO_DEFAULTS[key]), PHOTO_DEFAULTS[key], `${key} default survives itself`);
    for (const { val } of PHOTO_OPTIONS[key]) assert.equal(photoOption(key, val), val, `${key} offers ${val}`);
  }
});

test('every control has a label per option and a default it offers', () => {
  for (const key of KEYS) {
    const options = PHOTO_OPTIONS[key];
    assert.ok(options?.length, `${key} has options`);
    for (const o of options) assert.ok(o.val && o.label, `${key}: every option has a val and a label`);
    assert.ok(options.some((o) => o.val === PHOTO_DEFAULTS[key]), `${key}: its default is one of its options`);
  }
});

test('the panel and the PDF read the options from here', () => {
  for (const file of [
    'src/components/PersonalInfoEditorPhoto.jsx',      // the chips it offers
    'src/templates/pdf/shared/pdfPhoto.js',            // the shape, size, border and height it draws
    'src/templates/pdf/shared/templateSettings.js',    // the settings every PDF renders with
  ]) {
    assert.match(read(file), /constants\/photoOptions/, `${file} imports the one list`);
  }
});

test('no file restates a photo option list — that is what let the clamp drift (AUD-25)', () => {
  // A restated list is two of a control's values inside one bracketed literal, as the three copies
  // this replaced were: `new Set(['circle', 'rounded', 'square'])`. Using a value on its own —
  // `sh === 'rounded' ? …`, the geometry each option draws — is not a list and stays allowed.
  const files = fs.globSync('src/**/*.{js,jsx}', { cwd: new URL('../..', import.meta.url) })
    .filter((f) => !f.endsWith('constants/photoOptions.js'));
  assert.ok(files.length > 50, 'the scan found the source tree');
  for (const file of files) {
    const text = read(file);
    for (const [key, options] of Object.entries(PHOTO_OPTIONS)) {
      const vals = options.map((o) => o.val).join('|');
      const restated = new RegExp(`\\[[^\\]]*'(?:${vals})'[^\\]]*'(?:${vals})'[^\\]]*\\]`);
      assert.doesNotMatch(text, restated, `${file} restates ${key} instead of importing it`);
    }
  }
});
