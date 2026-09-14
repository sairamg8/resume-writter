// The cover letter: the business-letter block (date, recipient, subject) and the Word export.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  setup, teardown, resume, experience, renderCover, read, allItems, allText, loadModule, readDocx,
} from './harness.mjs';

before(setup);
after(teardown);

const LETTER = {
  date: '2026-01-15',
  recipientName: 'Sarah Smith',
  recipientTitle: 'Engineering Manager',
  company: 'Globex Corp',
  subject: 'Application for the Senior Engineer role',
  body: '<p>Dear Sarah,</p><p>I am excited to apply.</p>',
};

/** The one text item that is exactly `str`. */
function item(pages, str) {
  const hits = allItems(pages).filter((t) => t.str.trim() === str);
  assert.equal(hits.length, 1, `one "${str}" in: ${allText(pages)}`);
  return hits[0];
}

/** The letterhead's name (the signature repeats it lower down). */
const letterhead = (pages) => allItems(pages).filter((t) => t.str === 'Test Person').sort((a, b) => b.y - a.y)[0];

describe('cover letter — date, recipient and subject (FIDB-49)', () => {
  it('prints date → recipient name, title, company → subject between the letterhead and the body', async () => {
    const pages = await read(await renderCover(resume({ coverLetter: LETTER })));
    const order = [letterhead(pages), ...['15 January 2026', 'Sarah Smith', 'Engineering Manager', 'Globex Corp',
      'Application for the Senior Engineer role', 'Dear Sarah,'].map((s) => item(pages, s))];
    for (let i = 1; i < order.length; i += 1) {
      assert.ok(order[i].y < order[i - 1].y, `"${order[i].str}" (y ${order[i].y}) prints below "${order[i - 1].str}" (y ${order[i - 1].y})`);
    }
    const body = item(pages, 'Dear Sarah,');
    for (const t of order.slice(1)) assert.ok(Math.abs(t.x - body.x) < 0.5, `"${t.str}" starts at the body's margin`);
    assert.match(item(pages, 'Sarah Smith').font, /Bold/, 'the recipient name is bold');
    assert.match(item(pages, 'Application for the Senior Engineer role').font, /Bold/, 'the subject is bold');
  });

  it('an ISO date prints as a written date; anything else prints as typed', async () => {
    const iso = await read(await renderCover(resume({ coverLetter: { date: '2026-03-01' } })));
    assert.ok(allText(iso).includes('1 March 2026'), allText(iso));
    assert.ok(!allText(iso).includes('2026-03-01'));
    const typed = await read(await renderCover(resume({ coverLetter: { date: 'March 1st, 2026' } })));
    assert.ok(allText(typed).includes('March 1st, 2026'), allText(typed));
  });

  it('prints each line only when it is filled — a new letter prints none of them', async () => {
    const some = await read(await renderCover(resume({ coverLetter: { company: 'Globex Corp', subject: 'Re: the role', body: '<p>Hello</p>' } })));
    const text = allText(some);
    assert.ok(text.includes('Globex Corp') && text.includes('Re: the role'), text);
    assert.ok(!text.includes('Hiring Manager'), `no recipient title the user did not type: ${text}`);

    const blank = await read(await renderCover(resume({ coverLetter: { body: '<p>Hello</p>' } })));
    const bare = await read(await renderCover(resume({ coverLetter: {
      body: '<p>Hello</p>', date: ' ', recipientName: '', recipientTitle: '', company: '', subject: '',
    } })));
    assert.equal(allText(blank), 'Test Person Engineer Hello Sincerely, Test Person Engineer');
    assert.equal(item(bare, 'Hello').y, item(blank, 'Hello').y, 'blank fields leave no gap');
  });
});

async function renderCoverDocx(r) {
  const { renderCoverLetterDocx } = await loadModule('/src/utils/wordExport.js');
  return readDocx(new Uint8Array(await (await renderCoverLetterDocx(r)).arrayBuffer()));
}

