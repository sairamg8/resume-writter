// Contact icons: every pack the Design panel offers is drawn as that pack in the PDF.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, render, renderCover } from './harness.mjs';

let pdfjs;
before(async () => { ({ pdfjs } = await setup()); });
after(teardown);

const PERSONAL = {
  email: 'me@example.com', phone: '+1 555 0100', location: 'Berlin',
  website: 'example.com', linkedin: 'linkedin.com/in/me', github: 'github.com/me',
};

/**
 * What each pack draws for email, phone, location, website, LinkedIn and GitHub: one letter per
 * painted shape (S stroke, F fill, E even-odd fill), the stroke width in view-box units, and
 * where the phone's first shape starts — a handset (Classic, Bold), a smartphone outline
 * (Modern, Minimal) or a solid handset (Filled).
 */
const PACKS = {
  filled:  { width: null, shapes: ['F', 'F', 'E', 'E', 'E', 'F'], phoneStart: [7.05, 2.6] },
  lucide:  { width: 2, shapes: ['SS', 'S', 'SS', 'SSS', 'SSS', 'SS'], phoneStart: [13.832, 16.568] },
  refined: { width: 1.75, shapes: ['SS', 'SSF', 'SS', 'SSS', 'SSFSS', 'S'], phoneStart: [9.25, 2.5] },
  minimal: { width: 1.5, shapes: ['SS', 'SS', 'SS', 'SS', 'SS', 'SS'], phoneStart: [7, 3.5] },
  bold:    { width: 2.6, shapes: ['SS', 'S', 'SS', 'SSS', 'SSS', 'SS'], phoneStart: [13.832, 16.568] },
};

/**
 * The contact icons on page 1, in drawing order: each is the list of shapes painted inside one
 * <Svg viewBox="0 0 24 24"> (recognised by its scale-only transform), with coordinates in
 * view-box units.
 */
async function icons(bytes) {
  const doc = await pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, verbosity: 0 }).promise;
  const ops = await (await doc.getPage(1)).getOperatorList();
  await doc.loadingTask.destroy();
  const O = pdfjs.OPS;
  const PAINT = { [O.stroke]: 'S', [O.fill]: 'F', [O.eoFill]: 'E', [O.fillStroke]: 'B', [O.eoFillStroke]: 'B' };
  const out = [];
  const widths = [1];
  let icon = null;
  ops.fnArray.forEach((fn, k) => {
    const a = ops.argsArray[k];
    if (fn === O.save) widths.push(widths.at(-1));
    else if (fn === O.restore) {
      widths.pop();
      if (icon && widths.length < icon.depth) icon = null;
    } else if (fn === O.setLineWidth) widths[widths.length - 1] = a[0];
    else if (fn === O.transform && a[0] === a[3] && a[0] > 0 && a[0] < 1 && !a[1] && !a[2] && !a[4] && !a[5]) {
      icon = { depth: widths.length, shapes: [] };
      out.push(icon.shapes);
    } else if (fn === O.constructPath && icon && PAINT[a[0]]) {
      const data = Array.from(a[1][0] ?? [], (v) => Math.round(v * 1000) / 1000);
      icon.shapes.push({ paint: PAINT[a[0]], width: PAINT[a[0]] === 'S' ? widths.at(-1) : null, start: data.slice(1, 3), data });
    }
  });
  return out;
}

const DOCUMENTS = [
  ['classic', (settings) => render(resume({ template: 'classic', settings, personal: PERSONAL }))],
  ['sidebar', (settings) => render(resume({ template: 'sidebar', settings, personal: PERSONAL }))],
  ['cover letter', (settings) => renderCover(resume({ settings, personal: PERSONAL }))],
];

describe('contact icon packs (FIDA-39, FIDB-07)', () => {
  for (const [name, make] of DOCUMENTS) {
    it(`${name}: each pack is drawn as itself, and no two packs look alike`, async () => {
      const seen = new Map();
      for (const [iconSet, pack] of Object.entries(PACKS)) {
        const drawn = await icons(await make({ iconSet, contactStyle: 'icon' }));
        assert.equal(drawn.length, 6, `${iconSet}: ${drawn.length} icons`);
        drawn.forEach((shapes, i) => {
          assert.equal(shapes.map((s) => s.paint).join(''), pack.shapes[i], `${iconSet} icon ${i + 1}`);
          for (const s of shapes.filter((x) => x.paint === 'S')) assert.equal(s.width, pack.width, `${iconSet} stroke width`);
        });
        const [x, y] = drawn[1][0].start;
        assert.ok(Math.abs(x - pack.phoneStart[0]) < 0.01 && Math.abs(y - pack.phoneStart[1]) < 0.01, `${iconSet} phone starts at ${x},${y}`);
        const signature = JSON.stringify(drawn);
        for (const [other, sig] of seen) assert.notEqual(signature, sig, `${iconSet} draws the same icons as ${other}`);
        seen.set(iconSet, signature);
      }
    });
  }
});
