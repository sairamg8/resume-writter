/**
 * Reads what tests/pdf/ats-fuzz.mjs wrote.
 *
 *   node tests/pdf/ats-fuzz-report.mjs <run.jsonl>                what failed, per reader and per class of lost fact
 *   node tests/pdf/ats-fuzz-report.mjs <before.jsonl> <after.jsonl>  A/B over the same seeds — refuses to compare a run with errors
 *
 * Errored cases are reported first and never silently dropped: a run whose renders all threw compares as "empty
 * and clean" otherwise (that happened once, when a font patch broke rendering).
 */
import fs from 'node:fs';

const [fileA, fileB] = process.argv.slice(2);
if (!fileA) { console.log('usage: node tests/pdf/ats-fuzz-report.mjs <run.jsonl> [after.jsonl]'); process.exit(2); }
const load = (f) => fs.readFileSync(f, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const GOOD = ['pdf.js', 'MuPDF', 'pdftotext (reading order)', 'pdftotext -layout'];
const RAW = 'pdftotext -raw';
/** The stress bullet that holds a URL: user content, which any layout may wrap. */
const isUrlBullet = (m) => /https?:\/\/example\.com\/products/.test(m);
const classify = (m) => {
  if (isUrlBullet(m)) return 'a URL inside a bullet (user content)';
  if (/^(linkedin|github)\.com\//.test(m) || /^[\w.-]+\.example\.com$/.test(m) || /@example\.com$/.test(m) || /^\+/.test(m)) return 'CONTACT value lost or split';
  if (/^(austin|são paulo|london|remote)/i.test(m)) return 'location lost or split';
  return 'other: ' + m.slice(0, 40);
};

function errors(rows, label) {
  const bad = rows.filter((r) => r.error);
  console.log(`${label}: ${rows.length} cases, ${bad.length} errored${bad.length ? ` — e.g. seed ${bad[0].seed}: ${bad[0].error}` : ''}`);
  return bad.length;
}

function single(rows) {
  const ok = rows.filter((r) => !r.error);
  console.log('\nreader                       cases failing (recall<1 | glue | garbage | spaced)  | cases with interleaved entries');
  for (const rd of [...GOOD, RAW]) {
    if (!ok.some((r) => r.results.some((x) => x.reader === rd))) continue; // a reader that was not installed
    const fails = ok.filter((r) => { const x = r.results.find((y) => y.reader === rd); return x && (x.recall < 1 || x.glued || x.garbage || x.spaced); }).length;
    const ov = ok.filter((r) => r.results.find((y) => y.reader === rd)?.overlaps > 0).length;
    console.log(`${rd.padEnd(28)} ${String(fails).padStart(4)} / ${ok.length}   ${String(ov).padStart(4)}`);
  }
  for (const rd of GOOD) {
    const agg = {};
    for (const r of ok) {
      const x = r.results.find((y) => y.reader === rd);
      if (!x) continue;
      for (const m of x.missing) { const k = classify(m); agg[k] = agg[k] || { n: 0, by: {} }; agg[k].n += 1; agg[k].by[r.cfg.template] = (agg[k].by[r.cfg.template] || 0) + 1; }
    }
    console.log(`\n-- ${rd}: lost facts by class`);
    for (const [k, v] of Object.entries(agg).sort((a, b) => b[1].n - a[1].n).slice(0, 6)) console.log(`   ${String(v.n).padStart(4)}  ${k}   ${JSON.stringify(v.by)}`);
  }
  const g = ok.filter((r) => r.results.some((x) => x.reader !== RAW && (x.garbage || x.spaced))).map((r) => r.seed);
  console.log('\ncases with garbage or letter-spaced text (not -raw):', g.length ? g.join(', ') : 'none');
}

function compare(A, B) {
  if (A.length !== B.length) { console.log('NOT COMPARABLE: different case counts.'); process.exit(2); }
  const sum = (rows) => Object.fromEntries(GOOD.map((rd) => {
    let garbage = 0, spaced = 0, lost = 0;
    for (const r of rows) {
      const x = r.results.find((y) => y.reader === rd);
      if (!x) continue;
      garbage += x.garbage; spaced += x.spaced;
      if (r.cfg.template !== 'sidebar' || rd === 'pdf.js' || rd === 'MuPDF') lost += x.missing.filter((m) => !isUrlBullet(m)).length;
    }
    return [rd, { garbage, spaced, lostFacts: lost }];
  }));
  console.log('\nA', JSON.stringify(sum(A)));
  console.log('B', JSON.stringify(sum(B)));
  console.log('cases whose page count changed:', A.filter((r, i) => r.pages !== B[i].pages).length, '(layout drift)');
}

const A = load(fileA);
const bad = errors(A, 'A');
if (!fileB) { single(A); process.exit(bad ? 1 : 0); }
const B = load(fileB);
const badB = errors(B, 'B');
if (bad || badB) { console.log('NOT COMPARABLE: fix the errored cases first.'); process.exit(2); }
compare(A, B);