describe('cover letter — Word export (FIDB-50)', () => {
  it('is the letter, in the PDF\'s order: letterhead, date, recipient, subject, body, closing, signature', async () => {
    const r = resume({
      personal: { email: 'me@example.com', phone: '+1 555 0100', summary: '<p>Resume summary</p>' },
      sections: [experience([{ company: 'Resume Only Co' }])],
      coverLetter: { ...LETTER, closing: 'Kind regards', signatureName: 'T. Person', signatureDesignation: 'Staff Engineer' },
    });
    const doc = await renderCoverDocx(r);
    const order = ['Test Person', 'Engineer', 'me@example.com', '15 January 2026', 'Sarah Smith', 'Engineering Manager',
      'Globex Corp', 'Application for the Senior Engineer role', 'Dear Sarah,', 'I am excited to apply.',
      'Kind regards,', 'T. Person', 'Staff Engineer'];
    const at = order.map((s) => doc.texts.findIndex((t) => t === s || (s.includes('@') && t.includes(s))));
    assert.ok(!at.includes(-1), `${order.filter((_, i) => at[i] < 0).join(', ')} missing in: ${doc.texts.join(' | ')}`);
    assert.deepEqual(at, [...at].sort((a, b) => a - b), doc.texts.join(' | '));
    for (const s of ['Resume Only Co', 'Resume summary', 'PROFESSIONAL EXPERIENCE']) {
      assert.ok(!doc.texts.some((t) => t.includes(s)), `the résumé's "${s}" is not in the letter`);
    }
    assert.deepEqual(doc.links, ['mailto:me@example.com', 'tel:+15550100']);
  });

  it('leaves out hidden contacts and empty lines; the body keeps its rich text', async () => {
    const doc = await renderCoverDocx(resume({
      personal: { email: 'me@example.com', phone: '+1 555 0100' },
      coverLetter: { hiddenFields: ['email'], body: '<p>Hi <strong>there</strong></p><ol><li>First</li></ol><p><a href="https://example.com/p">portfolio</a></p>' },
    }));
    const text = doc.texts.join(' | ');
    assert.ok(!text.includes('me@example.com') && text.includes('+1 555 0100'), text);
    assert.ok(doc.texts.includes('Hi there') && doc.texts.includes('1.\tFirst'), text);
    assert.ok(doc.links.includes('https://example.com/p'), doc.links.join(', '));
    assert.ok(!text.includes('Hiring Manager') && !text.includes('<'), text);
    assert.deepEqual(doc.texts.slice(-3), ['Sincerely,', 'Test Person', 'Engineer'], 'the signature falls back to the résumé name and title');
  });

  it('contacts follow the letter\'s own visibility, not the résumé\'s (FIDB-44)', async () => {
    const text = async (resumeHidden, coverLetter) => (await renderCoverDocx(resume({
      personal: { email: 'me@example.com', phone: '+1 555 0100', hiddenFields: resumeHidden }, coverLetter,
    }))).texts.join(' | ');
    const shown = await text(['phone'], { hiddenFields: [] });
    assert.ok(shown.includes('+1 555 0100'), `hidden on the résumé, shown on the letter: ${shown}`);
    const hidden = await text([], { hiddenFields: ['phone'] });
    assert.ok(!hidden.includes('+1 555 0100') && hidden.includes('me@example.com'), `hidden on the letter only: ${hidden}`);
    const unset = await text(['phone'], {});
    assert.ok(!unset.includes('+1 555 0100') && unset.includes('me@example.com'), `no list of its own: the résumé's: ${unset}`);
  });
});

