// R4-DOUT-18 — the two-column Sidebar's main-column cards (Experience, Projects; PdfSidebarSections.jsx
// CardItem): the grey dot on a card's left border is centred on the middle of its bold title's
// capitals at every entry size, as the Timeline's dot is (capMiddle). A fixed top of 4 pt put its
// centre 7 pt down whatever the size: 0.8 pt high at 11 pt and ~3 pt high at 14 pt.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, experience, render, read } from './harness.mjs';
import { painted } from './extractors.mjs';

before(setup);
after(teardown);

const DOT = 6;
const GREY = '#9ca3af';
const sidebar = (sections, settings = {}) => resume({ template: 'sidebar', settings, sections });

/** The card dot beside the title `str` and the title's text item (y: its baseline from the page bottom, pt). */
async function dotAndTitle(bytes, str) {
  const t = (await read(bytes)).flatMap((p) => p.items).find((i) => i.str.includes(str));
  assert.ok(t, `title ${str} printed`);
  const dots = (await painted(bytes)).filter((p) => p.paint === 'fill' && p.colour === GREY
    && Math.abs(p.x1 - p.x0 - DOT) < 0.05 && Math.abs(p.y1 - p.y0 - DOT) < 0.05
    && p.x1 <= t.x && t.x - p.x0 < 20);
  assert.ok(dots.length, `a ${DOT} pt card dot left of ${str}`);
  const mid = (p) => (p.y0 + p.y1) / 2;
  const dot = dots.toSorted((a, b) => Math.abs(mid(a) - t.y) - Math.abs(mid(b) - t.y))[0];
  return { dotY: mid(dot), t };
}

/** The dot's centre sits the title's cap middle (~0.36 em) above its baseline, within 0.3 pt. */
function assertCentred({ dotY, t }, size) {
  const want = t.y + 0.36 * size;
  assert.ok(Math.abs(dotY - want) < 0.3, `dot centre ${dotY.toFixed(2)} vs title cap middle ${want.toFixed(2)} (baseline ${t.y.toFixed(2)}, ${size} pt)`);
}

const JOB = { company: 'Brightwater Labs', role: 'Quillon Engineer', location: 'Denver, CO', startDate: '01/2021', endDate: '03/2024', description: '<ul><li>Built the ledger.</li></ul>' };

describe('Sidebar card dot is level with the title at every entry size (R4-DOUT-18)', () => {
  it('Experience, 11 pt title (the default): the dot centres on the title\'s capitals', async () => {
    const bytes = await render(sidebar([experience([JOB], { titleStyle: 'stacked' })]));
    assertCentred(await dotAndTitle(bytes, 'Quillon Engineer'), 11);
  });

  it('Experience, 14 pt title (Entry Header +3): the dot moves down with it', async () => {
    const bytes = await render(sidebar([experience([JOB], { titleStyle: 'stacked' })], { fontSizeEntryDelta: 3 }));
    assertCentred(await dotAndTitle(bytes, 'Quillon Engineer'), 14);
  });

  it('Projects, 14 pt title (base size 14): the dot centres on the project name', async () => {
    const bytes = await render(sidebar([section('projects', [{ name: 'Ferrowind Atlas', technologies: 'Rust, SQLite', startDate: '02/2022', endDate: '09/2022' }])], { fontSizeBase: 14 }));
    assertCentred(await dotAndTitle(bytes, 'Ferrowind Atlas'), 14);
  });
});
