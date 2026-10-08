// UI rebuild B8: the Design drawer and the template gallery drawn with the design tokens. A restyle drops no control:
// every section the drawer offered is still offered (the titles are a hard-coded list, read back from the source), and
// the negative twin: no element of these components carries an old grey / blue / red / amber / green colour class.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const DIR = new URL('../../src/components/', import.meta.url);
const read = (f) => readFileSync(new URL(f, DIR), 'utf8');
const files = [...readdirSync(DIR).filter((f) => /^DesignPanel.*\.jsx$/.test(f)), 'TemplateGallery.jsx', 'DesignDock.jsx', 'LayoutToggle.jsx', 'TemplateThumb.jsx'];
const panel = files.filter((f) => f.startsWith('DesignPanel')).map(read).join('\n');

describe('the Design drawer still offers every section (B8)', () => {
  const TITLES = ['Template', 'Contact icons', 'Spacing', 'Colors', 'Dates', 'Section Headings', 'Links', 'Lists', 'Page numbers', 'Typography'];
  for (const title of TITLES) {
    it(`offers the "${title}" section`, () => {
      assert.ok(panel.includes(`<DesignSection title="${title}"`), title);
    });
  }
  it('offers exactly those ten sections', () => {
    const found = [...panel.matchAll(/<DesignSection title="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(found.sort(), [...TITLES].sort());
  });
  it('keeps the 1-Page Fit control', () => {
    assert.match(panel, /Spacing: 1-Page Fit/);
  });
});

describe('the Design drawer and the gallery carry no old colour class (negative twin, B8)', () => {
  const OLD = /(?:^|[\s"'`:])(?:[a-z-]+:)*(?:text|bg|border|ring|divide|from|to|placeholder)-(?:gray|blue|red|amber|green|emerald|indigo|slate|yellow|orange)-\d+/;
  for (const f of files) {
    it(`${f} has none`, () => {
      const hit = read(f).split('\n').findIndex((l) => OLD.test(l));
      assert.equal(hit, -1, `${f}:${hit + 1}`);
    });
  }
  it('uses the tokens', () => {
    assert.match(panel, /text-cv-muted/);
    assert.match(panel, /border-cv-hairline/);
    assert.match(read('TemplateGallery.jsx'), /cv-/);
  });
});
