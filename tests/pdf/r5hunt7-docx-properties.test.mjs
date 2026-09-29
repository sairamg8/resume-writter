// R5-HUNT7-DOCX-AUTHOR-UN-NAMED: the .docx résumé and cover letter gave docx no properties, so it wrote
// its defaults: Author and Last Modified By "Un-named", no Title. They now carry the PDF's: Title
// "<Name> Resume" / "<Name> Cover Letter", Author and Last Modified By the name.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule, resume, unzipEntry } from './harness.mjs';

before(setup);
after(teardown);

async function coreXml(blob) {
  return unzipEntry(Buffer.from(new Uint8Array(await blob.arrayBuffer())), 'docProps/core.xml') || '';
}
const tag = (xml, name) => (xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([^<]*)</${name}>`)) || [])[1];

describe('Word export: document properties', () => {
  it('the résumé names its author and title as the PDF does', async () => {
    const { renderResumeDocx } = await loadModule('/src/utils/wordExport.js');
    const xml = await coreXml(await renderResumeDocx(resume({ personal: { name: 'Jane Doe' } })));
    assert.ok(!xml.includes('Un-named'), xml);
    assert.equal(tag(xml, 'dc:creator'), 'Jane Doe');
    assert.equal(tag(xml, 'cp:lastModifiedBy'), 'Jane Doe');
    assert.equal(tag(xml, 'dc:title'), 'Jane Doe Resume');
  });

  it('the cover letter is titled as the letter PDF', async () => {
    const { renderCoverLetterDocx } = await loadModule('/src/utils/wordExport.js');
    const xml = await coreXml(await renderCoverLetterDocx(resume({ personal: { name: 'Jane Doe' } })));
    assert.ok(!xml.includes('Un-named'), xml);
    assert.equal(tag(xml, 'dc:creator'), 'Jane Doe');
    assert.equal(tag(xml, 'dc:title'), 'Jane Doe Cover Letter');
  });

  it('a résumé with no name is titled Resume and names no author', async () => {
    const { renderResumeDocx } = await loadModule('/src/utils/wordExport.js');
    const xml = await coreXml(await renderResumeDocx(resume({ personal: { name: '' } })));
    assert.ok(!xml.includes('Un-named'), xml);
    assert.equal(tag(xml, 'dc:title'), 'Resume');
  });
});
