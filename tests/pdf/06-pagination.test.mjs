// Page layout: nothing outside the margins, nothing on top of anything else, nothing lost,
// nothing orphaned — swept over every template and a range of résumé lengths.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  setup, teardown, resume, section, experience, render, read, overlaps, allItems, MM, TEMPLATES,
} from './harness.mjs';

before(setup);
after(teardown);

const words = 'shipped scalable services improving latency reliability across teams while mentoring engineers and owning delivery end to end'.split(' ');
const sentence = (seed, len) => Array.from({ length: len }, (_, i) => words[(seed * 7 + i * 3) % words.length]).join(' ');
const TITLES = ['PROFESSIONAL EXPERIENCE', 'EDUCATION', 'SKILLS'];

function longResume(template, k) {
  const items = Array.from({ length: k }, (_, i) => ({
    description: `<p>${sentence(i, 14 + (i % 3) * 6)}.</p><ul>${Array.from({ length: 3 + (i % 3) }, (_, j) => `<li>${sentence(i + j, 10 + ((i + j) % 4) * 5)}</li>`).join('')}</ul>`,
  }));
  return resume({
    template,
    personal: { email: 'me@example.com', phone: '+1 555 0100', location: 'Hyderabad', summary: `<p>${sentence(3, 30)}.</p>` },
    sections: [
      experience(items),
      section('education', [{ institution: 'University', degree: 'B.Tech', fieldOfStudy: 'CS', location: 'Hyderabad', startDate: '2012', endDate: '2016', gpa: '8.5' }]),
      section('skills', [{ category: 'Languages', skills: 'JavaScript, TypeScript, Python, SQL' }, { category: 'Frameworks', skills: 'React, Node.js, Express, PostgreSQL' }]),
    ],
  });
}

/** Everything wrong with one rendered document, as readable strings. */
function problems(pages, { marginV = 14 } = {}) {
  const out = [];
  const m = marginV * MM;
  if (pages.length > 1 && pages[pages.length - 1].items.length === 0) out.push('blank trailing page');
  pages.forEach((p, i) => {
    const tag = `p${i + 1}/${pages.length}`;
    for (const [a, b] of overlaps(p)) out.push(`${tag}: "${a.slice(0, 20)}" overprints "${b.slice(0, 20)}"`);
    const low = p.items.find((t) => t.y < m - 3);
    if (low) out.push(`${tag}: "${low.str.slice(0, 24)}" below the bottom margin (y=${low.y.toFixed(1)})`);
    const high = p.items.find((t) => t.y + t.h * 0.8 > p.H - m + 3);
    if (high) out.push(`${tag}: "${high.str.slice(0, 24)}" above the top margin`);
    const wide = p.items.find((t) => t.x + t.w > p.W - 3);
    if (wide) out.push(`${tag}: "${wide.str.slice(0, 24)}" runs off the page`);
    if (i < pages.length - 1 && p.items.length) {
      const lowest = Math.min(...p.items.map((t) => t.y));
      const lastLine = p.items.filter((t) => Math.abs(t.y - lowest) < 1);
      if (lastLine.every((t) => /^\s*[•–·]\s*$/.test(t.str))) out.push(`${tag}: ends with a lone bullet`);
      if (lastLine.some((t) => TITLES.includes(t.str.trim().toUpperCase()))) out.push(`${tag}: ends with the heading "${lastLine[0].str}"`);
    }
  });
  return out;
}

describe('page breaks, swept over résumé length', () => {
  for (const template of TEMPLATES) {
    it(`${template}: 1–16 entries — no overprint, no margin overflow, no orphans, nothing lost`, async () => {
      const found = [];
      for (let k = 1; k <= 16; k += 1) {
        const pages = await read(await render(longResume(template, k)));
        for (const p of problems(pages)) found.push(`k=${k} ${p}`);
        const printed = allItems(pages).filter((t) => t.str.includes('Role ')).length;
        if (printed < k) found.push(`k=${k}: ${printed}/${k} entry headers printed`);
      }
      assert.deepEqual(found, []);
    });
  }
});

