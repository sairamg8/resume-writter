import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule, resume, render } from './harness.mjs';
import { painted, PNG_2X2 } from './extractors.mjs';

before(setup);
after(teardown);

describe('AUD-25: Photo import unknown shape and height clamping', () => {
  it('getPdfPhotoStyle clamps unknown photoShape, photoHeight, photoSize, and photoBorder to offered options', async () => {
    const { getPdfPhotoStyle } = await loadModule('/src/templates/pdf/shared/pdfPhoto.js');

    // Default style with clean defaults
    const defaultCircle = getPdfPhotoStyle({ photoShape: 'circle', photoHeight: 'match', photoSize: 'md', photoBorder: 'accent' }, '#2563eb', 'classic');

    // Unknown shape 'oval' should clamp to 'circle'
    const unknownShape = getPdfPhotoStyle({ photoShape: 'oval', photoHeight: 'tall', photoSize: 'md', photoBorder: 'accent' }, '#2563eb', 'classic');
    assert.equal(unknownShape.width, defaultCircle.width, 'width should match md circle');
    assert.equal(unknownShape.height, defaultCircle.height, 'height of clamped circle should equal width, not tall');
    assert.equal(unknownShape.borderRadius, defaultCircle.borderRadius, 'borderRadius should match circle w/2');

    // Unknown height 'extra-tall' with rounded shape should clamp to 'match' (square aspect)
    const roundedMatch = getPdfPhotoStyle({ photoShape: 'rounded', photoHeight: 'match', photoSize: 'md', photoBorder: 'accent' }, '#2563eb', 'classic');
    const unknownHeight = getPdfPhotoStyle({ photoShape: 'rounded', photoHeight: 'extra-tall', photoSize: 'md', photoBorder: 'accent' }, '#2563eb', 'classic');
    assert.equal(unknownHeight.height, roundedMatch.height, 'unknown height should clamp to match');

    // Unknown size 'massive' should clamp to 'md'
    const unknownSize = getPdfPhotoStyle({ photoShape: 'circle', photoSize: 'massive' }, '#2563eb', 'classic');
    assert.equal(unknownSize.width, defaultCircle.width, 'unknown size should clamp to md width');

    // Unknown border 'wavy' should clamp to 'accent'
    const unknownBorder = getPdfPhotoStyle({ photoBorder: 'wavy' }, '#2563eb', 'classic');
    assert.equal(unknownBorder.borderColor, defaultCircle.borderColor, 'unknown border should clamp to accent');
    assert.equal(unknownBorder.borderWidth, defaultCircle.borderWidth);
  });

  it('resolveTemplateSettings clamps imported photo properties to allowed values', async () => {
    const { resolveTemplateSettings } = await loadModule('/src/templates/pdf/shared/templateSettings.js');

    const resolved = resolveTemplateSettings({
      photoShape: 'polygon',
      photoHeight: 'giant',
      photoSize: 'huge',
      photoBorder: 'double',
      photoTextAlign: 'middle',
    }, 'classic');

    assert.equal(resolved.photoShape, 'circle');
    assert.equal(resolved.photoHeight, 'match');
    assert.equal(resolved.photoSize, 'md');
    assert.equal(resolved.photoBorder, 'accent');
    assert.equal(resolved.photoTextAlign, 'center');
  });

  it('renders photo with unknown shape as circle in PDF without distorted dimensions', async () => {
    const r = resume({
      template: 'classic',
      settings: { photoShape: 'oval', photoHeight: 'taller' },
      personal: { name: 'Pat Sample', photo: PNG_2X2 },
    });

    const pdfBytes = await render(r);
    const images = (await painted(pdfBytes)).filter((p) => p.paint === 'image');
    assert.ok(images.length > 0, 'PDF should paint the photo');

    const [img] = images;
    const width = Math.abs(img.x1 - img.x0);
    const height = Math.abs(img.y1 - img.y0);
    assert.ok(Math.abs(width - height) < 1, `Clamped circle photo must be 1:1, got width=${width}, height=${height}`);
  });
});
