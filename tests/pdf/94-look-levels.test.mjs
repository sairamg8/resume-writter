// R2-147 (Languages' Level) — Section Options → Level (section setting levelStyle) draws a language's
// proficiency beside its word in the PDF (= the preview) on every template, the main column's and the
// Sidebar's side column: Dots — five small circles, the level's filled — or Bar — a track and its fill.
// The words still print. A proficiency the scale does not know draws nothing. Text and unset print the
// same page. Word, Markdown and ATS text print the words alone, as before. There was no Level: every
// language printed its word only.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, render, allText, read, renderDocx, loadModule, TEMPLATES } from './harness.mjs';
import { snapshot } from './parity/measure.mjs';

before(setup);
after(teardown);

const LANGS = [
  { language: 'Portuguese', proficiency: 'Native' },
  { language: 'English', proficiency: 'Fluent' },
  { language: 'Spanish', proficiency: 'Conversational' },
  // Words the scale does not know: printed, nothing drawn.
  { language: 'Latin', proficiency: 'Reading only' },
];
const KNOWN = 3;

/** Every template, and the Sidebar's Single · ATS-safe (its languages in the main column). */
const VARIANTS = [...TEMPLATES.map((template) => ({ template, settings: {} })), { template: 'sidebar', settings: { sidebarSingleColumn: true } }];
const name = (v) => `${v.template}${v.settings.sidebarSingleColumn ? '+single' : ''}`;

const cv = ({ template, settings }, levelStyle, items = LANGS) => resume({
  template, settings,
  sections: [section('languages', items, levelStyle === undefined ? {} : { levelStyle })],
});

/** The small shapes a page paints: round ones (a dot) and flat ones (a bar's track or fill). */
function shapes(snap) {
  const [w, h] = [(p) => p.x1 - p.x0, (p) => p.y1 - p.y0];
  const fills = snap.paint.filter((p) => p.paint === 'fill');
  return {
    dots: fills.filter((p) => w(p) >= 2 && w(p) <= 8 && Math.abs(w(p) - h(p)) < 0.6),
    bars: fills.filter((p) => h(p) >= 1.5 && h(p) <= 6 && w(p) >= 2 * h(p) && w(p) <= 60),
  };
}

/** Is `p` on a language's line, or on the line under it (the side column): below the top of its run, within 20 pt. */
const byALanguage = (snap, p) => snap.pages[p.page - 1].items.some((t) => LANGS.some((l) => t.str.includes(l.language))
  && t.x <= p.x0 + 1 && t.y + t.h >= (p.y0 + p.y1) / 2 && t.y + t.h - (p.y0 + p.y1) / 2 <= 20);

describe('Languages: Level → Dots or Bar draws the proficiency beside its word (R2-147)', () => {
  it('every template: Text prints the page unset prints; Dots paints 5 circles and Bar a track and its fill per known level, by its language; the words still print', async () => {
    const wrong = [];
    for (const v of VARIANTS) {
      const [unset, text, dots, bar] = await Promise.all([undefined, 'text', 'dots', 'bar'].map(async (s) => snapshot(await render(cv(v, s)))));
      if (text.drawing !== unset.drawing) wrong.push(`${name(v)}: Text prints another page than unset`);
      const base = shapes(unset);
      const got = { dots: shapes(dots), bar: shapes(bar) };
      if (got.dots.dots.length - base.dots.length !== 5 * KNOWN) wrong.push(`${name(v)} dots: ${got.dots.dots.length - base.dots.length} more circles, not ${5 * KNOWN}`);
      if (got.dots.bars.length !== base.bars.length) wrong.push(`${name(v)} dots: a bar is painted`);
      if (got.bar.bars.length - base.bars.length !== 2 * KNOWN) wrong.push(`${name(v)} bar: ${got.bar.bars.length - base.bars.length} more bar shapes, not ${2 * KNOWN}`);
      if (got.bar.dots.length !== base.dots.length) wrong.push(`${name(v)} bar: a circle is painted`);
      // The drawn shapes hang from their languages: no more lie away from every language than unset's own.
      const stray = (snap, list) => list.filter((p) => !byALanguage(snap, p)).length;
      for (const [s, snap, list, was] of [['dots', dots, got.dots.dots, base.dots], ['bar', bar, got.bar.bars, base.bars]]) {
        if (stray(snap, list) > stray(unset, was)) wrong.push(`${name(v)} ${s}: ${stray(snap, list) - stray(unset, was)} shape(s) away from any language`);
        for (const l of LANGS) for (const word of [l.language, l.proficiency]) if (!snap.text.includes(word)) wrong.push(`${name(v)} ${s}: "${word}" does not print`);
      }
      if (dots.drawing === bar.drawing || dots.drawing === unset.drawing || bar.drawing === unset.drawing) wrong.push(`${name(v)}: two of Text, Dots and Bar print the same page`);
    }
    assert.deepEqual(wrong, []);
  });

  it('the level shows: Dots and Bar draw Native and Basic differently; a proficiency it does not know draws nothing', async () => {
    const one = (proficiency) => [{ language: 'Portuguese', proficiency }];
    for (const v of [{ template: 'classic', settings: {} }, { template: 'sidebar', settings: {} }]) {
      for (const s of ['dots', 'bar']) {
        const [hi, lo] = await Promise.all(['Native', 'Basic'].map(async (p) => snapshot(await render(cv(v, s, one(p))))));
        assert.notEqual(hi.drawing, lo.drawing, `${name(v)} ${s}: Native and Basic draw the same`);
        const [unknown, plain] = await Promise.all([s, undefined].map(async (x) => snapshot(await render(cv(v, x, one('Reading only'))))));
        assert.equal(unknown.drawing, plain.drawing, `${name(v)} ${s}: an unknown proficiency draws something`);
      }
    }
  });

  it('Word, Markdown and ATS text print the words alone, exactly as unset', async () => {
    const { generateMarkdownResume } = await loadModule('/src/utils/markdownExport.js');
    const { generateAtsPlainText } = await loadModule('/src/utils/atsPlainText.js');
    for (const v of [{ template: 'classic', settings: {} }, { template: 'sidebar', settings: {} }]) {
      const plain = cv(v, undefined);
      for (const s of ['dots', 'bar']) {
        const drawn = { ...plain, sections: plain.sections.map((x) => ({ ...x, settings: { ...x.settings, levelStyle: s } })) };
        assert.deepEqual((await renderDocx(drawn)).texts, (await renderDocx(plain)).texts, `${name(v)} ${s}: Word`);
        assert.equal(generateMarkdownResume(drawn), generateMarkdownResume(plain), `${name(v)} ${s}: Markdown`);
        assert.equal(generateAtsPlainText(drawn), generateAtsPlainText(plain), `${name(v)} ${s}: ATS text`);
        assert.match(allText(await read(await render(drawn))).replace(/\s+/g, ' '), /English\s*Fluent|English.*Fluent/, `${name(v)} ${s}: the PDF's words`);
      }
    }
  });
});
