// R4-IMP-14: the Import file pickers offered '.json,.pdf,.docx,.txt,.md', so a résumé saved as
// resume.markdown or resume.text was greyed out in the picker, though the import reads both
// (isDocumentFile, documentLines). Every extension the document import reads can now be picked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IMPORT_ACCEPT, isDocumentFile } from '../../src/utils/importDocument.js';

test('the pickers offer every extension the import reads (an older .doc aside: it is only told to save as .docx)', () => {
  const offered = IMPORT_ACCEPT.split(',');
  for (const ext of ['.pdf', '.docx', '.txt', '.text', '.md', '.markdown']) {
    assert.equal(isDocumentFile({ name: `resume${ext}` }), true, `${ext} is read as a document`);
    assert.ok(offered.includes(ext), `${ext} is offered by the picker: ${IMPORT_ACCEPT}`);
  }
  assert.ok(offered.includes('.json'), 'and the backups');
});
