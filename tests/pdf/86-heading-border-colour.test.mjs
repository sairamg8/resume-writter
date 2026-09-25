// Design → Section Headings → Border colour: what it shows and whether it is offered match what
// prints (R2-088, R2-119).
// - R2-088: with no colour picked the swatch was the accent and the label said "accent", but many
//   template/style pairs print a rule of their own: Classic's Ruled with a red accent printed a light
//   grey rule under a red swatch. The swatch now shows the colour that, picked, prints what prints.
// - R2-119: Modern's Boxed took the accent whatever Border colour said, in the PDF and in Word, under
//   a control that stayed enabled. It now tints the Border colour, as every other template's box does.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, experience, render, renderDocx, loadModule, TEMPLATES } from './harness.mjs';
import { drawing, painted } from './extractors.mjs';

before(setup);
after(teardown);

const STYLES = ['ruled', 'line', 'underline', 'leftbar', 'box', 'plain'];
const RED = '#e11d48';
const TEAL = '#0d9488';

const cv = (template, settings) => resume({ template, settings: { accentColor: RED, ...settings }, sections: [experience([{ description: '<p>Built things.</p>' }])] });

/** Every element of a React tree, outermost first. */
function* walk(node) {
  if (Array.isArray(node)) { for (const child of node) yield* walk(child); return; }
  if (!node || typeof node !== 'object' || !node.props) return;
  yield node;
  yield* walk(node.props.children);
}

/** What a React tree shows as text. */
function textOf(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (typeof node === 'object') return node.props ? textOf(node.props.children) : '';
  return String(node);
}

/** Section Headings' Border colour row for `settings` on `template`: its swatch, its label, enabled. */
async function borderRow(template, settings) {
  const { HeadingControls } = await loadModule('/src/components/DesignPanelHeadings.jsx');
  const { ColorInput } = await loadModule('/src/components/DesignPanelShared.jsx');
  const nodes = [...walk(HeadingControls({ settings, template, updateSetting: () => {} }))];
  const row = nodes.find((n) => n.type === 'div' && textOf(n).startsWith('Border color'));
  assert.ok(row, 'the Border color row');
  // The swatch: its <input type="color">, or the ColorInput that draws it (coalesced, R2-142).
  const input = [...walk(row)].find((n) => n.type === 'input' || n.type === ColorInput);
  const label = [...walk(row)].filter((n) => n.type === 'span').map(textOf)[1];
  return { swatch: input.props.value.toLowerCase(), label, enabled: !input.props.disabled };
}

/** The Word heading paragraph's decoration: its borders' and shading's colours. */
async function wordDecoration(r) {
  const p = (await renderDocx(r)).paragraphs.find((q) => /experience/i.test(q.text));
  assert.ok(p, 'the experience heading in Word');
  return [...p.xml.matchAll(/<w:(?:bottom|left|shd) [^>]*w:(?:color|fill)="([0-9a-fA-F]{6})"/g)].map((m) => m[1].toLowerCase()).join(' ');
}

describe('Border colour with none picked shows what prints (R2-088)', () => {
  it('the repro: Classic → Ruled with a red accent — the swatch is the grey rule the PDF prints, not "accent"', async () => {
    const r = cv('classic', { headingStyle: 'ruled' });
    const row = await borderRow('classic', r.settings);
    assert.notEqual(row.swatch, RED, 'the swatch is not the accent');
    assert.notEqual(row.label, 'accent');
    const rules = (await painted(await render(r))).filter((p) => p.paint === 'fill' && p.y1 - p.y0 < 1.5 && p.x1 - p.x0 > 100);
    assert.ok(rules.length, 'a rule under the heading');
    assert.equal(rules[0].colour.toLowerCase(), row.swatch, 'the rule prints in the swatch\'s colour');
  });

  it('every template and style: the swatch, picked, prints the heading unchanged; "accent" only where it is the accent', async () => {
    const { sectionHeadingLook } = await loadModule('/src/templates/pdf/shared/sectionHeadingLook.js');
    const { solid } = await loadModule('/src/templates/pdf/shared/pdfColors.js');
    const wrong = [];
    for (const template of TEMPLATES) {
      for (const headingStyle of STYLES.filter((s) => s !== 'plain')) {
        for (const accentColor of [RED, '#2563eb', '#111827']) {
          const row = await borderRow(template, { headingStyle, accentColor });
          const look = (borderColor) => sectionHeadingLook({ template, headingStyle, accent: accentColor, borderColor });
          const part = { ruled: 'ruled', line: 'line', underline: 'underline', leftbar: 'bar', box: 'box' }[headingStyle];
          const now = solid(look('')[part]);
          const picked = solid(look(row.swatch)[part]);
          const at = `${template} ${headingStyle} ${accentColor}`;
          if (picked !== now) wrong.push(`${at}: prints ${now}, the swatch ${row.swatch} would print ${picked}`);
          if ((row.label === 'accent') !== (row.swatch === accentColor)) wrong.push(`${at}: label "${row.label}" over ${row.swatch}`);
        }
      }
    }
    assert.deepEqual(wrong, []);
  });

  it('a picked colour shows as picked', async () => {
    const row = await borderRow('classic', { headingStyle: 'ruled', accentColor: RED, sectionBorderColor: TEAL });
    assert.deepEqual([row.swatch, row.label], [TEAL, TEAL]);
  });
});

describe('Border colour is offered exactly where it changes the page (R2-119)', () => {
  it('the repro: Modern → Boxed → a teal Border colour tints the box in the PDF and in Word', async () => {
    const plain = cv('modern', { headingStyle: 'box' });
    const teal = cv('modern', { headingStyle: 'box', sectionBorderColor: TEAL });
    assert.notDeepEqual(await drawing(await render(teal)), await drawing(await render(plain)), 'the PDF changes');
    const { solid, tint } = await loadModule('/src/templates/pdf/shared/pdfColors.js');
    assert.equal(await wordDecoration(teal), solid(tint(TEAL, 0x14 / 255)).slice(1), 'Word shades the box in the teal\'s tint');
  });

  it('every template and style: enabled where a picked colour changes the PDF and Word, disabled where it cannot', async () => {
    const wrong = [];
    for (const template of TEMPLATES) {
      for (const headingStyle of STYLES) {
        const { enabled } = await borderRow(template, { headingStyle, accentColor: RED });
        const unset = cv(template, { headingStyle });
        const teal = cv(template, { headingStyle, sectionBorderColor: TEAL });
        const pdfChanges = JSON.stringify(await drawing(await render(teal))) !== JSON.stringify(await drawing(await render(unset)));
        const wordChanges = (await wordDecoration(teal)) !== (await wordDecoration(unset));
        const at = `${template} ${headingStyle}`;
        if (enabled !== pdfChanges) wrong.push(`${at}: ${enabled ? 'enabled' : 'disabled'}, the PDF ${pdfChanges ? 'changes' : 'does not change'}`);
        if (enabled !== wordChanges) wrong.push(`${at}: ${enabled ? 'enabled' : 'disabled'}, Word ${wordChanges ? 'changes' : 'does not change'}`);
      }
    }
    assert.deepEqual(wrong, []);
  });
});
