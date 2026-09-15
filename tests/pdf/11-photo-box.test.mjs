// The profile photo's box and ring as page 1 draws them, read from pdf.js's operator list (no
// canvas needed): the ring's colour on the Sidebar panel (R3-3) and on every coloured ground
// (VM3-4), a box a long name cannot squeeze (R3-4), and the cover letter's photo on the
// résumé's shared table (R3-5).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { setup, teardown, resume, render, renderCover, loadModule } from './harness.mjs';

before(setup);
after(teardown);

// A 2×2 PNG: the photo's box comes from the Size/Height settings, not from the image.
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEElEQVR4nGP4z8AARAwQCgAf7gP9i18U1AAAAABJRU5ErkJggg==';
const round = (n) => Math.round(n * 100) / 100;

/** [a, b, c, d, e, f] × [a, b, c, d, e, f]: `m` applied after `t`, as PDF's `cm` concatenates. */
const times = (t, m) => [
  t[0] * m[0] + t[1] * m[2], t[0] * m[1] + t[1] * m[3],
  t[2] * m[0] + t[3] * m[2], t[2] * m[1] + t[3] * m[3],
  t[4] * m[0] + t[5] * m[2] + m[4], t[4] * m[1] + t[5] * m[3] + m[5],
];
/** A path's box [x0, y0, x1, y1] on the page, through the transform `m`. */
function onPage([x0, y0, x1, y1], m) {
  const xs = [[x0, y0], [x1, y1]].map(([x, y]) => x * m[0] + y * m[2] + m[4]);
  const ys = [[x0, y0], [x1, y1]].map(([x, y]) => x * m[1] + y * m[3] + m[5]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}
const size = (b) => ({ w: round(b.x1 - b.x0), h: round(b.y1 - b.y0) });

/**
 * Page 1's photo as drawn. react-pdf strokes each side of the ring along the box's edge at twice
 * the ring's width, clipped to the box, then clips the picture to the box inside the ring:
 *   box      the ring's outer box (the union of its strokes); the picture's without a ring
 *   ring     the ring's width in pt (half the stroke), 0 without one
 *   colours  the ring's stroke colours
 *   picture  the box the picture is clipped to
 *   radius   the picture's corner radius (where its clip path starts, from the box's left edge)
 * The ring is the strokes drawn around the picture: a page-wide rule is not one of them.
 */
async function drawnPhoto(bytes) {
  const doc = await pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, verbosity: 0 }).promise;
  const { fnArray, argsArray } = await (await doc.getPage(1)).getOperatorList();
  await doc.loadingTask.destroy();
  const O = pdfjs.OPS;
  const strokes = [];
  const stack = [];
  let m = [1, 0, 0, 1, 0, 0];
  let colour = null;
  let lineWidth = 0;
  let clipping = false;
  let clip = null;
  for (let k = 0; k < fnArray.length; k += 1) {
    const a = argsArray[k];
    const fn = fnArray[k];
    if (fn === O.save) stack.push(m);
    else if (fn === O.restore) m = stack.pop();
    else if (fn === O.transform) m = times(a, m);
    else if (fn === O.setStrokeRGBColor) colour = a[0];
    else if (fn === O.setLineWidth) lineWidth = a[0];
    else if (fn === O.clip) clipping = true;
    else if (fn === O.constructPath) {
      const [paint, [path], bounds] = a;
      if (clipping) {
        clip = { ...onPage(bounds, m), start: onPage([path[1], path[2], path[1], path[2]], m).x0 };
        clipping = false;
      } else if (paint === O.stroke) {
        strokes.push({ colour, lineWidth, ...onPage(bounds, m) });
      }
    } else if (fn === O.paintImageXObject) {
      const near = (s) => s.x0 >= clip.x0 - 10 && s.x1 <= clip.x1 + 10 && s.y0 >= clip.y0 - 10 && s.y1 <= clip.y1 + 10;
      const ring = strokes.filter(near);
      const box = ring.length ? {
        x0: Math.min(...ring.map((s) => s.x0)), y0: Math.min(...ring.map((s) => s.y0)),
        x1: Math.max(...ring.map((s) => s.x1)), y1: Math.max(...ring.map((s) => s.y1)),
      } : clip;
      return {
        box: size(box),
        ring: ring.length ? Math.max(...ring.map((s) => s.lineWidth)) / 2 : 0,
        colours: [...new Set(ring.map((s) => s.colour))],
        picture: size(clip),
        radius: round(clip.start - clip.x0),
      };
    }
  }
  return null;
}

