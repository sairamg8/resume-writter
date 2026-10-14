// The PDF import reads a side column's lines as the PDF wrapped them: a line is joined to the one above when it is the
// rest of it (pdfLinesOfPages), but not when it is a field of its own. Three rules decide that in a column, and each
// had a hole:
//  - a bold label and the list after it on one line (the Sidebar template's run-in skills group, "LANGUAGES: Python, …")
//    is two pdf.js items in two fonts. The group's wrapped line is regular, so it looked like "a font change" and the
//    group was cut at its first wrap: 'LANGUAGES: Python, JavaScript,' and an orphan 'TypeScript, Go, SQL'. A label
//    ALONE on its line over its list (a bold degree over its school) is still a new line;
//  - a last wrapped line that is one word with a dot ('Node.js', 'Vue.js', 'ASP.NET', 'B.Sc', '2018-2022') was taken
//    for a web address or a phone number and cut from the list above ('AWS, Docker, Kubernetes, Git,' / 'Node.js').
//    A side column's contacts, one under another, stay one to a line;
//    (a line that begins and ends in one font, a bold word inside a paragraph's first line, is no run-in label: a bold label
//    alone under it is still a new line);
//  - the blank line between two lines that are a little more than a line step apart (a table row's or a paragraph's
//    spacing) carries `loose: true`, which the Word-table import reads; a wider gap is a plain blank line.
// Nothing here opens a browser: the pages are hand-built text items. The time the contact test takes on long lines is
// in tf-redos-import-pdf.unit.mjs.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { pdfLinesOfPages } from '../../src/utils/importFile.js';

const BOLD = 'g_d0_f1';
const REG = 'g_d0_f2';
const texts = (pages) => pdfLinesOfPages(pages).map((l) => l.text).filter(Boolean);

/** One line of text items from `[str, x, w, font]`, all on baseline `y`, 10 pt high. */
const line = (y, ...parts) => parts.map(([str, x, w, font]) => ({ str, x, y, w, h: 10, font }));

// The main column beside the side column: five lines at x 250, none on a baseline of the side column's (they are 6 pt
// off, its lines at 756 − 12k), each ending in a full stop and a line step apart, so none is a wrapped line of another.
const RIGHT_TEXTS = ['Built the billing service.', 'Led a team of six.', 'Cut deploy time by half.', 'Mentored four engineers.', 'Ran the weekly review.'];
const RIGHT = RIGHT_TEXTS.flatMap((str, k) => line(750 - 24 * k, [str, 250, 200, REG]));

/**
 * A page in two columns: the side column's lines `left` (each from `line`), then the main one. The gutter between x 190 and
 * x 250 is empty, each side has three lines or more one after another and none shared, so the page is read a column at a
 * time, the side column first (pdfPageBlocks). The side column holds fewer than eight items, so it is not split again.
 */
const page = (...left) => [...left.flat(), ...RIGHT];

