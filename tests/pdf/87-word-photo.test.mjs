// The profile photo in the Word résumé (R2-126). The PDF prints Personal Info → Photo in every
// template's header — beside the name, or above it in a centred header and the Sidebar's column — at
// the size, height and shape Photo sets, cropped to fill its box (objectFit "cover"), with its ring;
// the eye hides it, and a photo the PDF cannot draw (a WebP or GIF saved before uploads were
// converted) prints nowhere. The .docx had no photo at all. Now Word prints the same photo: the PDF's
// box (getPdfPhotoStyle), a circle as an ellipse and Rounded and Square as rounded rectangles, the
// picture cropped to the box, Thin and Accent as its outline — beside the name in a borderless table
// row, the photo's cell as wide as it and the Photo ↔ Text gap, or above the name when centred.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, renderDocx, loadModule, TEMPLATES } from './harness.mjs';

before(setup);
after(teardown);

/** A 4 × 2 px PNG, twice as wide as tall, and a 2 × 2 JPEG, as the editor stores uploads. */
const PNG_4X2 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAACCAIAAADwyuo0AAAAEElEQVR4nGP4z8AARwzIHABvqgf5gNwAKAAAAABJRU5ErkJggg==';
const JPEG_2X2 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/wAALCAACAAIBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAB//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AGn//2Q==';
const GIF = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const EMU = 12700; // per pt

const cv = (template, personal = {}, settings = {}) => resume({
  template,
  settings: { accentColor: '#e11d48', ...settings },
  personal: { name: 'Robin Sample', title: 'Engineer', email: 'robin@example.com', photo: JPEG_2X2, ...personal },
});

/** The .docx's pictures: each one's extent (pt), shape, crop and outline. */
function pictures(xml) {
  return [...xml.matchAll(/<w:drawing>(.*?)<\/w:drawing>/gs)].map(([, d]) => ({
    xml: d,
    w: Number(/<wp:extent cx="(\d+)"/.exec(d)[1]) / EMU,
    h: Number(/<wp:extent cx="\d+" cy="(\d+)"/.exec(d)[1]) / EMU,
    shape: /<a:prstGeom prst="(\w+)"/.exec(d)[1],
    adj: Number(/<a:gd name="adj" fmla="val (\d+)"\/>/.exec(d)?.[1] ?? NaN),
    crop: Object.fromEntries([...(/<a:srcRect([^>]*)\/>/.exec(d)?.[1] || '').matchAll(/(\w)="(-?\d+)"/g)].map((m) => [m[1], Number(m[2])])),
    ring: /<a:ln w="(\d+)"[^>]*>.*?<a:srgbClr val="(\w+)"/s.exec(d)?.slice(1) ?? null,
  }));
}