describe('cover letter photo on the shared table (R3-5)', () => {
  // Guard (R3-5 is a refactor, not a fix): the numbers the letter's own getPhotoStyle printed at
  // 01e9118 — width 30 / 38 / 48 pt, Tall 1.4× and Portrait 1.8× (to the point), a 1.5 pt ring,
  // corners 5 pt Rounded, 1 pt Square, half the width Circle. The move to getPdfPhotoStyle was
  // also checked over 1500 option combinations: every page drawn identically before and after.
  const WIDTH = { sm: 30, md: 38, lg: 48 };
  const letter = async (settings) => drawnPhoto(await renderCover(resume({
    personal: { photo: PNG }, settings: { accentColor: '#e11d48', ...settings },
  })));

  for (const photoSize of ['sm', 'md', 'lg']) {
    it(`${photoSize}: a ${WIDTH[photoSize]} pt box, Tall and Portrait 1.4× and 1.8× as tall, in a 1.5 pt ring`, async () => {
      const w = WIDTH[photoSize];
      for (const [photoHeight, h] of [['match', w], ['tall', Math.round(w * 1.4)], ['taller', Math.round(w * 1.8)]]) {
        const p = await letter({ photoSize, photoHeight, photoShape: 'rounded', photoBorder: 'thin' });
        const at = `${photoSize} ${photoHeight}`;
        assert.deepEqual(p.box, { w, h }, `${at}: the box`);
        assert.equal(p.ring, 1.5, `${at}: the ring`);
        assert.deepEqual(p.colours, ['#e5e7eb'], `${at}: Thin is light grey`);
        assert.deepEqual(p.picture, { w: w - 3, h: h - 3 }, `${at}: the picture fills the ring`);
      }
    });
  }

  it('corners: 5 pt Rounded, 1 pt Square, a Circle ignores Height; Accent rings in the accent, None has no ring', async () => {
    for (const [photoShape, radius] of [['rounded', 5], ['square', 1], ['circle', 19]]) {
      const p = await letter({ photoShape, photoHeight: 'tall', photoBorder: 'none' });
      assert.equal(p.radius, radius, `${photoShape}: the corner radius`);
      assert.deepEqual(p.box, { w: 38, h: photoShape === 'circle' ? 38 : 53 }, `${photoShape}: the box`);
      assert.equal(p.ring, 0, `${photoShape}: no ring`);
    }
    const accent = await letter({ photoShape: 'circle', photoBorder: 'accent' });
    assert.deepEqual([accent.ring, accent.colours, accent.box], [1.5, ['#e11d48'], { w: 38, h: 38 }]);
  });
});

describe('the ring shows around the picture, read without a canvas (FIDA-43, R3-9)', () => {
  // 11-photo paints the page to see the ring, so it skips where @napi-rs/canvas (pdf.js's
  // optional dependency) is missing. This reads the same fact from the operator list: the
  // picture is clipped inside the ring's strokes. Before FIDA-43 the ring was the Image's own
  // border, and the picture, clipped to the whole box, painted over it.
  for (const [template, ring] of [['classic', 1.125], ['minimal', 1.125], ['executive', 1.125], ['modern', 1.5], ['sidebar', 1.125], ['cover letter', 1.5]]) {
    it(`${template}: the picture sits inside a ${ring} pt ring, whatever the shape`, async () => {
      const cover = template === 'cover letter';
      for (const photoShape of ['circle', 'rounded', 'square']) {
        const r = resume({ template: cover ? 'classic' : template, personal: { photo: PNG }, settings: { photoShape, photoBorder: 'accent' } });
        const p = await drawnPhoto(await (cover ? renderCover(r) : render(r)));
        assert.equal(p.ring, ring, `${photoShape}: the ring`);
        assert.deepEqual(p.picture, { w: round(p.box.w - 2 * ring), h: round(p.box.h - 2 * ring) }, `${photoShape}: the picture inside it`);
      }
    });
  }
});

describe('a long name beside the photo (R3-4)', () => {
  // One unbroken word wider than the page: the text cannot wrap, so the row overflows and
  // react-pdf shrinks its items. It read the photo's flexShrink: 0 as 1, so in the letter's
  // below-all header the ring narrowed to 42.86 pt while the picture kept its 45 pt, and a photo
  // without a ring was squeezed. Below-name and the résumé headers (a flex: 1 column beside the
  // photo) were not squeezed before either: guards. With contacts on the right (the default)
  // such a name stopped the letter rendering at all, until the name side got its 60 % cap.
  const NAME = 'Wolfeschlegelsteinhausenbergerdorff'.repeat(3);

  for (const fieldsPosition of ['right', 'below-name', 'below-all']) {
    it(`cover letter, contacts ${fieldsPosition}: the photo keeps its 48 pt box, the picture stays inside its ring`, async () => {
      for (const [photoBorder, picture] of [['accent', 45], ['none', 48]]) {
        const p = await drawnPhoto(await renderCover(resume({
          personal: { photo: PNG, name: NAME, title: NAME, email: 'pat@example.com' },
          settings: { photoSize: 'lg', photoShape: 'rounded', photoBorder },
          coverLetter: { fieldsPosition },
        })));
        assert.deepEqual(p.box, { w: 48, h: 48 }, `${photoBorder}: the box`);
        assert.deepEqual(p.picture, { w: picture, h: picture }, `${photoBorder}: the picture`);
      }
    });
  }

  it('résumé headers keep the photo\'s box too', async () => {
    for (const [template, w] of [['classic', 150], ['minimal', 150], ['executive', 150], ['modern', 51], ['sidebar', 82.5]]) {
      const p = await drawnPhoto(await render(resume({
        template, personal: { photo: PNG, name: NAME, title: NAME }, settings: { photoSize: 'lg', photoShape: 'rounded' },
      })));
      assert.deepEqual(p.box, { w, h: w }, template);
    }
  });
});

