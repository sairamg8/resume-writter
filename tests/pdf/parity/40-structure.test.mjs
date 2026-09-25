// The editor's structure actions and rich text, on every template (R2-160, R2-164): what a drag that
// reorders sections or entries, a section's eye, and bold / italic / underline in a description do to
// the PDF (= the preview) and the Word export; and the letter's Show photo. The drags end in the store actions EditorResumeTab and SectionEditor call —
// updateSections(arrayMove(…)) and reorderItems — applied here exactly as the store applies them.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { arrayMove } from '@dnd-kit/sortable';
import { setup, teardown, loadModule, renderDocx, renderCover } from '../harness.mjs';
import { walks } from './walk-cache.mjs';
import { baseResume, loadStore } from './store.mjs';
import { shot } from './matrix.mjs';
import { item, flow, prints, snapshot } from './measure.mjs';

const W = await walks();
before(async () => { await setup(); await loadStore(); });
after(teardown);

/** `r` after the section actions `fn` runs (createSectionActions, the store's own). */
async function withActions(r, fn) {
  const { createSectionActions } = await loadModule('/src/hooks/useResumeSectionActions.js');
  let out = r;
  fn(createSectionActions((patch) => { out = patch(out); }), out);
  return out;
}
const before_ = (snap, a, b) => {
  const [x, y] = [item(snap, a), item(snap, b)];
  assert.ok(x && y, `"${a}" and "${b}" print`);
  return flow(snap, x) < flow(snap, y) - 1 || (Math.abs(flow(snap, x) - flow(snap, y)) <= 1 && x.x < y.x);
};

for (const variant of W.variants) {
  describe(variant.id, () => {
    const base = () => baseResume(variant.template, variant.settings);

    it('a section dragged above another prints above it', async () => {
      // Projects and Experience print in the main column of every template.
      const r = base();
      assert.ok(before_(await shot(r), 'Northwind Labs', 'Ledgerline'));
      const moved = await withActions(r, (a, cur) => {
        const from = cur.sections.findIndex((s) => s.type === 'projects');
        const to = cur.sections.findIndex((s) => s.type === 'experience');
        a.updateSections(arrayMove(cur.sections, from, to));
      });
      assert.ok(before_(await shot(moved), 'Ledgerline', 'Northwind Labs'), 'Projects now print before Experience');
    });

    it('an entry dragged above another prints above it', async () => {
      // The third job is the first at another company (the second is a role at the first's, R2-147).
      const moved = await withActions(base(), (a) => a.reorderItems('sec_experience', 2, 0));
      assert.ok(before_(await shot(moved), 'Contoso Retail', 'Northwind Labs'));
    });

    it('a hidden section prints nothing of itself; shown again it prints as before', async () => {
      const r = base();
      const hidden = await withActions(r, (a) => a.toggleSectionVisibility('sec_projects'));
      const snap = await shot(hidden);
      for (const m of ['Ledgerline', 'Queuebird']) assert.ok(!prints(snap, m), `${m} is hidden`);
      assert.ok(prints(snap, 'Northwind Labs'), 'the other sections still print');
      const shown = await withActions(hidden, (a) => a.toggleSectionVisibility('sec_projects'));
      assert.equal((await shot(shown)).drawing, (await shot(r)).drawing);
    });

    it('a description prints its bold, italic and underline', async () => {
      const snap = await shot(base());
      assert.match(item(snap, 'billing platform').font, /bold/i);
      assert.match(item(snap, 'cut').font, /italic/i);
      const u = snap.pages.flatMap((p) => p.items).find((t) => /\bhalf\b/.test(t.str));
      assert.ok(u, '"half" prints');
      // A run can hold more than one word: where "half" starts is estimated from its share of the run's
      // characters (proportional glyphs: within ~0.6 em), and the line must be at least a word long.
      const x0 = u.x + (u.w * u.str.indexOf('half')) / u.str.length;
      const line = snap.paint.find((p) => p.page === u.page && (p.paint === 'fill' || p.paint === 'stroke')
        && p.y1 <= u.y + 0.5 && p.y1 >= u.y - 4 && p.y1 - p.y0 < 2
        && Math.abs(p.x0 - x0) < u.h * 0.6 && p.x1 - p.x0 >= u.h);
      assert.ok(line, `an underline under "half" (run at ${u.x.toFixed(1)}, ${u.y.toFixed(1)})`);
    });

    it('the cover letter prints the photo, and with Show photo off none', async () => {
      const r = base();
      const photos = async (cl) => (await snapshot(await renderCover({ ...r, coverLetter: { ...r.coverLetter, body: '<p>Dear team,</p>', ...cl } })))
        .paint.filter((p) => p.paint === 'image').length;
      assert.equal(await photos({}), 1, 'the letterhead prints the résumé photo');
      assert.equal(await photos({ showPhoto: false }), 0, 'Show photo off: no photo');
    });

    it('the Word export prints the same bold, italic and underline', async () => {
      const { xml } = await renderDocx(base());
      // Each Word run (<w:r>) with its own properties; the one holding the word carries its style.
      const runOf = (word) => [...xml.matchAll(/<w:r>([\s\S]*?)<\/w:r>/g)].map((m) => m[1]).find((r) => new RegExp(`<w:t[^>]*>[^<]*\\b${word}\\b`).test(r));
      for (const [word, tag] of [['billing platform', 'w:b'], ['cut', 'w:i'], ['half', 'w:u']]) {
        const run = runOf(word);
        assert.ok(run, `"${word}" is in the .docx`);
        assert.match(run, new RegExp(`<${tag}(\\s[^>]*)?/>`), `"${word}" carries <${tag}/>: ${run.slice(0, 200)}`);
      }
    });
  });
}
