// A Word file someone sent is a zip, and its parts were inflated with no limit on their size: a 20 MB
// file (the import's cap) made to deflate a thousandfold filled the tab's memory before a word of it
// was read. A part may now inflate to 32 MB at most (MAX_INFLATED_BYTES, far over any résumé's text);
// past that the import stops reading it and says why. A damaged part still says the file is damaged.
// Run: node --test tests/pdf/226-cyc4-docx-inflate-cap.test.mjs
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { setup, teardown, loadModule } from './harness.mjs';

let unzipEntry;
before(async () => {
  await setup();
  ({ unzipEntry } = await loadModule('/src/utils/importFile.js'));
});
after(teardown);

/** A one-entry zip: `deflated` bytes stored as the entry `name` (method 8). */
function zipOf(name, deflated) {
  const nameBytes = Buffer.from(name);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(nameBytes.length, 26);
  const entry = Buffer.concat([local, nameBytes, deflated]);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(deflated.length, 20);
  central.writeUInt16LE(nameBytes.length, 28);
  const dir = Buffer.concat([central, nameBytes]);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(dir.length, 12);
  end.writeUInt32LE(entry.length, 16);
  return new Uint8Array(Buffer.concat([entry, dir, end]));
}

it('a part of ordinary size is inflated as before', async () => {
  const text = '<w:p><w:t>Jane Doe</w:t></w:p>'.repeat(1000);
  const out = await unzipEntry(zipOf('word/document.xml', zlib.deflateRawSync(Buffer.from(text))), 'word/document.xml');
  assert.equal(Buffer.from(out).toString(), text);
});

it('a part that inflates past 32 MB is refused, with the reason', async () => {
  const bomb = zlib.deflateRawSync(Buffer.alloc(33 * 1024 * 1024));
  assert.ok(bomb.length < 1024 * 1024, 'the file itself is small');
  await assert.rejects(unzipEntry(zipOf('word/document.xml', bomb), 'word/document.xml'), /far more text than a résumé can/);
});

it('a part that is not deflated data still says the file is damaged', async () => {
  await assert.rejects(unzipEntry(zipOf('word/document.xml', Buffer.from('not deflate data at all, only text')), 'word/document.xml'), /damaged/);
});
