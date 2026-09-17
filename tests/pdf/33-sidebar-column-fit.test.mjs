// The Sidebar's dark column is 38 % of the paper less its padding — 155 pt on A4 at the default
// 18 mm, 103 pt at 40 mm. textkit breaks a line only at a space, and inside a token only at the
// marks breakLongWords puts in one longer than 48 characters, so a shorter token wider than the
// column had nowhere to break and ran out of it, over the main column: the job title
// "Softwareentwicklungsingenieurin" to x 224.5 and the e-mail
// "alexandra.johnson-smith@examplecompany.com" to x 267.4, against a column ending at 216.2. The
// title now prints at the largest size that holds it, as the name does (fitFontSize, NB-3). A
// contact, a reference's e-mail and a certificate's link break inside the column instead — after
// / . - _ @ …, and a piece with none of those into runs of characters that fit (breakToFit) —
// with nothing added to the text. Found by task NB-3 (fix2_NB-3 new_bugs[0]); task NB-3-NB1.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, render, read, MM } from './harness.mjs';
import { PNG_2X2 as PNG } from './extractors.mjs';

before(setup);
after(teardown);

/** The dark column's text box on `page` at `marginH` mm: the page margin to its 10 pt right padding. */
const columnOf = (page, marginH) => ({ left: marginH * MM, right: page.W * 0.38 - 10 });

/** The runs printed in the dark column (the main column starts 14 pt past its edge). */
const inColumn = (page) => page.items.filter((t) => t.x < page.W * 0.38);

/** The dark column's runs that print past either side of its text box. */
function outside(page, marginH) {
  const { left, right } = columnOf(page, marginH);
  return inColumn(page)
    .filter((t) => t.x < left - 0.5 || t.x + t.w > right + 0.5)
    .map((t) => `${t.str} (x ${t.x.toFixed(1)}…${(t.x + t.w).toFixed(1)}, column ${left.toFixed(1)}…${right.toFixed(1)})`);
}

/** The lines `address` printed on, in order: consecutive runs that spell it exactly; [] when none do. */
function linesOf(page, address) {
  const items = inColumn(page);
  for (let i = 0; i < items.length; i += 1) {
    let text = '';
    for (let j = i; j < items.length && address.startsWith(text + items[j].str); j += 1) {
      text += items[j].str;
      if (text === address) return items.slice(i, j + 1);
    }
  }
  return [];
}

/** The run holding `word` whole, or undefined. */
const run = (page, word) => page.items.find((t) => t.str.includes(word));