describe('cover letter — contact style and layout', () => {
  it('the letter\'s own once set, else the résumé\'s: what the PDF prints and the panel\'s chips show', async () => {
    const { letterContactFormat } = await loadModule('/src/utils/coverLetter.js');
    const cv = { contactStyle: 'bullet', contactLayout: 'single' };
    assert.deepEqual(letterContactFormat({}, cv), { style: 'bullet', layout: 'single' });
    assert.deepEqual(letterContactFormat({ headerStyle: 'bar', headerLayout: '2grid' }, cv), { style: 'bar', layout: '2grid' });
    assert.deepEqual(letterContactFormat({}, {}), { style: 'bar', layout: 'justify' });
    assert.deepEqual(letterContactFormat(undefined, undefined), { style: 'bar', layout: 'justify' });

    const r = resume({ settings: cv, personal: { email: 'me@example.com', phone: '+1 555 0100' } });
    const pdf = allText(await read(await renderCover(r)));
    assert.ok(pdf.includes('•'), `the résumé's bullet style: ${pdf}`);
    const doc = await renderCoverDocx(r);
    assert.ok(doc.texts.some((t) => t.includes('me@example.com  •  +1 555 0100')), doc.texts.join(' | '));
  });
});

// ── Photo ↔ text alignment ───────────────────────────────────────────────────

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

/** Bottom y and height of each image drawn on page 1 (the CTM in effect when it is painted). */
async function imageBoxes(bytes) {
  const { pdfjs } = await setup();
  const doc = await pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, verbosity: 0 }).promise;
  const O = pdfjs.OPS;
  const ops = await (await doc.getPage(1)).getOperatorList();
  const mul = (m, n) => [
    m[0] * n[0] + m[1] * n[2], m[0] * n[1] + m[1] * n[3], m[2] * n[0] + m[3] * n[2],
    m[2] * n[1] + m[3] * n[3], m[4] * n[0] + m[5] * n[2] + n[4], m[4] * n[1] + m[5] * n[3] + n[5],
  ];
  let ctm = [1, 0, 0, 1, 0, 0];
  const stack = [];
  const boxes = [];
  ops.fnArray.forEach((fn, k) => {
    if (fn === O.save) stack.push(ctm);
    else if (fn === O.restore) ctm = stack.pop() || ctm;
    else if (fn === O.transform) ctm = mul(ops.argsArray[k], ctm);
    else if (fn === O.paintImageXObject || fn === O.paintInlineImageXObject) boxes.push({ y: ctm[5], h: ctm[3] });
  });
  await doc.loadingTask.destroy();
  return boxes;
}

describe('cover letter — photo ↔ text alignment (FIDB-76)', () => {
  for (const fieldsPosition of ['right', 'below-name', 'below-all']) {
    it(`${fieldsPosition}: Top / Center / Bottom move the name block against the photo`, async () => {
      const at = {};
      for (const photoTextAlign of ['top', 'center', 'bottom']) {
        const bytes = await renderCover(resume({
          settings: { photoShape: 'square', photoHeight: 'taller' }, // a photo much taller than the name block
          personal: { photo: PNG, email: 'me@example.com' },
          coverLetter: { fieldsPosition, photoTextAlign },
        }));
        const [photo] = await imageBoxes(bytes);
        at[photoTextAlign] = { photo, name: letterhead(await read(bytes)).y };
      }
      const { top, center, bottom } = at;
      assert.equal(top.photo.y, center.photo.y, 'the photo stays put');
      assert.equal(bottom.photo.y, center.photo.y, 'the photo stays put');
      const up = top.name - center.name;
      const down = center.name - bottom.name;
      assert.ok(up > 3 && down > 3, `top moves the name up (${up.toFixed(1)} pt), bottom moves it down (${down.toFixed(1)} pt)`);
      assert.ok(Math.abs(up - down) < 0.5, `centred halfway between: up ${up.toFixed(2)}, down ${down.toFixed(2)}`);
      const photoTop = top.photo.y + top.photo.h;
      assert.ok(top.name < photoTop && top.name > photoTop - 19 * 1.2, `top: the name's line starts at the photo's top edge (${photoTop.toFixed(1)}), baseline ${top.name.toFixed(1)}`);
    });
  }
});
