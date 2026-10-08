// B9 (UI rebuild): the cover letter panel, generator, new-letter dialog and Bullet Optimizer still offer
// their controls, and no element is drawn with an old grey/blue/red/amber/green/purple Tailwind colour
// class any more (the negative twin).
import { it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const FILES = ['CoverLetterPanel.jsx', 'CoverLetterPanelShared.jsx', 'BulletOptimizerModal.jsx', 'CoverLetterGeneratorModal.jsx', 'NewLetterModal.jsx'];
const LABELS = ['Right of Name', 'Below Name', 'Below Everything'];
const OLD = /(?<![\w-])(?:[a-z-]+:)*(?:text|bg|border|ring|from|to|divide)-(?:gray|blue|red|amber|emerald|purple|slate)-\d+/;
const read = (f) => readFileSync(new URL(`../../src/components/${f}`, import.meta.url), 'utf8');

it('offers every control it offered before', () => {
  const src = FILES.map(read).join('\n');
  for (const label of LABELS) assert.ok(src.includes(label), `missing control: ${label}`);
});

it('negative twin: no old colour class remains', () => {
  for (const f of FILES) {
    const hit = read(f).split('\n').findIndex((l) => OLD.test(l));
    assert.equal(hit, -1, `${f} line ${hit + 1} still carries an old colour class`);
  }
});
