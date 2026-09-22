// Contact icons: every pack the Design panel offers is drawn as that pack in the PDF, and the
// editor offers a field's upload wherever an icon prints.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { setup, teardown, resume, render, renderCover, loadModule, TEMPLATES } from './harness.mjs';
import { PNG_2X2 } from './extractors.mjs';

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

// Every document that draws contact icons (R1-5: Minimal and Executive too).
const DOCUMENTS = [
  ['classic', (settings) => render(resume({ template: 'classic', settings, personal: PERSONAL }))],
  ['minimal', (settings) => render(resume({ template: 'minimal', settings, personal: PERSONAL }))],
  ['executive', (settings) => render(resume({ template: 'executive', settings, personal: PERSONAL }))],
  ['modern', (settings) => render(resume({ template: 'modern', settings, personal: PERSONAL }))],
  ['sidebar', (settings) => render(resume({ template: 'sidebar', settings, personal: PERSONAL }))],
  ['cover letter', (settings) => renderCover(resume({ settings, personal: PERSONAL }))],
];

/** A 2×2 red PNG, as the Personal info "custom icon" upload stores it. */
const RED_PNG = PNG_2X2;

/** How many images page 1 paints. */
async function images(bytes) {
  const doc = await pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, verbosity: 0 }).promise;
  const ops = await (await doc.getPage(1)).getOperatorList();
  await doc.loadingTask.destroy();
  const O = pdfjs.OPS;
  return ops.fnArray.filter((fn) => fn === O.paintImageXObject || fn === O.paintInlineImageXObject).length;
}

describe('contact icon packs (FIDA-39, FIDB-07, FIDB-06)', () => {
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

  // Modern is the fix (b6deb02, FIDB-06); the other documents already drew uploads — guards.
  for (const [name, make] of DOCUMENTS) {
    it(`${name}: an uploaded icon replaces that field's pack icon`, async () => {
      const bytes = await make({ iconSet: 'lucide', contactStyle: 'icon', customContactIcons: { email: RED_PNG } });
      assert.equal(await images(bytes), 1, 'the uploaded e-mail icon is drawn');
      const drawn = await icons(bytes);
      assert.equal(drawn.length, 5, 'the other five fields keep their pack icons');
      assert.deepEqual(drawn.map((shapes) => shapes.map((x) => x.paint).join('')), PACKS.lucide.shapes.slice(1));
    });
  }
});

// The header icon picker stores a library icon as `icon:<id>` and a style pack as `pack:<id>` in
// customContactIcons — the same map as uploads. The PDF took any string that was not a data URL
// for an image address, drew `<Image src="icon:send">`, and the icon vanished from the canvas.
describe('an icon chosen in the header icon picker', () => {
  for (const [name, make] of DOCUMENTS) {
    it(`${name}: a library icon and a style pack print as those vector icons, not an empty image`, async () => {
      const bytes = await make({ iconSet: 'lucide', contactStyle: 'icon', customContactIcons: { email: 'icon:send', phone: 'pack:filled' } });
      assert.equal(await images(bytes), 0, 'no image is drawn for a vector choice');
      const drawn = await icons(bytes);
      assert.equal(drawn.length, 6, 'all six fields keep an icon');
      assert.equal(drawn[0].map((x) => x.paint).join(''), 'SS', 'e-mail: the paper plane\'s two strokes');
      assert.deepEqual(drawn[0][0].start, [22, 2], 'e-mail: the paper plane starts at its tip');
      assert.equal(drawn[1].map((x) => x.paint).join(''), 'F', 'phone: the Filled pack\'s solid handset');
      assert.deepEqual(drawn[1][0].start, PACKS.filled.phoneStart);
      assert.deepEqual(drawn.slice(2).map((shapes) => shapes.map((x) => x.paint).join('')), PACKS.lucide.shapes.slice(2), 'the rest keep the chosen pack');
    });
  }
});

/** A WebP data URL, as uploads were stored before they were converted: react-pdf cannot decode it. */
const WEBP = 'data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA';

describe('an uploaded icon the PDF cannot draw (R1-1)', () => {
  for (const [name, make] of DOCUMENTS) {
    it(`${name}: a WebP icon saved before uploads were converted prints the pack's icon, not an empty slot`, async () => {
      const bytes = await make({ iconSet: 'lucide', contactStyle: 'icon', customContactIcons: { email: WEBP, phone: RED_PNG } });
      assert.equal(await images(bytes), 1, 'only the PNG phone icon is drawn as an image');
      const drawn = await icons(bytes);
      assert.deepEqual(drawn.map((shapes) => shapes.map((x) => x.paint).join('')),
        [PACKS.lucide.shapes[0], ...PACKS.lucide.shapes.slice(2)], 'e-mail falls back to the pack icon');
    });

    // The browser labels an upload by its file name, and react-pdf decodes by the label (R7-3).
    it(`${name}: a WebP icon labelled PNG gets the pack's icon; a PNG labelled JPEG is drawn`, async () => {
      const webpAsPng = WEBP.replace('image/webp', 'image/png');
      const pngAsJpeg = RED_PNG.replace('image/png', 'image/jpeg');
      const bytes = await make({ iconSet: 'lucide', contactStyle: 'icon', customContactIcons: { email: webpAsPng, phone: pngAsJpeg } });
      assert.equal(await images(bytes), 1, 'the phone\'s PNG is drawn as an image');
      const drawn = await icons(bytes);
      assert.deepEqual(drawn.map((shapes) => shapes.map((x) => x.paint).join('')),
        [PACKS.lucide.shapes[0], ...PACKS.lucide.shapes.slice(2)], 'e-mail falls back to the pack icon');
    });
  }
});