describe('Word: the résumé prints the photo, as the PDF does (R2-126)', () => {
  it('every template prints it once, at the size of the PDF\'s photo', async () => {
    const { getPdfPhotoStyle } = await loadModule('/src/templates/pdf/shared/pdfPhoto.js');
    const { resolveTemplateSettings } = await loadModule('/src/templates/pdf/shared/templateSettings.js');
    for (const template of TEMPLATES) {
      const r = cv(template);
      const pics = pictures((await renderDocx(r)).xml);
      assert.equal(pics.length, 1, `${template}: one photo`);
      const s = resolveTemplateSettings(r.settings, template);
      const box = getPdfPhotoStyle(s, s.accentColor, ['modern', 'banner'].includes(template) ? 'modern' : 'classic');
      const scale = template === 'sidebar' ? Math.min(0.55, 90 / box.width) : 1;
      assert.ok(Math.abs(pics[0].w - box.width * scale) < 0.1 && Math.abs(pics[0].h - box.height * scale) < 0.1, `${template}: ${pics[0].w} × ${pics[0].h} pt`);
    }
  });

  it('none when the eye hides it, when there is none, or when the PDF cannot draw it', async () => {
    for (const personal of [{ hiddenFields: ['photo'] }, { photo: '' }, { photo: GIF }]) {
      assert.equal(pictures((await renderDocx(cv('classic', personal))).xml).length, 0, JSON.stringify(personal).slice(0, 60));
    }
  });

  it('a stored photo with a stray character in its base64 prints, as the PDF prints it; one cut short prints none — neither stops the export', async () => {
    const stray = `${JPEG_2X2.slice(0, 80)}@@ \n${JPEG_2X2.slice(80)}`;
    const [pic] = pictures((await renderDocx(cv('classic', { photo: stray }))).xml);
    assert.ok(pic, 'the photo prints');
    assert.equal(pic.w, pic.h);
    for (const photo of [JPEG_2X2.slice(0, 121), 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg', 'data:image/jpeg;base64,/9j/!!!']) {
      assert.equal(pictures((await renderDocx(cv('classic', { photo }))).xml).length, 0, photo.slice(0, 40));
    }
  });

  it('a PNG prints too; the shape, height and ring follow Personal Info → Photo', async () => {
    const [circle] = pictures((await renderDocx(cv('classic', { photo: PNG_4X2 }, { photoShape: 'circle', photoBorder: 'none' }))).xml);
    assert.equal(circle.shape, 'ellipse');
    assert.equal(circle.w, circle.h);
    assert.equal(circle.ring, null);
    const [tall] = pictures((await renderDocx(cv('classic', {}, { photoShape: 'rounded', photoHeight: 'tall', photoBorder: 'accent' }))).xml);
    assert.equal(tall.shape, 'roundRect');
    assert.ok(Math.abs(tall.h / tall.w - 1.4) < 0.01, `tall: ${tall.w} × ${tall.h}`);
    assert.ok(Math.abs(tall.adj - Math.round((7.5 / tall.w) * 100000)) <= 1, `rounded corner: ${tall.adj}`);
    assert.deepEqual(tall.ring, [String(Math.round(1.125 * EMU)), 'e11d48']);
    const [thin] = pictures((await renderDocx(cv('classic', {}, { photoBorder: 'thin' }))).xml);
    assert.equal(thin.ring?.[1], 'e5e7eb');
  });

  it('the picture is cropped to fill its box, as the PDF\'s "cover": a 4 × 2 photo in a square box loses a quarter each side', async () => {
    const [pic] = pictures((await renderDocx(cv('classic', { photo: PNG_4X2 }, { photoShape: 'square', photoHeight: 'match' }))).xml);
    assert.deepEqual(pic.crop, { l: 25000, t: 0, r: 25000, b: 0 });
    const [portrait] = pictures((await renderDocx(cv('classic', { photo: JPEG_2X2 }, { photoShape: 'square', photoHeight: 'taller' }))).xml);
    const keep = 1 / 1.8;
    assert.deepEqual(portrait.crop, { l: Math.round(((1 - keep) / 2) * 100000), t: 0, r: Math.round(((1 - keep) / 2) * 100000), b: 0 });
  });

  it('beside the name in a borderless table row; above it, centred, in a centred header', async () => {
    const { xml, texts } = await renderDocx(cv('classic'));
    const table = /<w:tbl>(.*?)<\/w:tbl>/s.exec(xml)?.[1];
    assert.ok(table, 'a table');
    const cells = [...table.matchAll(/<w:tc>(.*?)<\/w:tc>/gs)].map((m) => m[1]);
    assert.equal(cells.length, 2);
    assert.match(cells[0], /<w:drawing>/);
    assert.match(cells[1], /Robin Sample/);
    assert.match(cells[1], /robin@example\.com/);
    assert.doesNotMatch(table, /w:val="single"/);
    assert.ok(texts.includes('Robin Sample'));

    const xmlC = (await renderDocx(cv('classic', {}, { headerAlign: 'center' }))).xml;
    assert.doesNotMatch(xmlC.split('Robin Sample')[0], /<w:tbl>/, 'no table');
    const photoPara = xmlC.split('</w:p>').find((p) => p.includes('<w:drawing>'));
    assert.match(photoPara, /<w:jc w:val="center"\/>/);
    assert.ok(xmlC.indexOf('<w:drawing>') < xmlC.indexOf('Robin Sample'), 'the photo above the name');
  });
});