describe('Sidebar photo ring on the dark panel (R3-3)', () => {
  const NAVY = '#1e293b';
  const ring = async (settings) => drawnPhoto(await render(resume({
    template: 'sidebar', personal: { photo: PNG }, settings: { sidebarBg: NAVY, photoBorder: 'accent', ...settings },
  })));

  it('the default Accent ring reads on the panel: at least 3:1 with a new résumé\'s accent, #374151', async () => {
    const { contrast } = await loadModule('/src/templates/pdf/shared/pdfColors.js');
    const p = await ring({ accentColor: '#374151' });
    assert.equal(p.colours.length, 1, 'one ring colour');
    const ratio = contrast(p.colours[0], NAVY);
    assert.ok(ratio >= 3, `the ring ${p.colours[0]} is ${ratio.toFixed(2)}:1 on ${NAVY}`);
  });

  it('an accent that already reads on the panel is kept exactly; on a light panel a light accent darkens', async () => {
    const { contrast } = await loadModule('/src/templates/pdf/shared/pdfColors.js');
    assert.deepEqual((await ring({ accentColor: '#e11d48' })).colours, ['#e11d48'], 'a picked red on navy');
    assert.deepEqual((await ring({ accentColor: '#374151', sidebarBg: '#f1f5f9' })).colours, ['#374151'], 'the default accent on a light panel');
    const [light] = (await ring({ accentColor: '#e2e8f0', sidebarBg: '#f8fafc' })).colours;
    assert.ok(contrast(light, '#f8fafc') >= 3, `${light} on #f8fafc`);
  });

  it('Thin keeps its 25 % white over the panel, and Accent elsewhere is the accent itself', async () => {
    assert.deepEqual((await ring({ accentColor: '#374151', photoBorder: 'thin' })).colours, ['#565f6c']);
    const classic = await drawnPhoto(await render(resume({ personal: { photo: PNG }, settings: { accentColor: '#374151' } })));
    assert.deepEqual(classic.colours, ['#374151'], 'Classic on its white page');
  });
});

describe('every ring shows on what it sits on (VM3-4)', () => {
  // Rings on a coloured ground — the Sidebar panel, Modern's accent banner, and the letter in
  // those looks — are checked against it: Accent at 3:1 (WCAG for a graphic), Thin at least as
  // visible as Classic's Thin on the white page (#e5e7eb, 1.24:1). Only custom colours reach
  // this: on every preset both rings already clear it (the guard below).
  const photo = async (template, settings, cover = false) => {
    const r = resume({ template, personal: { photo: PNG, email: 'me@example.com' }, settings: { photoShape: 'circle', ...settings } });
    return drawnPhoto(await (cover ? renderCover(r) : render(r)));
  };
  const CASES = [
    // [what, template, the ground it sits on as a setting]
    ['Sidebar panel', 'sidebar', (bg) => ({ sidebarBg: bg })],
    ['Modern banner', 'modern', (bg) => ({ accentColor: bg })],
  ];

  for (const cover of [false, true]) {
    for (const [what, template, ground] of CASES) {
      it(`${cover ? 'cover letter, ' : ''}${what}: Thin and Accent rings show on a light ground`, async () => {
        const { contrast } = await loadModule('/src/templates/pdf/shared/pdfColors.js');
        const thinMin = contrast('#e5e7eb', '#ffffff');
        const wrong = [];
        for (const bg of ['#f8fafc', '#fde68a', '#ffffff']) {
          for (const [photoBorder, min] of [['thin', thinMin], ['accent', 3]]) {
            // Sidebar's Accent is the accent: a light one, so it has to be moved to show.
            const { colours } = await photo(template, { ...ground(bg), accentColor: template === 'sidebar' ? '#fef9c3' : bg, photoBorder }, cover);
            const ratio = contrast(colours[0], bg);
            if (colours.length !== 1 || !(ratio >= min - 1e-9)) wrong.push(`${photoBorder} ${colours} on ${bg}: ${ratio?.toFixed(2)}:1, needs ${min.toFixed(2)}`);
          }
        }
        assert.deepEqual(wrong, []);
      });
    }
  }

  // Guard: on the presets every ring already showed, and prints as it did.
  it('the presets keep their rings: white and half-white on Modern\'s accents, a quarter-white on the panels', async () => {
    for (const accentColor of ['#2563eb', '#ea580c', '#0d9488']) {
      assert.deepEqual((await photo('modern', { accentColor, photoBorder: 'accent' })).colours, ['#ffffff'], accentColor);
    }
    assert.deepEqual((await photo('modern', { accentColor: '#2563eb', photoBorder: 'thin' })).colours, ['#92b1f5']);
    assert.deepEqual((await photo('sidebar', { sidebarBg: '#14532d', photoBorder: 'thin' })).colours, ['#4f7e62']);
    assert.deepEqual((await photo('classic', { photoBorder: 'thin' })).colours, ['#e5e7eb'], 'Classic\'s Thin on white');
  });
});
