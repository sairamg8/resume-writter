// R5-IMP-01b: the PDF prints a list's levels with the default Bullet style as '•', '–', '·', but the PDF
// import did not know '·' as a list marker. A third-level item was glued onto its parent's text
// ("B · C", when the gap after the dot is a word gap) or became a paragraph "· C" outside the list
// (when the gap reads as a tab). A '·' leading a line right under a list item is that item's marker
// now; a '·' anywhere else (a separator) reads as before.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeFromText } from '../../src/utils/importText.js';
import { pdfLinesOfPages } from '../../src/utils/importFile.js';

const item = (str, x, y, w, h = 10) => ({ str, x, y, w, h });
const jobOf = (r) => r.sections.find((s) => s.type === 'experience')?.items[0];
/** A job whose description is A > B > C, the '·' run `gap` pt before C's text. */
const page = (gap) => [
  item('Robin Vale', 40, 760, 80), item('EXPERIENCE', 40, 720, 70),
  item('Acme', 40, 690, 40), item('2020 – Present', 450, 690, 80), item('Engineer', 40, 676, 60),
  item('•', 40, 640, 4), item('Led the platform team', 48, 640, 110),
  item('–', 48, 626, 5), item('Ran the on-call rota', 56, 626, 100),
  item('·', 56, 612, 2.8), item('Cut pages by half', 58.8 + gap, 612, 90),
];

for (const [path, gap] of [['a tab-wide gap after the dot', 6.2], ['a word gap after the dot', 3]]) {
  test(`a third-level '·' item is a list item of its own (${path})`, () => {
    const lines = pdfLinesOfPages([page(gap)]).map((l) => l.text).filter(Boolean);
    assert.deepEqual(lines.slice(-3), ['• Led the platform team', '– Ran the on-call rota', '• Cut pages by half']);
    assert.equal(jobOf(resumeFromText(pdfLinesOfPages([page(gap)]))).description,
      '<ul><li>Led the platform team</li><li>Ran the on-call rota</li><li>Cut pages by half</li></ul>');
  });
}

test('a wrapped third-level item joins its own text, not its parent\'s', () => {
  const p = [...page(6.2), item('in one quarter', 65, 598, 70)];
  assert.deepEqual(pdfLinesOfPages([p]).map((l) => l.text).filter(Boolean).slice(-2), ['– Ran the on-call rota', '• Cut pages by half in one quarter']);
});

test('a line starting with a "·" separator, under no list item, reads as before', () => {
  const p = [item('Robin Vale', 40, 760, 80), item('CERTIFICATIONS', 40, 720, 90),
    item('AWS Certified Data Engineer', 40, 690, 150), item('·', 40, 676, 2.8), item('ID: X-1', 49, 676, 40)];
  assert.equal(pdfLinesOfPages([p]).map((l) => l.text).filter(Boolean).at(-1), '·\tID: X-1');
});

// A '·' the user typed as a separator can start a wrapped line: the PDF's line breaking may break at the
// space before it. The app prints a '·' marker only under a '–' item, so under any other item the line
// is a wrap of that item and joins it. Reading it as a marker split "Tools: … · Terraform" into two
// bullets, lost its '·', and made an award's wrapped tail its description.
const wrapUnder = (sec, entry, bullets) => pdfLinesOfPages([[item('Robin Vale', 40, 760, 80), item(sec, 40, 720, 90), ...entry, ...bullets]]);
test('a line wrapped before a typed "·" under a "•" item joins the item, "·" and all', () => {
  const lines = wrapUnder('EXPERIENCE', page(6.2).slice(2, 5), [
    item('•', 40, 660, 4), item('Tools: React · Node · Docker · Kubernetes · Postgres', 49, 660, 480),
    item('· Terraform and AWS', 49, 646, 100), item('•', 40, 632, 4), item('Led the team', 49, 632, 70)]);
  assert.equal(jobOf(resumeFromText(lines)).description,
    '<ul><li>Tools: React · Node · Docker · Kubernetes · Postgres · Terraform and AWS</li><li>Led the team</li></ul>');
  const awards = wrapUnder('AWARDS', [item('Best Paper', 40, 690, 60), item('2022', 500, 690, 30)], [
    item('•', 40, 676, 4), item('Program Committee — Special', 49, 676, 480), item('· Mention 2022', 49, 662, 80)]);
  const award = resumeFromText(awards).sections.find((s) => s.type === 'awards')?.items;
  assert.deepEqual(award.map((a) => [a.title, a.description]), [['Best Paper', '<ul><li>Program Committee — Special · Mention 2022</li></ul>']]);
});

// Under a '–' item a wrapped line and a '·' marker start at one x. The app sets list items 1.5 pt further
// apart than a wrapped line's pitch: a "·" at the wrap's pitch is a separator, one an item's step down a marker.
test('under a "–" item, a "·" at a wrapped line\'s pitch is a separator, at a new item\'s a marker', () => {
  const lines = wrapUnder('EXPERIENCE', page(6.2).slice(2, 5), [
    item('•', 40, 650, 4), item('Led the platform team', 49, 650, 110),
    item('–', 49, 635, 5), item('Tools: React · Node · Docker · Kubernetes · Postgres', 58, 635, 472),
    item('· Terraform and AWS', 58, 621.5, 100),
    item('· Cut pages by half', 58, 606.5, 90),
    item('•', 40, 591, 4), item('Shipped billing', 49, 591, 70)]);
  assert.deepEqual(lines.filter((l) => l.text).slice(-4).map((l) => [l.depth || 0, l.text]), [
    [0, '• Led the platform team'], [1, '– Tools: React · Node · Docker · Kubernetes · Postgres · Terraform and AWS'],
    [2, '• Cut pages by half'], [0, '• Shipped billing']]);
});
