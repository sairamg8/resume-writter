// R2-146: Design → Typography → Job Title sizes the header's job title under the name. Unset (a fresh
// résumé's null, or an older one's missing key) it prints at Entry Header's size, as it always had;
// set, every template's header, the cover letter's letterhead and Word's header and letterhead print
// it at base + its delta — and nothing else in the header moves size.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule, resume, experience, render, renderCover, read, allItems, renderDocx, TEMPLATES } from './harness.mjs';

before(setup);
after(teardown);

const TITLE = 'Principal Platform Engineer';
const person = { name: 'Jordan Rivera', title: TITLE, email: 'jordan@example.com' };
const job = () => experience([{ company: 'Northwind Labs', role: 'Staff Engineer' }]);
const sized = async (bytes, needle) => allItems(await read(bytes)).find((t) => t.str.includes(needle))?.h;
const titleH = async (template, settings) => sized(await render(resume({ template, settings, personal: person, sections: [job()] })), 'Principal');

describe('the PDF prints Job Title\'s size (R2-146)', () => {
  for (const template of TEMPLATES) {
    it(`${template}: unset follows Entry Header; set, the title alone takes base + its delta`, async () => {
      const plain = await titleH(template, {});
      assert.ok(plain, 'the title prints');
      const missing = resume({ template, personal: person, sections: [job()] });
      delete missing.settings.fontSizeTitleDelta;
      assert.equal(await sized(await render(missing), 'Principal'), plain, 'an older résumé with no key prints as a fresh one');
      const entryUp = await titleH(template, { fontSizeEntryDelta: 2 });
      assert.ok(Math.abs(entryUp - plain - 2) < 0.3, `unset, it follows Entry Header: ${plain} → ${entryUp}`);
      const set = await titleH(template, { fontSizeTitleDelta: 5 });
      assert.ok(Math.abs(set - (plain + 5)) < 0.3, `Job Title 16 pt: ${plain} → ${set}`);
      const r = resume({ template, settings: { fontSizeTitleDelta: 5 }, personal: person, sections: [job()] });
      const r0 = resume({ template, personal: person, sections: [job()] });
      const [a, b] = [await read(await render(r0)), await read(await render(r))];
      const nameOf = (pages) => allItems(pages).find((t) => t.str.includes('Jordan'))?.h;
      const companyOf = (pages) => allItems(pages).find((t) => t.str.includes('Northwind'))?.h;
      assert.deepEqual([nameOf(b), companyOf(b)], [nameOf(a), companyOf(a)], 'the name and the entries keep their size');
    });
  }

  it('the cover letter\'s letterhead prints the title at the same size', async () => {
    const letter = (settings) => resume({ settings, personal: person, coverLetter: { body: '<p>Dear team,</p>' } });
    const plain = await sized(await renderCover(letter({})), 'Principal');
    const set = await sized(await renderCover(letter({ fontSizeTitleDelta: 5 })), 'Principal');
    assert.ok(plain && Math.abs(set - (plain + 5)) < 0.3, `letter: ${plain} → ${set}`);
  });
});

describe('Word prints Job Title\'s size (R2-146)', () => {
  const titleSz = (docx) => {
    const p = docx.paragraphs.find((x) => x.text.includes(TITLE));
    const run = p?.xml.split('<w:r>').find((r) => r.includes(TITLE));
    const m = run?.match(/<w:sz w:val="(\d+)"\/>/);
    return m ? Number(m[1]) : null;
  };
  it('the résumé header: Entry Header\'s size unset, base + delta set (half-points)', async () => {
    assert.equal(titleSz(await renderDocx(resume({ personal: person, sections: [job()] }))), 22);
    assert.equal(titleSz(await renderDocx(resume({ settings: { fontSizeTitleDelta: 5 }, personal: person, sections: [job()] }))), 32);
  });

  it('the stored delta is kept in its 6–24 pt range against the base', async () => {
    const { withDesignNumbers } = await loadModule('/src/constants/designNumbers.js');
    assert.equal(withDesignNumbers({ settings: { fontSizeBase: 11, fontSizeTitleDelta: 40 } }).settings.fontSizeTitleDelta, 13);
    assert.equal(withDesignNumbers({ settings: { fontSizeBase: 11, fontSizeTitleDelta: null } }).settings.fontSizeTitleDelta, null);
  });
});
