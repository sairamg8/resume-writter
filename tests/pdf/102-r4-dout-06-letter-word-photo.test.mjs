// R4-DOUT-06: the cover letter's PDF letterhead prints a photo — the letter's own, else the résumé's
// (none when hidden under Personal Info → Photo), none with Show photo off, beside the name at
// Photo → Position — but its Word letter never did ("a text document: no photo"). Now the .docx
// letterhead prints the same photo by the same rules (wordLetterPhoto): a picture in word/media and
// a <w:drawing> in the letterhead, left or right of the name as Photo → Position sets.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, loadModule, readDocx } from './harness.mjs';
import { PNG_2X2 as PNG } from './extractors.mjs';

before(setup);
after(teardown);

/** The letter's .docx: its paragraphs and XML (readDocx), and whether it holds a picture (word/media/*). */
async function letterDocx(r) {
  const { renderCoverLetterDocx } = await loadModule('/src/utils/wordExport.js');
  const bytes = new Uint8Array(await (await renderCoverLetterDocx(r)).arrayBuffer());
  // A zip stores its entries' names as they are: a picture's is word/media/<name>.
  return { ...readDocx(bytes), media: Buffer.from(bytes).includes('word/media/') };
}

const letter = ({ settings = {}, personal = {}, coverLetter = {} } = {}) => resume({
  settings: { headerAlign: 'left', ...settings },
  personal: { name: 'Robin Example', email: 'robin@example.com', photo: PNG, hiddenFields: [], ...personal },
  coverLetter: { body: '<p>Dear team,</p>', ...coverLetter },
});

describe('the Word cover letter prints the letterhead photo the PDF does (R4-DOUT-06)', () => {
  it('prints the résumé photo, and none with Show photo off', async () => {
    const shown = await letterDocx(letter());
    assert.ok(shown.media, 'a picture in word/media');
    assert.match(shown.xml, /<w:drawing>/, 'the letterhead draws it');
    const off = await letterDocx(letter({ coverLetter: { showPhoto: false } }));
    assert.equal(off.media, false, 'Show photo off: no picture');
    assert.doesNotMatch(off.xml, /<w:drawing>/);
    assert.ok(off.texts.some((t) => t.includes('Robin Example')), 'the letterhead still prints');
  });

  it("takes the letter's own photo, else the résumé's unless it is hidden", async () => {
    const hidden = { photo: PNG, hiddenFields: ['photo'] };
    assert.equal((await letterDocx(letter({ personal: hidden }))).media, false, 'a hidden résumé photo prints none');
    assert.ok((await letterDocx(letter({ personal: hidden, coverLetter: { clPhoto: PNG } }))).media, "the letter's own photo prints");
    assert.ok((await letterDocx(letter({ personal: { photo: '' }, coverLetter: { clPhoto: PNG } }))).media, "the letter's own photo, with no résumé photo");
  });

  for (const fieldsPosition of ['right', 'below-name', 'below-all']) {
    it(`${fieldsPosition}: the photo sits left of the name, and right of it at Photo → Position Right`, async () => {
      const order = async (photoPosition) => {
        const { xml } = await letterDocx(letter({ settings: { photoPosition }, coverLetter: { fieldsPosition } }));
        const photo = xml.indexOf('<w:drawing>');
        const name = xml.indexOf('Robin Example');
        assert.ok(photo >= 0 && name >= 0, `${fieldsPosition}, ${photoPosition}: photo and name print`);
        return photo < name ? 'photo first' : 'name first';
      };
      assert.equal(await order('left'), 'photo first');
      assert.equal(await order('right'), 'name first');
    });
  }
});
