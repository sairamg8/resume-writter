/**
 * How an applicant-tracking system's text pipeline reads a résumé, as a score. Not a vendor's parser
 * (those are closed): the stage every one of them starts with — turning the file into text — read by
 * independent extractors, then checked against the résumé's own data. A résumé "parses" when
 *   1. every fact in it (name, contacts, titles, companies, bullets, skills…) survives extraction whole,
 *   2. every entry stays contiguous — its lines are not interleaved with another entry's or column's,
 *   3. nothing turns into garbage: private-use / replacement characters, ligature codepoints,
 *      letter-spaced capitals, words glued together with no spaces.
 * Recall is exact substring matching after whitespace / NFKC normalisation, so a split, glued or
 * hyphen-mangled word fails it. Use score() on text from readers().
 */
import { read, allText } from './harness.mjs';
import { pdftotext } from './extractors.mjs';

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&nbsp;': ' ' };
const strip = (html) => String(html || '').replace(/<\/(p|li|div|h\d)>/gi, '\n').replace(/<[^>]*>/g, ' ')
  .replace(/&(?:amp|lt|gt|quot|apos|nbsp|#39);/g, (e) => ENTITIES[e]);

/** Whitespace-collapsed, NFKC-normalised, soft hyphens removed. NFKC also folds ligature codepoints, so check those on the raw text. */
export const norm = (s) => String(s || '').normalize('NFKC').replace(/\u00ad/g, '').replace(/\s+/g, ' ').trim();
const atomsOf = (list) => list.map(norm).filter(Boolean);

/**
 * The résumé as ground truth: blocks of atoms (facts that must survive). One block for the contact
 * header, one for the summary, one per visible section title and one per section entry.
 */
export function truthBlocks(r) {
  const P = r.personal || {};
  const blocks = [
    { id: 'contact', atoms: atomsOf([P.name, P.title, P.email, P.phone, P.location, P.website, P.linkedin, P.github]) },
    { id: 'summary', atoms: atomsOf(strip(P.summary).split(/(?<=[.!?])\s+/)) },
  ];
  for (const s of (r.sections || []).filter((x) => x.visible !== false)) {
    blocks.push({ id: `${s.id}:title`, title: true, atoms: atomsOf([s.title]) });
    (s.items || []).forEach((it, i) => {
      let atoms = [];
      if (s.type === 'experience') atoms = [it.role, it.company, it.location, ...strip(it.description).split('\n'), ...(it.bullets || [])];
      else if (s.type === 'skills') atoms = [it.category, ...String(it.skills || '').split(',')];
      else if (s.type === 'projects') atoms = [it.name, it.url, it.technologies, ...strip(it.description).split('\n')];
      else if (s.type === 'education') atoms = [it.institution, it.degree, it.fieldOfStudy, it.gpa, ...strip(it.description).split('\n')];
      else if (s.type === 'certifications') atoms = [it.name, it.issuer];
      else if (s.type === 'languages') atoms = [it.language, it.proficiency];
      else if (s.type === 'awards') atoms = [it.title, it.issuer, ...strip(it.description).split('\n')];
      else if (s.type === 'volunteering') atoms = [it.role, it.org, it.location, ...strip(it.description).split('\n'), ...(it.bullets || [])];
      else if (s.type === 'references') atoms = [it.name, it.jobTitle, it.company, it.email, it.phone];
      else if (s.type === 'interests') atoms = String(it.interests || '').split(',');
      else if (s.type === 'custom') atoms = [it.title, it.subtitle, ...strip(it.description).split('\n')];
      blocks.push({ id: `${s.id}:${i}`, atoms: atomsOf(atoms) });
    });
  }
  return blocks;
}

/** The text every reader in the battery returns for a PDF: [name, text] pairs. */
export async function readers(bytes) {
  return [['pdf.js', allText(await read(bytes))], ...pdftotext(bytes)];
}

const GARBAGE = /[\uE000-\uF8FF\uFFFD\uFB00-\uFB06\u0000-\u0008\u000B\u000E-\u001F]/g;
const LETTER_SPACED = /(?:^|\s)(?:[A-Za-z]\s){5,}[A-Za-z](?:\s|$)/g;

/**
 * Score one reader's text against the ground truth.
 *  recall       facts found whole / all facts; missing lists the ones that were not
 *  overlaps     pairs of entries whose extracted lines interleave (an entry's span contains part of another's)
 *  inversions   entry pairs read in the opposite order to the résumé's own (a two-column layout has some by design)
 *  garbage      private-use / replacement / ligature / control characters
 *  spaced       runs of single letters ("C O N T A C T")
 *  glued        30+ character tokens that are not URLs, host names or e-mails (words run together); gluedTokens lists them
 */
export function score(blocks, rawText) {
  const text = norm(rawText).toLowerCase();
  const atoms = blocks.flatMap((b) => b.atoms.map((a) => ({ a, low: a.toLowerCase(), block: b.id, title: !!b.title })));
  const missing = atoms.filter((x) => !text.includes(x.low)).map((x) => x.a);

  // Order checks only use atoms that are long enough and occur once in the extracted text.
  const located = atoms.filter((x) => !x.title && x.low.length >= 8)
    .map((x) => ({ ...x, at: text.indexOf(x.low), once: text.indexOf(x.low) === text.lastIndexOf(x.low) }))
    .filter((x) => x.at >= 0 && x.once);
  const spans = new Map();
  for (const x of located) {
    const s = spans.get(x.block) || { id: x.block, lo: Infinity, hi: -Infinity, n: 0 };
    s.lo = Math.min(s.lo, x.at); s.hi = Math.max(s.hi, x.at + x.low.length); s.n += 1;
    spans.set(x.block, s);
  }
  const ordered = blocks.map((b) => spans.get(b.id)).filter((s) => s && s.n >= 1);
  const overlaps = [];
  for (let i = 0; i < ordered.length; i += 1) {
    for (let j = i + 1; j < ordered.length; j += 1) {
      const A = ordered[i]; const B = ordered[j];
      if ((A.n >= 2 || B.n >= 2) && A.lo < B.hi && B.lo < A.hi) overlaps.push([A.id, B.id]);
    }
  }
  let inversions = 0;
  for (let i = 0; i < ordered.length; i += 1) for (let j = i + 1; j < ordered.length; j += 1) if (ordered[i].lo > ordered[j].lo) inversions += 1;

  const gluedTokens = rawText.split(/\s+/).filter((t) => t.length >= 30 && !/[@/]|https?:/i.test(t) && !/^[\w-]+(\.[\w-]+)+$/.test(t));
  return {
    atoms: atoms.length,
    missing,
    recall: atoms.length ? 1 - missing.length / atoms.length : 1,
    overlaps,
    inversions,
    garbage: (rawText.match(GARBAGE) || []).length,
    spaced: (rawText.match(LETTER_SPACED) || []).length,
    glued: gluedTokens.length,
    gluedTokens: gluedTokens.slice(0, 2),
  };
}

/** One line per problem, for assertion messages; empty when the text parses cleanly. */
export function problems(name, s, { order = true } = {}) {
  const out = [];
  if (s.missing.length) out.push(`${name}: ${s.missing.length} fact(s) lost — ${s.missing.slice(0, 4).map((m) => JSON.stringify(m.slice(0, 45))).join(', ')}`);
  if (order && s.overlaps.length) out.push(`${name}: ${s.overlaps.length} interleaved entr${s.overlaps.length === 1 ? 'y' : 'ies'} — ${s.overlaps.slice(0, 3).map((p) => p.join('×')).join(', ')}`);
  if (s.garbage) out.push(`${name}: ${s.garbage} garbage character(s)`);
  if (s.spaced) out.push(`${name}: ${s.spaced} letter-spaced run(s)`);
  if (s.glued) out.push(`${name}: ${s.glued} glued token(s) (words run together) — ${s.gluedTokens.map((t) => JSON.stringify(t.slice(0, 40))).join(', ')}`);
  return out;
}
