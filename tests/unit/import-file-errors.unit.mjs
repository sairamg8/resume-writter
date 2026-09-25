// R2-148 review: a file the document import cannot read says why, in words, and never hangs or
// crashes the page. An older Word .doc (picked through "All files") was sent down the JSON path and
// told "Could not parse file … (.json)"; now it is told to save it as .docx, and a .docx named .doc
// reads. A damaged .docx (a central directory pointing past the file's end, a size larger than the
// file) surfaced a DataView RangeError ("Offset is outside the bounds of the DataView"); now it says
// the Word file is damaged. A file far larger than any résumé is refused before it is read.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Document, Packer, Paragraph } from 'docx';
import { resumeFromFile, unzipEntry, MAX_IMPORT_BYTES } from '../../src/utils/importFile.js';
import { importDocument, isDocumentFile } from '../../src/utils/importDocument.js';

const DAMAGED = /That Word file is damaged/;

/** A picked file: its name and bytes, as a File gives them (`size` as a File has it). */
const fileOf = (name, bytes) => ({ name, size: bytes.length, arrayBuffer: async () => bytes.slice().buffer });

/** A real .docx: a fictional person's name and job title. */
async function docxBytes() {
  const doc = new Document({ sections: [{ children: [new Paragraph('Robin Vale'), new Paragraph('Product Designer')] }] });
  return new Uint8Array(await Packer.toBuffer(doc));
}

/** The byte offset of word/document.xml's central-directory record in `bytes`. */
function centralRecord(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const name = new TextEncoder().encode('word/document.xml');
  for (let p = 0; p + 46 <= bytes.length; p += 1) {
    if (view.getUint32(p, true) !== 0x02014b50) continue;
    const len = view.getUint16(p + 28, true);
    if (len === name.length && bytes.subarray(p + 46, p + 46 + len).every((b, i) => b === name[i])) return p;
  }
  throw new Error('no central record for word/document.xml');
}

describe('a Word file the import cannot read says why', () => {
  test('an older .doc goes the document way, and is told to save it as .docx', async () => {
    assert.equal(isDocumentFile({ name: 'cv.doc' }), true, 'before: the JSON way, "Could not parse file … (.json)"');
    assert.equal(isDocumentFile({ name: 'CV.DOC' }), true);
    assert.equal(isDocumentFile({ name: 'backup.json' }), false);
    // An OLE compound file, as Word 97–2003 writes one, with a line of text in it.
    const ole = new Uint8Array(4096);
    ole.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    ole.set(new TextEncoder().encode('Robin Vale Product Designer'), 1024);
    await assert.rejects(resumeFromFile(fileOf('robin.doc', ole)), /older \.doc must be saved as \.docx/);

    const errors = [];
    const id = await importDocument(fileOf('robin.doc', ole), { importResume: () => assert.fail('nothing is imported'), navigate: () => assert.fail('nowhere to go'), onError: (m) => errors.push(m) });
    assert.equal(id, null);
    assert.equal(errors.length, 1);
    assert.match(errors[0], /^Could not import robin\.doc: .*saved as \.docx/);
  });

  test('a .docx named .doc reads as the Word file it is', async () => {
    const r = await resumeFromFile(fileOf('robin.doc', await docxBytes()));
    assert.equal(r.personal.name, 'Robin Vale');
    assert.equal(r.personal.title, 'Product Designer');
  });

  test('a central directory that points past the end of the file: "damaged", not a RangeError', async () => {
    const bytes = await docxBytes();
    const at = centralRecord(bytes);
    const view = new DataView(bytes.buffer);
    view.setUint32(at + 42, bytes.length - 10, true); // the local header's offset: 10 bytes from the end
    await assert.rejects(unzipEntry(bytes, 'word/document.xml'), DAMAGED);
    view.setUint32(at + 42, 0xfffffff0, true);
    await assert.rejects(resumeFromFile(fileOf('robin.docx', bytes)), DAMAGED);
  });

  test('a compressed size larger than the file, or data that does not inflate: "damaged"', async () => {
    const bytes = await docxBytes();
    const at = centralRecord(bytes);
    const big = bytes.slice();
    new DataView(big.buffer).setUint32(at + 20, big.length * 2, true);
    await assert.rejects(unzipEntry(big, 'word/document.xml'), DAMAGED);

    // The deflated data overwritten with bytes no deflate stream starts with.
    const bad = bytes.slice();
    const view = new DataView(bad.buffer);
    const local = view.getUint32(at + 42, true);
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    bad.fill(0xff, start, start + Math.min(64, view.getUint32(at + 20, true)));
    await assert.rejects(unzipEntry(bad, 'word/document.xml'), DAMAGED);
  });

  test('every truncation and a thousand random corruptions of a .docx settle, as an Error with a message', async () => {
    const bytes = await docxBytes();
    const outcomes = [];
    const settle = async (b) => {
      try { await resumeFromFile(fileOf('robin.docx', b)); outcomes.push('read'); } catch (e) {
        assert.ok(e instanceof Error && e.message, String(e));
        assert.doesNotMatch(e.message, /outside the bounds|Offset is/, 'a DataView error reached the user');
        outcomes.push('refused');
      }
    };
    for (let n = 0; n < bytes.length; n += Math.max(1, Math.floor(bytes.length / 200))) await settle(bytes.slice(0, n));
    let seed = 42;
    const random = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    for (let i = 0; i < 1000; i += 1) {
      const b = bytes.slice();
      for (let k = 0; k < 4; k += 1) b[Math.floor(random() * b.length)] = Math.floor(random() * 256);
      await settle(b);
    }
    assert.ok(outcomes.includes('refused'));
  });
});

describe('a file far larger than a résumé is refused before it is read', () => {
  test(`over ${MAX_IMPORT_BYTES / 1024 / 1024} MB: refused, its bytes never read`, async () => {
    assert.equal(MAX_IMPORT_BYTES, 20 * 1024 * 1024);
    let read = false;
    const huge = { name: 'scan.pdf', size: MAX_IMPORT_BYTES + 1, arrayBuffer: async () => { read = true; return new ArrayBuffer(0); } };
    await assert.rejects(resumeFromFile(huge), /too large to be a résumé/);
    assert.equal(read, false, 'before: the whole file was read and parsed on the page');
    // A file at the limit is read.
    const text = new TextEncoder().encode('Robin Vale\nProduct Designer\n');
    const r = await resumeFromFile({ name: 'robin.txt', size: MAX_IMPORT_BYTES, arrayBuffer: async () => text.slice().buffer });
    assert.equal(r.personal.name, 'Robin Vale');
  });
});
