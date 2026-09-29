// R4-SW-WT-01 (review): the ATS stopped gluing a quote after a list onto the last bullet, but only for
// the HTML as stored. The editor loads every description through sanitizeRichText and saves that on
// the next edit, and sanitizeRichText turned any indented block after a list into a <p> inside the
// last <li> — so one typed character put the quote back into the bullet. The Markdown export printed
// it as that bullet's continuation too. A block outside every list (inList false) now closes the list
// in the sanitizer and prints as its own paragraph in Markdown; a quote inside an item stays in it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractBulletsFromItem } from '../../src/utils/atsChecker.js';
import { sanitizeRichText } from '../../src/utils/richText.js';
import { generateMarkdownResume } from '../../src/utils/markdownExport.js';

const RAW = '<ul><li>Led migration of 40 services</li></ul><blockquote>Quoted by the CTO</blockquote>';

test('the sanitizer keeps a quote after the list out of the last item', () => {
  const clean = sanitizeRichText(RAW);
  assert.equal(clean, '<ul><li>Led migration of 40 services</li></ul><p>Quoted by the CTO</p>');
  assert.deepEqual(extractBulletsFromItem({ description: clean }), ['Led migration of 40 services']);
  assert.equal(sanitizeRichText('<ul><li>A</li></ul><dl><dt>Stack</dt><dd>Go</dd></dl>'), '<ul><li>A</li></ul><p>Stack</p><p>Go</p>');
});

test('a quote inside an item still stays in it', () => {
  assert.equal(sanitizeRichText('<ul><li>Led migration<blockquote>for 3 regions</blockquote></li></ul>'), '<ul><li>Led migration<p>for 3 regions</p></li></ul>');
  assert.equal(sanitizeRichText('<ul><li>A<ul><li>B</li></ul>after</li></ul>'), '<ul><li>A<ul><li>B</li></ul><p>after</p></li></ul>');
});

test('the Markdown export prints a quote after the list as a paragraph of its own', () => {
  const md = generateMarkdownResume({ personal: { name: 'Ada Test', summary: RAW }, sections: [], settings: {} });
  assert.match(md, /- Led migration of 40 services\n\nQuoted by the CTO/);
  assert.doesNotMatch(md, /services {2}\n/);
  const inItem = generateMarkdownResume({ personal: { name: 'Ada Test', summary: '<ul><li>Led migration<blockquote>for 3 regions</blockquote></li></ul>' }, sections: [], settings: {} });
  assert.match(inItem, /- Led migration {2}\n {2}for 3 regions/);
});