/** What Personal Info → Fields offers for the contact icons of `r`: its rows, as they are named. */
async function iconUploadRows(r) {
  const { EditorResumeTab } = await loadModule('/src/components/EditorResumeTab.jsx');
  const noop = () => {};
  const html = renderToString(createElement(EditorResumeTab, {
    resume: r, store: new Proxy({}, { get: () => noop }), personalOpen: true, setPersonalOpen: noop,
    allExpanded: false, forceOpenKey: 0, toggleAllSections: noop, addSectionOpen: false, setAddSectionOpen: noop,
  }));
  const count = (needle) => html.split(needle).length - 1;
  return { resume: count('>Resume icon<'), letter: count('>Cover letter icon<'), clear: count('title="Remove custom icon"') };
}

// Personal Info → Fields offers a field's icon upload (Upload, Replace, Clear) wherever an icon
// prints: the résumé's (drawsContactIcons, R1-2) or the letter's, whose own Contact Style "Icon"
// draws the pack and the uploads whatever the résumé's style. The editor asked only the résumé,
// so under a Bar or Bullet résumé the icon its letter printed could not be replaced or cleared
// (R9-5). Each row is named for where it prints; nothing prints, no row.
describe('Personal Info offers the icon upload exactly where an icon prints (R1-2, R9-5)', () => {
  it('every template × the résumé\'s Contact Style × the letter\'s own: the editor\'s rows against the icons each PDF draws', async () => {
    const drawn = async (bytes) => (await images(bytes)) + (await icons(bytes)).length;
    for (const template of TEMPLATES) {
      for (const contactStyle of [undefined, 'icon', 'bullet', 'bar']) {
        const settings = { contactStyle, iconSet: 'lucide', customContactIcons: { email: RED_PNG } };
        const onResume = await drawn(await render(resume({ template, settings, personal: PERSONAL })));
        for (const headerStyle of [undefined, 'icon', 'bullet', 'bar']) {
          const r = resume({ template, settings, personal: PERSONAL, coverLetter: { headerStyle } });
          const onLetter = await drawn(await renderCover(r));
          const at = `${template}, résumé ${contactStyle ?? 'unset'}, letter ${headerStyle ?? 'unset'}`;
          assert.ok([0, 6].includes(onResume) && [0, 6].includes(onLetter), `${at}: ${onResume} and ${onLetter} icons`);
          const want = onResume ? { resume: 6, letter: 0, clear: 1 }
            : onLetter ? { resume: 0, letter: 6, clear: 1 } : { resume: 0, letter: 0, clear: 0 };
          assert.deepEqual(await iconUploadRows(r), want, `${at}: the résumé draws ${onResume} icons, the letter ${onLetter}`);
        }
      }
    }
  });
});

/** Header Customization for `settings` on `template`, open: its Style chips and its icon controls. */
async function headerPanel(template, settings) {
  const { HeaderCustomization } = await loadModule('/src/components/PersonalInfoEditorHeader.jsx');
  const noop = () => {};
  const html = renderToString(createElement(HeaderCustomization, {
    s: settings, set: noop, template, templateLabel: template, open: true, onToggle: noop,
  }));
  const style = {};
  // The three Style chips, by their "⊕ Icon" / "• Bullet" / "| Bar" labels; true = the active one.
  for (const [, cls, label] of html.matchAll(/<button class="([^"]*)">[⊕•|] ([A-Za-z]+)<\/button>/g)) {
    style[label] = cls.includes('bg-blue-600');
  }
  return { style, iconControls: html.includes('>Icon set<') && html.includes('>Icon size<') };
}

// Header Customization's Icon set chips and Icon size drive the pack the header draws, so they
// belong exactly where it draws one. The panel asked `contactStyle === undefined`, while the
// Style chip beside it, the PDF (PdfContact) and Personal Info all read `contactStyle || 'icon'`
// — so an imported file storing '' or null showed Icon active and printed the pack with the two
// controls that drive it hidden (R9-10/R1-2).
describe('Header Customization offers Icon set and Icon size exactly where the pack prints (R9-10)', () => {
  it('every header-control template × a blank, Icon, Bullet or Bar Contact Style: the panel against the PDF', async () => {
    const { hasHeaderControls } = await loadModule('/src/constants/templates.js');
    for (const template of TEMPLATES.filter(hasHeaderControls)) {
      for (const contactStyle of [undefined, '', null, 'icon', 'bullet', 'bar']) {
        const settings = { contactStyle, iconSet: 'lucide' };
        const drawn = (await icons(await render(resume({ template, settings, personal: PERSONAL })))).length;
        const panel = await headerPanel(template, settings);
        const at = `${template}, style ${JSON.stringify(contactStyle)}`;
        assert.ok([0, 6].includes(drawn), `${at}: ${drawn} icons drawn`);
        assert.equal(panel.iconControls, drawn > 0, `${at}: the PDF draws ${drawn} icons`);
        assert.deepEqual(panel.style,
          { Icon: drawn > 0, Bullet: contactStyle === 'bullet', Bar: contactStyle === 'bar' },
          `${at}: the Style chips`);
      }
    }
  });
});