describe('layout', () => {
  it('a two-column entry taller than a page is not cut off (FIDA-38)', async () => {
    const lis = Array.from({ length: 90 }, (_, i) => `<li>Grid bullet ${i + 1}</li>`).join('');
    const pages = await read(await render(resume({ sections: [experience([{ description: `<ul>${lis}</ul>` }, { description: '<p>short</p>' }], { columns: 2 })] })));
    const seen = new Set(allItems(pages).map((t) => (t.str.match(/Grid bullet (\d+)/) || [])[1]).filter(Boolean));
    assert.equal(seen.size, 90, `${seen.size}/90 bullets printed over ${pages.length} pages`);
    assert.deepEqual(problems(pages), []);
  });

  for (const template of ['classic', 'minimal', 'executive']) {
    it(`${template}: a centred header prints each line once, centred (FIDA-47 / FIDA-48)`, async () => {
      const pages = await read(await render(resume({
        template, settings: { headerAlign: 'center' },
        personal: { email: 'me@example.com', phone: '+1 555 0100', location: 'Hyderabad', summary: '<p>Summary text for the header block.</p>' },
        sections: [experience([{ description: '<p>Body</p>' }])],
      })));
      assert.deepEqual(overlaps(pages[0]), []);
      const mid = pages[0].W / 2;
      for (const s of ['Test Person', 'Engineer', 'me@example.com']) {
        const t = allItems(pages).find((it) => it.str.includes(s));
        assert.ok(t, `${s} printed`);
        if (s !== 'me@example.com') assert.ok(Math.abs(t.x + t.w / 2 - mid) < 3, `${s} centred (${(t.x + t.w / 2).toFixed(1)} vs ${mid})`);
      }
      const contacts = allItems(pages).filter((it) => /me@example|555 0100|Hyderabad/.test(it.str));
      const left = Math.min(...contacts.map((c) => c.x));
      const right = Math.max(...contacts.map((c) => c.x + c.w));
      assert.ok(Math.abs((left + right) / 2 - mid) < 12, `contact row centred (${((left + right) / 2).toFixed(1)} vs ${mid})`);
    });
  }

  for (const template of ['classic', 'sidebar', 'modern']) {
    it(`${template}: long unbroken URLs and e-mails stay inside the page (FIDA-61 / FIDB-82)`, async () => {
      const url = 'https://www.linkedin.com/in/a-very-long-profile-handle-that-does-not-break-anywhere-1234567890';
      const pages = await read(await render(resume({
        template,
        personal: { website: url, email: 'someone.with.a.really.long.address@example-company-domain.com' },
        sections: [experience([{ description: `<p>${url}${url}</p>` }])],
      })));
      const right = pages[0].W - (template === 'sidebar' ? 0 : 18 * MM);
      const over = allItems(pages).filter((t) => t.x + t.w > right + 1);
      assert.deepEqual(over.map((t) => t.str.slice(0, 30)), []);
      assert.ok(allItems(pages).some((t) => t.str.includes('linkedin')), 'the URL still prints');
    });
  }
});

describe('colours', () => {
  const hue = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const max = Math.max(r, g, b); const min = Math.min(r, g, b);
    if (max - min < 0.08) return null; // grey
    const d = max - min;
    const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return (h * 60 + 360) % 360;
  };
  for (const template of TEMPLATES) {
    it(`${template}: every stroke is grey or the accent's hue — no mis-read #RRGGBBAA (FIDA-12)`, async () => {
      const pages = await read(await render(resume({
        template,
        settings: { accentColor: '#2563eb', headingStyle: 'line' },
        personal: { summary: '<p>Summary</p>', photo: null },
        sections: [
          section('skills', [{ category: 'Web', skills: 'React, Node' }], { skillsStyle: 'tags' }),
          section('references', [{ name: 'Jane', company: 'Acme' }]),
        ],
      })));
      const accentHue = hue('#2563eb');
      const bad = [...new Set(pages.flatMap((p) => [...p.strokes]))].filter((c) => {
        const h = hue(c);
        return h !== null && Math.abs(h - accentHue) > 25;
      });
      assert.deepEqual(bad, []);
    });
  }
});
