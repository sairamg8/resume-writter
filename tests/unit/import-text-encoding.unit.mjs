// R4-IMP-06: a text or Markdown file was read as UTF-8 whatever it was. Word's "Save as Plain Text"
// writes Windows-1252 by default, where • – — and curly quotes are bytes UTF-8 cannot read: they
// became "�", so "Mar 2021 – Present" was no date and "• Led …" no list item, and nothing was found.
// Notepad's "Unicode" (UTF-16 behind a byte-order mark) read as mojibake. Both now read as written.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeFromFile } from '../../src/utils/importFile.js';

// A fictional person, as Word saves a résumé as plain text.
const TEXT = [
  'Jordan Ellery',
  'Operations Manager',
  'jordan.ellery@example.com | Leeds, United Kingdom',
  '',
  'EXPERIENCE',
  'Harbourside Logistics — Operations Manager',
  'Mar 2021 – Present',
  '• Led the “Next Day” rollout across four depots.',
  '• Cut late deliveries by a third.',
].join('\r\n');

/** `text` in Windows-1252: the characters it has one byte for, the rest as ASCII. */
function cp1252(text) {
  const high = { '€': 0x80, '‚': 0x82, '„': 0x84, '…': 0x85, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97 };
  return Uint8Array.from([...text].map((c) => high[c] ?? (c.charCodeAt(0) < 0x100 ? c.charCodeAt(0) : 0x3f)));
}
function utf16(text, bigEndian) {
  const out = [bigEndian ? 0xfe : 0xff, bigEndian ? 0xff : 0xfe];
  for (let i = 0; i < text.length; i += 1) {
    const c = text.charCodeAt(i);
    out.push(...(bigEndian ? [c >> 8, c & 0xff] : [c & 0xff, c >> 8]));
  }
  return Uint8Array.from(out);
}
const fileOf = (name, bytes) => ({ name, size: bytes.length, arrayBuffer: async () => bytes.slice().buffer });

function assertRead(resume, how) {
  assert.equal(resume.personal.name, 'Jordan Ellery', how);
  assert.equal(resume.personal.email, 'jordan.ellery@example.com', how);
  const [job] = resume.sections.find((s) => s.type === 'experience')?.items || [];
  assert.ok(job, `${how}: the job is found by its date`);
  assert.deepEqual([job.company, job.role, job.startDate, job.current], ['Harbourside Logistics', 'Operations Manager', 'Mar 2021', true], how);
  assert.match(job.description, /<ul><li>Led the “Next Day” rollout across four depots\.<\/li><li>Cut late/, how);
  const all = JSON.stringify(resume);
  // JSON.stringify writes a NUL as the six characters \u0000.
  assert.ok(!all.includes('\uFFFD') && !all.includes('\\u0000'), `${how}: no "\uFFFD" and no NUL anywhere`);
}

test('Word\'s "Save as Plain Text" (Windows-1252): bullets, dashes and quotes read as written', async () => {
  assertRead(await resumeFromFile(fileOf('resume.txt', cp1252(TEXT))), 'Windows-1252');
});

test('Notepad\'s "Unicode" (UTF-16 LE with its mark) and UTF-16 BE', async () => {
  assertRead(await resumeFromFile(fileOf('resume.txt', utf16(TEXT, false))), 'UTF-16 LE');
  assertRead(await resumeFromFile(fileOf('resume.md', utf16(TEXT, true))), 'UTF-16 BE');
});

test('UTF-8, with or without its mark, as before', async () => {
  const utf8 = new TextEncoder().encode(TEXT);
  assertRead(await resumeFromFile(fileOf('resume.txt', utf8)), 'UTF-8');
  assertRead(await resumeFromFile(fileOf('resume.txt', Uint8Array.from([0xef, 0xbb, 0xbf, ...utf8]))), 'UTF-8 with a BOM');
});

test('UTF-8 with one stray bad byte stays UTF-8: its dashes and accents read as written, not as "â€“"', async () => {
  const utf8 = new TextEncoder().encode(TEXT.replace('Leeds', 'Léeds'));
  const stray = Uint8Array.from([...utf8, 0x0d, 0x0a, 0x95]);
  const r = await resumeFromFile(fileOf('resume.txt', stray));
  const [job] = r.sections.find((s) => s.type === 'experience')?.items || [];
  assert.equal(job?.startDate, 'Mar 2021');
  assert.equal(r.personal.location, 'Léeds, United Kingdom');
  assert.doesNotMatch(JSON.stringify(r), /â€/);
});
