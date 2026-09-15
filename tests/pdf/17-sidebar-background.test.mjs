// The Sidebar column's text on the background the user picks (Design → Sidebar Background):
// every run stays readable on every preset and on light custom colours, and the default navy
// prints the colours it always printed (R2-2).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, render, renderCover, drawState, read, itemsWith } from './harness.mjs';
import { painted } from './extractors.mjs';
// A namespace import: on older code a missing helper fails only the tests that use it, and the
// self-contained FIDB-42 behaviour test below still runs (R2-8, R9-11).
import * as colors from '../../src/templates/pdf/shared/pdfColors.js';

const { contrast, readableOn, sidebarShades } = colors;

before(setup);
after(teardown);

/** The Design panel's presets (DesignPanelColors.jsx), the demo's blue, and two light customs. */
const BACKGROUNDS = ['#1e293b', '#1e1b4b', '#111827', '#0f2744', '#292524', '#14532d', '#2e1065', '#450a0a', '#1e40af', '#f1f5f9', '#ffffff'];

/** One résumé that fills every kind of run the column prints (built after setup: section() needs it). */
const column = () => [
  section('education', [{ degree: 'BSc Physics', institution: 'Tech Institute', gpa: '3.9', startDate: '2014', endDate: '2018', description: '<p>Coursework in optics</p>' }]),
  section('languages', [{ language: 'German', proficiency: 'Fluent' }]),
  section('certifications', [{ name: 'Cloud Architect', issuer: 'Acme Certs', date: '05/2023', credentialId: 'ABC-123', url: 'https://cert.example.com', urlLabel: 'View Credential' }]),
  section('references', [{ name: 'Jane Doe', jobTitle: 'Chief Officer', relationship: 'Former Manager', email: 'jane@acme.com', phone: '+1 555 0101' }]),
  section('skills', [{ category: 'Frontend', skills: 'Svelte, Vue' }], { skillsStyle: 'tags' }),
  section('interests', [{ interests: 'Chess, Hiking' }]),
];
const PERSONAL = { name: 'Pat Sample', title: '', email: 'pat@example.com', phone: '+1 555 0199' };

/**
 * Each needle, the run it stands for, and the contrast it needs — against the chip for chips.
 * The 19 pt bold name is WCAG large text: 3:1 (R7-13).
 */
const RUNS = [
  ['Pat Sample', 'name', 3], ['BSc Physics', 'strong', 7], ['German', 'strong', 7], ['Cloud Architect', 'strong', 7], ['Jane Doe', 'strong', 7],
  ['pat@example.com', 'value', 4.5], ['Coursework in optics', 'value', 4.5], ['View Credential', 'value', 4.5],
  ['Tech Institute', 'label', 4.5], ['Acme Certs', 'label', 4.5], ['Chief Officer', 'label', 4.5],
  ['3.9', 'meta', 3], ['Fluent', 'meta', 3], ['ABC-123', 'meta', 3], ['Former Manager', 'meta', 3], ['jane@acme.com', 'meta', 3], ['+1 555 0101', 'meta', 3],
  ['Svelte', 'chip', 4.5], ['Chess', 'chip', 4.5],
];

const make = (sidebarBg) => render(resume({ template: 'sidebar', personal: PERSONAL, sections: column(), settings: sidebarBg ? { sidebarBg } : {} }));

async function colours(bytes) {
  const out = {};
  for (const [needle] of RUNS) {
    const hits = await drawState(bytes, needle);
    assert.ok(hits.length, `${needle} is printed`);
    out[needle] = hits[0].fill;
  }
  return out;
}