describe('a run-in label and its list, wrapped in a column', () => {
  test('a bold label and its list on one line, the list wrapped, is one line', () => {
    const items = page(
      line(756, ['SKILLS', 40, 40, BOLD]),
      line(732, ['LANGUAGES:', 40, 60, BOLD], ['Python, JavaScript,', 103, 87, REG]),
      line(720, ['TypeScript, Go, SQL', 40, 80, REG]),
    );
    assert.deepEqual(texts([items]), ['SKILLS', 'LANGUAGES: Python, JavaScript, TypeScript, Go, SQL', ...RIGHT_TEXTS],
      'before: "LANGUAGES: Python, JavaScript," and "TypeScript, Go, SQL" apart');
  });

  test('a list wrapped twice is joined to its end', () => {
    const items = page(
      line(756, ['SKILLS', 40, 40, BOLD]),
      line(732, ['LANGUAGES:', 40, 60, BOLD], ['Python, JavaScript,', 103, 87, REG]),
      line(720, ['TypeScript, Go, SQL, Rust,', 40, 150, REG]),
      line(708, ['Kotlin', 40, 40, REG]),
    );
    assert.deepEqual(texts([items]), ['SKILLS', 'LANGUAGES: Python, JavaScript, TypeScript, Go, SQL, Rust, Kotlin', ...RIGHT_TEXTS]);
  });

  test('a bold label alone on its line stays apart from the list under it (and so does a bold degree over its school)', () => {
    const items = page(
      line(756, ['SKILLS', 40, 40, BOLD]),
      line(732, ['Programming Languages', 40, 135, BOLD]),
      line(720, ['Python, JavaScript, Go', 40, 110, REG]),
    );
    assert.deepEqual(texts([items]), ['SKILLS', 'Programming Languages', 'Python, JavaScript, Go', ...RIGHT_TEXTS]);
  });

  // The run-in label is a line that BEGINS in one font and ENDS in the other (a bold label first, the list's font last). An
  // inline bold word in the middle of a paragraph's first line (regular, bold, regular) ends in the font it began in: a bold
  // label alone on the next line still starts a line of its own.
  test('a bold word inside the first line of a paragraph does not join a bold label under it', () => {
    const items = page(
      line(756, ['SKILLS', 40, 40, BOLD]),
      line(732, ['Managed the', 40, 60, REG], ['platform', 103, 40, BOLD], ['and tools', 146, 44, REG]),
      line(720, ['Databases', 40, 50, BOLD]),
      line(708, ['PostgreSQL, Redis', 40, 100, REG]),
    );
    assert.deepEqual(texts([items]), ['SKILLS', 'Managed the platform and tools', 'Databases', 'PostgreSQL, Redis', ...RIGHT_TEXTS],
      'before: "Managed the platform and tools Databases" (the bold word made the first line count as a run-in label)');
  });
});

describe('a list\'s last wrapped line in a column', () => {
  for (const last of ['Node.js', 'Vue.js', 'Next.js', 'ASP.NET', 'B.Sc', '2018-2022']) {
    test(`'${last}' alone under a list that ends in a comma is its end`, () => {
      const items = page(
        line(756, ['TOOLS', 40, 40, BOLD]),
        line(732, ['AWS, Docker, Kubernetes, Git,', 40, 150, REG]),
        line(720, [last, 40, 45, REG]),
      );
      assert.deepEqual(texts([items]), ['TOOLS', `AWS, Docker, Kubernetes, Git, ${last}`, ...RIGHT_TEXTS], `before: '${last}' on a line of its own`);
    });
  }

  test("'Node.js' alone after a line that does not end in a comma is its end too", () => {
    const items = page(
      line(756, ['TOOLS', 40, 40, BOLD]),
      line(732, ['Docker Kubernetes and Git with', 40, 150, REG]),
      line(720, ['Node.js', 40, 45, REG]),
    );
    assert.deepEqual(texts([items]), ['TOOLS', 'Docker Kubernetes and Git with Node.js', ...RIGHT_TEXTS]);
  });

  test("a name shaped like an address ('Socket.io') under a line that ends in a comma or a semicolon is the list going on", () => {
    for (const mark of [',', ';']) {
      const items = page(
        line(756, ['TOOLS', 40, 40, BOLD]),
        line(732, [`AWS${mark} Docker${mark} Kubernetes${mark} Git${mark}`, 40, 150, REG]),
        line(720, ['Socket.io', 40, 45, REG]),
      );
      assert.deepEqual(texts([items]), ['TOOLS', `AWS${mark} Docker${mark} Kubernetes${mark} Git${mark} Socket.io`, ...RIGHT_TEXTS], `after a '${mark}'`);
    }
  });

  test('a paragraph whose last wrapped line is only an address keeps that address on a line of its own (its text is not lost)', () => {
    const items = page(
      line(756, ['LINKS', 40, 40, BOLD]),
      line(732, ['Find my portfolio and the code behind every project at', 40, 150, REG]),
      line(720, ['janedoe.com', 40, 60, REG]),
    );
    assert.deepEqual(texts([items]), ['LINKS', 'Find my portfolio and the code behind every project at', 'janedoe.com', ...RIGHT_TEXTS]);
  });
});

