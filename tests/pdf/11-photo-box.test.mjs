// The profile photo's box and ring as page 1 draws them, read from pdf.js's operator list (no
// canvas needed): the ring's colour on the Sidebar panel (R3-3) and on every coloured ground
// (VM3-4), a box a long name cannot squeeze (R3-4), and the cover letter's photo on the
// résumé's shared table (R3-5).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, render, renderCover, loadModule } from './harness.mjs';
import { painted, PNG_2X2 as PNG } from './extractors.mjs';

before(setup);
after(teardown);

const round = (n) => Math.round(n * 100) / 100;
const size = (b) => ({ w: round(b.x1 - b.x0), h: round(b.y1 - b.y0) });

/**
 * Page 1's photo as drawn (painted(), in extractors.mjs). react-pdf strokes each side of the ring
 * along the box's edge at twice the ring's width, clipped to the box, then clips the picture to
 * the box inside the ring:
 *   box      the ring's outer box (the union of its strokes); the picture's without a ring
 *   ring     the ring's width in pt (half the stroke), 0 without one
 *   colours  the ring's stroke colours
 *   picture  the box the picture is clipped to
 *   radius   the picture's corner radius (where its clip path starts, from the box's left edge)
 * The ring is the strokes drawn around the picture: a page-wide rule is not one of them.
 */
async function drawnPhoto(bytes) {
  const paths = await painted(bytes);
  const at = paths.findIndex((p) => p.paint === 'image');
  if (at < 0) return null;
  const earlier = paths.slice(0, at);
  const clip = earlier.findLast((p) => p.paint === 'clip');
  const near = (s) => s.x0 >= clip.x0 - 10 && s.x1 <= clip.x1 + 10 && s.y0 >= clip.y0 - 10 && s.y1 <= clip.y1 + 10;
  const ring = earlier.filter((p) => p.paint === 'stroke' && near(p));
  const box = ring.length ? {
    x0: Math.min(...ring.map((s) => s.x0)), y0: Math.min(...ring.map((s) => s.y0)),
    x1: Math.max(...ring.map((s) => s.x1)), y1: Math.max(...ring.map((s) => s.y1)),
  } : clip;
  return {
    box: size(box),
    ring: ring.length ? Math.max(...ring.map((s) => s.width)) : 0,
    colours: [...new Set(ring.map((s) => s.colour))],
    picture: size(clip),
    radius: round(clip.start - clip.x0),
  };
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
  // 11-photo paints the page to see the ring, through @napi-rs/canvas. This reads the same fact
  // from the operator list, with no canvas: the picture is clipped inside the ring's strokes.
  // Before FIDA-43 the ring was the Image's own border, and the picture, clipped to the whole
  // box, painted over it.
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
  // those looks — are checked against it: the Sidebar's Accent at 3:1 (WCAG for a graphic),
  // Modern's white Accent at 1.5:1 (where it would vanish, V2W2b-0), Thin at least as visible as
  // Classic's Thin on the white page (#e5e7eb, 1.24:1). Only custom colours reach this: on every
  // preset the rings already clear it (the guard below).
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
          for (const [photoBorder, min] of [['thin', thinMin], ['accent', template === 'sidebar' ? 3 : 1.5]]) {
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

  // Modern's Accent ring is white, like the banner's name and contacts, and printed white on
  // every accent until 73e5c3c held it to 3:1: on a mid-tone custom accent — white reads at
  // 2.15 to 2.77:1 on these — it turned dark grey (#575757 on #22c55e), résumé and letter, with no
  // edit. It moves only where it would vanish, a pastel below 1.5:1 (V2W2b-0).
  it('Modern\'s white Accent ring stays white on a mid-tone accent, résumé and letter (V2W2b-0)', async () => {
    const wrong = [];
    for (const accentColor of ['#22c55e', '#0ea5e9', '#f59e0b', '#06b6d4', '#f472b6', '#60a5fa']) {
      for (const cover of [false, true]) {
        const { colours } = await photo('modern', { accentColor, photoBorder: 'accent' }, cover);
        if (colours.join() !== '#ffffff') wrong.push(`${cover ? 'letter' : 'résumé'} on ${accentColor}: ${colours}`);
      }
    }
    assert.deepEqual(wrong, []);
  });

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