describe('the Sidebar column on its background (R2-2)', () => {
  // #14532d, #1e40af, #f1f5f9 and #ffffff are the fix (they failed before de61cd8); the navy and
  // the other dark presets already read, and the navy test pins its colours: guards (R7 review).
  for (const bg of BACKGROUNDS) {
    it(`${bg}: every run in the column reads on it`, async () => {
      const fill = sidebarShades(bg).fill;
      const drawn = await colours(await make(bg));
      for (const [needle, role, min] of RUNS) {
        const ratio = contrast(drawn[needle], role === 'chip' ? fill : bg);
        assert.ok(ratio >= min, `${needle} (${role}) ${drawn[needle]} on ${role === 'chip' ? fill : bg}: ${ratio.toFixed(2)}:1, needs ${min}`);
      }
    });
  }

  it('the default navy prints the colours it always printed', async () => {
    const drawn = await colours(await make());
    const expected = { name: '#ffffff', strong: '#e2e8f0', value: '#cbd5e1', label: '#94a3b8', meta: '#64748b', chip: '#cbd5e1' };
    for (const [needle, role] of RUNS) assert.equal(drawn[needle], expected[role], `${needle} (${role})`);
    const { name: _name, ...palette } = expected;
    assert.deepEqual(sidebarShades(), { ...palette, fill: '#334155' }, 'chips, tracks and rules keep #334155');
  });
});