const PAPERS = [['A4', 18], ['A4', 40], ['LETTER', 18], ['LETTER', 40]];
const PUNCT = /[/.\-_@?&=#]$/;

describe('Sidebar: a job title word wider than the dark column', () => {
  it('prints whole inside the column, at the largest size that holds it', async () => {
    const titles = [
      ['Softwareentwicklungsingenieurin', 'Softwareentwicklungsingenieurin'],
      ['Senior Kommunikationselektroniktechnikerin', 'Kommunikationselektroniktechnikerin'],
    ];
    for (const [title, word] of titles) {
      for (const [pageSize, marginH] of PAPERS) {
        for (const delta of [0, 3]) {
          const size = 11 + delta; // Design → Font sizes → Entry title: the job title's size
          const at = `${word}, ${pageSize} ${marginH} mm, ${size} pt`;
          const [page] = await read(await render(resume({
            template: 'sidebar',
            settings: { pageSize, marginH, fontSizeEntryDelta: delta },
            personal: { name: 'Alexandra Johnson', title, photo: PNG },
          })));
          const { left, right } = columnOf(page, marginH);
          assert.deepEqual(outside(page, marginH), [], `${at}: outside the column`);
          const item = run(page, word);
          assert.ok(item, `${at}: the word printed whole`);
          assert.ok(item.h < size - 0.05, `${at}: kept ${item.h.toFixed(2)} pt, wider than the column`);
          // The largest size that holds it: centred, it spans the column's text box.
          assert.ok(item.w >= right - left - 2.5, `${at}: shrunk to ${item.h.toFixed(1)} pt, ${item.w.toFixed(1)} pt wide in a ${(right - left).toFixed(1)} pt column`);
        }
      }
    }
  });

  it('a title that fits keeps its size (guard)', async () => {
    for (const delta of [0, 3]) {
      for (const marginH of [18, 40]) {
        const [page] = await read(await render(resume({
          template: 'sidebar',
          settings: { marginH, fontSizeEntryDelta: delta },
          personal: { name: 'Alexandra Johnson', title: 'Senior Software Engineer' },
        })));
        const item = run(page, 'Senior');
        assert.ok(item, `${delta}, ${marginH} mm: the title printed`);
        assert.ok(Math.abs(item.h - (11 + delta)) < 0.5, `${delta}, ${marginH} mm: printed at ${item.h.toFixed(1)} pt`);
      }
    }
  });
});

describe('Sidebar: a contact value wider than the dark column', () => {
  const MAIL = 'alexandra.johnson-smith@examplecompany.com'; // 42 characters
  const LINKEDIN = 'linkedin.com/in/alexandra-johnson-smith';   // 39
  const SITE = 'alexandra-johnson-portfolio.dev';                // 31: wider than 103 pt only
  const TOWN = 'Llanfairpwllgwyngyllgogerychwyrndrobwll';        // 39, nowhere to break

  it('breaks inside the column, after / . - _ @ where it has them, and reads as typed', async () => {
    for (const [pageSize, marginH] of PAPERS) {
      const at = `${pageSize} ${marginH} mm`;
      const [page] = await read(await render(resume({
        template: 'sidebar',
        settings: { pageSize, marginH },
        personal: { name: 'Alexandra Johnson', email: MAIL, linkedin: LINKEDIN, website: SITE, location: TOWN, phone: '+1 555 0100' },
      })));
      assert.deepEqual(outside(page, marginH), [], `${at}: outside the column`);
      for (const address of [MAIL, LINKEDIN, SITE, TOWN]) {
        const lines = linesOf(page, address);
        assert.ok(lines.length, `${at}: ${address} does not read as typed: ${JSON.stringify(inColumn(page).map((t) => t.str))}`);
        if (address !== TOWN) {
          const broken = lines.slice(0, -1).filter((t) => !PUNCT.test(t.str)).map((t) => t.str);
          assert.deepEqual(broken, [], `${at}: ${address} broke inside a piece that fits the column`);
        }
      }
      // Each of these is wider than the column, so it had to break (else this proves nothing).
      for (const address of [MAIL, LINKEDIN, TOWN, ...(marginH === 40 ? [SITE] : [])]) {
        assert.ok(linesOf(page, address).length > 1, `${at}: ${address} printed on one line`);
      }
      const urls = page.links.map((l) => l.url);
      assert.ok(urls.includes(`mailto:${MAIL}`) && urls.includes(`https://${LINKEDIN}`), `${at}: links ${urls.join(', ')}`);
    }
  });

  it('a value that fits prints on one line where it always did (guard)', async () => {
    for (const marginH of [18, 40]) {
      const [page] = await read(await render(resume({
        template: 'sidebar',
        settings: { marginH },
        personal: { name: 'Alexandra Johnson', email: 'alex@example.com', phone: '+1 555 0100', location: 'San Francisco, CA' },
      })));
      const label = run(page, 'EMAIL');
      for (const value of ['alex@example.com', '+1 555 0100', 'San Francisco, CA']) {
        const lines = linesOf(page, value);
        assert.equal(lines.length, 1, `${marginH} mm: ${value} on ${lines.length} lines`);
        assert.ok(Math.abs(lines[0].x - label.x) < 0.5 && Math.abs(lines[0].h - 9) < 0.5, `${marginH} mm: ${value} at x ${lines[0].x}, ${lines[0].h} pt`);
      }
    }
  });

  it('a value textkit closes up to fit its line keeps that one line (guard)', async () => {
    // textkit closes up the letters of a line a little wider than its box (11/256 pt a side): the
    // sample résumés' "linkedin.com/in/jordan-rivera-sample" is 156.9 pt at 9 pt in the 153.7 pt
    // box beside an 11 px icon at 18 mm, and has always printed on one line there, 3 pt closer set.
    // At 20 mm (the Minimal sample's margin) it ran 5.9 pt out of its box: that one breaks.
    const value = 'linkedin.com/in/jordan-rivera-sample';
    for (const [marginH, count] of [[18, 1], [20, 2]]) {
      const [page] = await read(await render(resume({
        template: 'sidebar',
        settings: { marginH, iconSize: 11 },
        personal: { name: 'Jordan Rivera', linkedin: value },
      })));
      const lines = linesOf(page, value);
      assert.equal(lines.length, count, `${marginH} mm: ${value} on ${lines.length} lines: ${JSON.stringify(inColumn(page).map((t) => t.str))}`);
      assert.deepEqual(outside(page, marginH), [], `${marginH} mm: outside the column`);
    }
  });
});

describe('Sidebar: an e-mail or URL in a dark-column section', () => {
  const MAIL = 'jane.doe-longname@referencecompany.com';           // 38 characters
  const CREDENTIAL = 'credentials.example.org/verify/abc-def-ghi';   // 42

  it("a reference's e-mail and a certificate's link break inside the column and read as typed", async () => {
    for (const [pageSize, marginH] of PAPERS) {
      const at = `${pageSize} ${marginH} mm`;
      const [page] = await read(await render(resume({
        template: 'sidebar',
        settings: { pageSize, marginH },
        personal: { name: 'Alexandra Johnson', title: 'Engineer' },
        sections: [
          section('references', [{ name: 'Jane Doe', email: MAIL, phone: '+1 555 0101' }]),
          section('certifications', [{ name: 'AWS Developer', url: CREDENTIAL }]),
        ],
      })));
      assert.deepEqual(outside(page, marginH), [], `${at}: outside the column`);
      for (const address of [MAIL, CREDENTIAL]) {
        const lines = linesOf(page, address);
        assert.ok(lines.length > 1, `${at}: ${address} → ${JSON.stringify(inColumn(page).map((t) => t.str))}`);
        const broken = lines.slice(0, -1).filter((t) => !PUNCT.test(t.str)).map((t) => t.str);
        assert.deepEqual(broken, [], `${at}: ${address} broke inside a piece that fits the column`);
      }
      const urls = page.links.map((l) => l.url);
      assert.ok(urls.includes(`mailto:${MAIL}`) && urls.includes(`https://${CREDENTIAL}`), `${at}: links ${urls.join(', ')}`);
    }
  });
});

describe('Sidebar: skills category wider than the column (NB-3-NB1-NB2)', () => {
  it('Inline and Bullet: no stray hyphen and colon is on the same line as the category', async () => {
    for (const skillsStyle of ['inline', 'bullet']) {
      const [page] = await read(await render(resume({
        template: 'sidebar',
        settings: { pageSize: 'A4', marginH: 18 },
        personal: { name: 'Alexandra Johnson' },
        sections: [
          section('skills', [
            { category: 'Programmiersprachenentwicklung', skills: 'Kubernetesadministrationsverfahren, Go' },
          ], { skillsStyle }),
        ],
      })));
      const items = page.items.filter((t) => t.str.includes('PROGRAMMIER') || t.str.includes(':'));
      for (const item of items) {
        assert.ok(!item.str.includes('-'), `${skillsStyle}: no stray hyphen in category or separator (${item.str})`);
      }
      const catItem = items.find((t) => t.str.includes('PROGRAMMIER'));
      const colonItem = items.find((t) => t.str.includes(':'));
      assert.ok(catItem && colonItem, `${skillsStyle}: found category and colon`);
      assert.equal(catItem.y, colonItem.y, `${skillsStyle}: colon must be on the same line as the category end`);
    }
  });
});

