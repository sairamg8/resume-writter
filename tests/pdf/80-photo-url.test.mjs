// R2-093: a photo stored as a URL or a path — a JSON Resume file's basics.image, say 'photo.jpg', or a
// URL whose server allows no cross-site read — went to react-pdf as it was: it could not fetch it,
// and printed an empty ring beside a name pushed aside to make room for it, while Personal Info →
// Photo said "Added". A URL is no longer drawn as it is (drawableImage): the PDF prints a copy of it,
// fetched and stored as an upload of it would be (printableImage), or nothing at all — no ring, no
// room kept — when it cannot be fetched or is not an image, and the panel then says "Not printed".
// Node has no image decoder: createImageBitmap, the canvas and the FileReader are stand-ins, as in
// 16-saved-data-photos; fetch is one too, so no photo is fetched from the network.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { setup, teardown, resume, render, renderCover, loadModule } from './harness.mjs';
import { drawing } from './extractors.mjs';

const WEBP_BYTES = 'UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA';
/** A 2×2 JPEG: what the stand-in's canvas encodes. */
const JPEG_2X2 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/wAALCAACAAIBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAB//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AGn//2Q==';

/** What the stand-in fetch serves, by URL; anything else fails as a blocked or missing file does. */
const SERVED = {
  'https://img.example.com/me.webp': () => new Response(Buffer.from(WEBP_BYTES, 'base64'), { headers: { 'content-type': 'image/webp' } }),
  'https://img.example.com/page': () => new Response('<html></html>', { headers: { 'content-type': 'text/html' } }),
  'https://img.example.com/gone.jpg': () => new Response('Not found', { status: 404, headers: { 'content-type': 'image/jpeg' } }),
};
const fetched = [];

const saved = {};
before(async () => {
  await setup();
  for (const k of ['createImageBitmap', 'document', 'FileReader', 'fetch']) saved[k] = globalThis[k];
  globalThis.fetch = async (url, ...rest) => {
    fetched.push(String(url));
    const serve = SERVED[String(url)];
    if (serve) return serve();
    // The fonts the PDF loads go to the real fetch; a photo URL anywhere else fails.
    if (/^(file:|data:|http:\/\/(127\.0\.0\.1|localhost)[:/])/.test(String(url))) return saved.fetch(url, ...rest);
    throw new TypeError('Failed to fetch');
  };
  globalThis.createImageBitmap = async (blob) => {
    const head = Buffer.from(await blob.slice(0, 4).arrayBuffer()).toString('latin1');
    if (head !== 'RIFF') throw new DOMException('The source image could not be decoded.', 'InvalidStateError');
    return { width: 1, height: 1, close() {} };
  };
  const context = { getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4).fill(255) }) };
  const ctx = new Proxy(context, { get: (t, k) => (k in t ? t[k] : () => {}) });
  globalThis.document = { createElement: () => ({ width: 300, height: 150, getContext: () => ctx, toDataURL: () => JPEG_2X2 }) };
  globalThis.FileReader = class {
    readAsDataURL(blob) {
      blob.arrayBuffer().then((buf) => { this.result = `data:${blob.type};base64,${Buffer.from(buf).toString('base64')}`; this.onload(); });
    }
  };
});
after(async () => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete globalThis[k];
    else globalThis[k] = v;
  }
  await teardown();
});

const UNFETCHABLE = ['photo.jpg', 'https://no-cors.example.com/me.jpg', 'https://img.example.com/page', 'https://img.example.com/gone.jpg'];

describe('a photo stored as a URL or a path', () => {
  it('is not drawn as it is: react-pdf is never handed a URL', async () => {
    const { drawableImage, isDrawableImage } = await loadModule('/src/utils/imageUpload.js');
    for (const src of ['photo.jpg', 'https://img.example.com/me.webp', '/me.png']) {
      assert.equal(drawableImage(src), null, src);
      assert.equal(isDrawableImage(src), false, src);
    }
  });

  for (const template of ['classic', 'modern', 'sidebar']) {
    it(`${template}: one that cannot be fetched, or is not an image, prints as no photo: no ring, the name where it would be`, async () => {
      const header = { headerAlign: 'left' }; // the photo beside the name
      const none = await drawing(await render(resume({ template, settings: header })));
      for (const photo of UNFETCHABLE) {
        assert.ok(await drawing(await render(resume({ template, settings: header, personal: { photo } }))) === none, photo);
      }
      const letterNone = await drawing(await renderCover(resume({ template, coverLetter: { body: '<p>Hi</p>' } })));
      assert.ok(await drawing(await renderCover(resume({ template, personal: { photo: 'photo.jpg' }, coverLetter: { body: '<p>Hi</p>' } }))) === letterNone, 'the letter too');
    });

    it(`${template}: one that can be fetched prints, as an upload of it would`, async () => {
      const uploaded = await drawing(await render(resume({ template, personal: { photo: JPEG_2X2 } })));
      const r = resume({ template, personal: { photo: 'https://img.example.com/me.webp' } });
      const stored = JSON.stringify(r);
      assert.ok(await drawing(await render(r)) === uploaded);
      assert.equal(JSON.stringify(r), stored, 'the résumé is not changed');
    });
  }

  it('is fetched once a session, and the Photo panel says "Not printed" for one that cannot be', async () => {
    const { printableImage, printableNow } = await loadModule('/src/utils/printableImage.js');
    const url = 'https://no-cors.example.com/panel.jpg';
    assert.equal(printableNow(url), undefined, 'not known before it is asked for');
    assert.equal(await printableImage(url), null);
    assert.equal(await printableImage(url), null);
    assert.equal(fetched.filter((u) => u === url).length, 1);
    assert.equal(await printableImage('https://img.example.com/me.webp'), JPEG_2X2);

    const { PhotoSection } = await loadModule('/src/components/PersonalInfoEditorPhoto.jsx');
    const panel = (photo) => renderToString(createElement(PhotoSection, {
      personal: { photo }, updatePersonal: () => {}, toggleFieldVisibility: () => {}, hidden: new Set(), s: {}, set: () => {},
      template: 'classic', open: true, onToggle: () => {},
    }));
    const html = panel(url);
    assert.match(html, /Not printed/);
    assert.doesNotMatch(html, />Added</);
    assert.match(html, /could not be loaded/i, 'and why: the link, not the format');
    assert.match(panel('https://img.example.com/me.webp'), />Added</);
  });
});