describe('the Sidebar column on a mid-tone background (R7-8)', () => {
  // On a mid-tone no text colour reaches 7:1, so every run needs AA (4.5, meta 3); and the chips
  // take the column's ink, light or dark, not the opposite one. #808080 already did (a guard).
  const MID_TONES = ['#2563eb', '#6b7280', '#808080', '#dc2626', '#8b5cf6'];
  const lum = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
  const light = (ink, on) => lum(ink) > lum(on);
  /** The fill painted behind `needle` on page 1: the smallest filled box around it (the chip). */
  async function paintedBehind(bytes, needle) {
    const [t] = itemsWith(await read(bytes), needle);
    const area = (p) => (p.x1 - p.x0) * (p.y1 - p.y0);
    return (await painted(bytes))
      .filter((p) => p.paint === 'fill' && p.x0 <= t.x && p.x1 >= t.x + t.w && p.y0 <= t.y + 1 && p.y1 >= t.y + 1)
      .sort((a, b) => area(a) - area(b))[0]?.colour;
  }
  for (const bg of MID_TONES) {
    it(`${bg}: every run reads, and the chips' ink is on the column's side (light or dark)`, async () => {
      const bytes = await make(bg);
      const drawn = await colours(bytes);
      const fills = { Svelte: await paintedBehind(bytes, 'Svelte'), Chess: await paintedBehind(bytes, 'Chess') };
      const wrong = [];
      for (const [needle, role, min] of RUNS) {
        const on = role === 'chip' ? fills[needle] : bg;
        const ratio = contrast(drawn[needle], on);
        if (!(ratio >= Math.min(min, 4.5))) wrong.push(`${needle} (${role}) ${drawn[needle]} on ${on}: ${ratio?.toFixed(2)}:1`);
        if (role === 'chip') {
          assert.equal(light(drawn[needle], on), light(drawn['pat@example.com'], bg), `chip ${drawn[needle]} on ${on}, value ${drawn['pat@example.com']} on ${bg}`);
        }
      }
      assert.deepEqual(wrong, []);
    });
  }

  it('on any background, chip text keeps the column\'s ink and reads on the chip', () => {
    const wrong = [];
    for (let r = 0; r < 256; r += 51) for (let g = 0; g < 256; g += 51) for (let b = 0; b < 256; b += 51) {
      const bg = `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
      const s = sidebarShades(bg);
      if (light(s.chip, s.fill) !== light(s.value, bg) || !(contrast(s.chip, s.fill) >= 4.5)) wrong.push(`${bg}: chip ${s.chip} on ${s.fill}`);
    }
    assert.deepEqual(wrong, []);
  });
});

describe('the Sidebar name in a Header Text Color the user picked (R7-13)', () => {
  // The name is bold at Base + Full Name (19 pt by default): WCAG large text from 14 pt, where
  // 3:1 is AA. A picked colour that reaches it prints as picked; one that does not (or a name
  // below 14 pt that does not reach 4.5:1) prints the least-shifted tint that reaches 4.5:1.
  const NAVY = '#1e293b';
  const nameFill = async (settings, cover = false) => {
    const r = resume({ template: 'sidebar', personal: { name: 'Pat Sample' }, settings: { sidebarBg: NAVY, ...settings } });
    const [hit] = await drawState(await (cover ? renderCover(r) : render(r)), 'Pat Sample');
    return hit.fill;
  };

  it('#3b82f6 on the navy (3.98:1) prints as picked, on the résumé and on its letter', async () => {
    assert.equal(await nameFill({ headerTextColor: '#3b82f6' }), '#3b82f6');
    assert.equal(await nameFill({ headerTextColor: '#3b82f6' }, true), '#3b82f6');
    assert.equal(await nameFill({ headerTextColor: '#3b82f6', fontSizeNameDelta: 3 }), '#3b82f6', '14 pt is large text');
  });

  // Guard: what was already corrected stays corrected, to 4.5:1 as before.
  it('a colour below 3:1, or a name smaller than 14 pt below 4.5:1, still prints a readable tint', async () => {
    for (const [settings, label] of [[{ headerTextColor: '#475569' }, 'below 3:1'], [{ headerTextColor: '#3b82f6', fontSizeNameDelta: 2 }, '13 pt']]) {
      const fill = await nameFill(settings);
      assert.ok(fill !== settings.headerTextColor && contrast(fill, NAVY) >= 4.5, `${label}: ${fill}, ${contrast(fill, NAVY).toFixed(2)}:1`);
    }
    assert.equal(await nameFill({}), '#ffffff', 'the default white');
  });
});

// Moved from 13-sidebar (R2-8): its top-level import of these helpers kept that whole file from
// loading on older code, so its other tests "failed before" for the wrong reason.
const sidebar = (sections, extra = {}) => resume({ template: 'sidebar', sections, ...extra });

describe('Sidebar job title colour (FIDB-42)', () => {
  // WCAG 2 contrast, written out here rather than taken from the code under test.
  const lum = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return [n >> 16, (n >> 8) & 255, n & 255]
      .map((v) => v / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
      .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
  };
  const ratio = (a, b) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  async function titleFill(settings) {
    const bytes = await render(sidebar([], { settings, personal: { title: 'Staff Engineer' } }));
    const [hit] = await drawState(bytes, 'Staff Engineer');
    return hit;
  }

  it('a dark accent never makes the title unreadable on the sidebar fill', async () => {
    const cases = [['#111111', '#1e293b'], ['#374151', '#1e293b'], ['#2563eb', '#1e293b'], ['#111111', '#14532d'], ['#7f1d1d', '#450a0a']];
    for (const [accentColor, sidebarBg] of cases) {
      const hit = await titleFill({ accentColor, sidebarBg });
      assert.equal(hit.alpha, 1);
      const r = ratio(hit.fill, sidebarBg);
      assert.ok(r >= 4.5, `accent ${accentColor} on ${sidebarBg}: title ${hit.fill}, contrast ${r.toFixed(2)}:1`);
    }
  });

  it('contrast() is the WCAG ratio; readableOn() lightens on dark, darkens on light, keeps what reads', () => {
    assert.equal(contrast('#000000', '#ffffff').toFixed(2), '21.00');
    assert.equal(contrast('#ffffff80', '#000000').toFixed(2), ratio('#808080', '#000000').toFixed(2));
    assert.equal(contrast('red', '#000000'), null);
    assert.equal(readableOn('#fbbf24', '#1e293b'), '#fbbf24');
    const light = readableOn('#111111', '#1e293b');
    assert.ok(lum(light) > lum('#111111') && ratio(light, '#1e293b') >= 4.5, light);
    const dark = readableOn('#fde68a', '#ffffff');
    assert.ok(lum(dark) < lum('#fde68a') && ratio(dark, '#ffffff') >= 4.5, dark);
    assert.equal(readableOn('red', '#1e293b'), 'red');
  });

  // Guard: readable accents and picked colours were never changed; the fix is the test above.
  it('a readable accent is kept, and a job title colour the user picked always wins', async () => {
    assert.equal((await titleFill({ accentColor: '#fbbf24' })).fill, '#fbbf24');
    assert.equal((await titleFill({ accentColor: '#111111', jobTitleColor: '#bfdbfe' })).fill, '#bfdbfe');
    assert.equal((await titleFill({ accentColor: '#111111', jobTitleColor: '#222222' })).fill, '#222222');
  });
});