describe('a side column\'s contacts, one under another', () => {
  for (const contact of ['jane.doe@example.com', '+1 (555) 010-1234', 'linkedin.com/in/janedoe', 'github.com/janedoe', 'https://janedoe.dev/cv', 'www.janedoe.com', 'janedoe.com', 'jane.dev']) {
    test(`'${contact}' is a line of its own under a place`, () => {
      const items = page(
        line(756, ['CONTACT', 40, 45, BOLD]),
        line(744, ['San Francisco, CA', 40, 150, REG]),
        line(732, [contact, 40, 100, REG]),
      );
      assert.deepEqual(texts([items]), ['CONTACT', 'San Francisco, CA', contact, ...RIGHT_TEXTS]);
    });
  }
});

describe('a side column\'s contacts with a country\'s ending or a domain of a kind', () => {
  for (const contact of ['janedoe.it', 'jane.pl', 'jane.studio', 'jane.pro']) {
    test(`'${contact}' is a line of its own under a place`, () => {
      const items = page(
        line(756, ['CONTACT', 40, 45, BOLD]),
        line(744, ['Portland, OR', 40, 150, REG]),
        line(732, [contact, 40, 100, REG]),
      );
      assert.deepEqual(texts([items]), ['CONTACT', 'Portland, OR', contact, ...RIGHT_TEXTS], `before: 'Portland, OR ${contact}'`);
    });
  }

  // Not an address: a name with a dot, a degree, an upper-case ending ('ASP.NET'). Each ends the line above, as before.
  for (const last of ['Node.js', 'Vue.js', 'Next.js', 'ASP.NET', 'B.Sc', 'Ph.D']) {
    test(`'${last}' alone under a line that does not end in a comma is its end`, () => {
      const items = page(
        line(756, ['TOOLS', 40, 40, BOLD]),
        line(732, ['Docker Kubernetes and Git with', 40, 150, REG]),
        line(720, [last, 40, 45, REG]),
      );
      assert.deepEqual(texts([items]), ['TOOLS', `Docker Kubernetes and Git with ${last}`, ...RIGHT_TEXTS]);
    });
  }

  // A range of years is no phone number (CONTACT_LINE's lookahead): the wrapped line under a title keeps it.
  test("a range of years ('2018 - 2022') alone under a multi-word line that does not end in a comma is its end", () => {
    const items = page(
      line(756, ['EDUCATION', 40, 60, BOLD]),
      line(732, ['Bachelor of Science in Computer Science', 40, 150, REG]),
      line(720, ['2018 - 2022', 40, 60, REG]),
    );
    assert.deepEqual(texts([items]), ['EDUCATION', 'Bachelor of Science in Computer Science 2018 - 2022', ...RIGHT_TEXTS]);
  });
});

describe('the blank line between two lines that are not one paragraph', () => {
  // Two lines of `h1` and `h2` pt, the second `dy` pt under the first; a line step is the taller one's height.
  const gap = (dy, h1 = 10, h2 = 10) => pdfLinesOfPages([[
    { str: 'Alpha', x: 50, y: 700, w: 40, h: h1 },
    { str: 'Beta', x: 50, y: 700 - dy, w: 40, h: h2 },
  ]]);
  const loose = [{ text: 'Alpha' }, { text: '', loose: true }, { text: 'Beta' }, { text: '' }];
  const plain = [{ text: 'Alpha' }, { text: '' }, { text: 'Beta' }, { text: '' }];

  test('2.5 line steps down is a loose blank line', () => assert.deepEqual(gap(25), loose));
  test('exactly 3.2 line steps down is still loose (the limit is inclusive)', () => assert.deepEqual(gap(32), loose));
  test('just over 3.2 line steps down is a plain blank line', () => assert.deepEqual(gap(33), plain));
  test('4 line steps down is a plain blank line', () => assert.deepEqual(gap(40), plain));
  test('the taller of the two lines sets the step: a heading of 20 pt over a line of 10 pt', () => {
    assert.deepEqual(gap(50, 20, 10), loose, '2.5 of the heading\'s steps');
    assert.deepEqual(gap(66, 20, 10), plain, 'over 3.2 of them');
    assert.deepEqual(gap(50, 10, 20), loose, 'the taller one below');
  });
});
