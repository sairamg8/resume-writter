// R5-HUNT12-VANITY-PHONE-TEL-LINK-DROPS-LETTERS: a vanity phone number such as "1-800-FLOWERS" linked to
// tel:1800 (contactHref kept the digits of the field and dropped every letter), so a tap on the PDF's,
// the Word file's or the Markdown's phone dialled a wrong number; "800 555 CALL" linked to tel:800555,
// "1-800-FLOWERS ext. 12" glued its extension on (tel:180012) and "1-800-FLOWERS / 1-800-GO-FEDEX"
// glued its second number on (tel:18001800). The same link also had no test for being a phone at all:
// any text with three digits linked ("Room 101" → tel:101, "Available 24/7" → tel:247) and a 20-digit
// paste linked whole. Now a vanity number dials its letters' keypad digits (ABC 2, DEF 3, GHI 4, JKL 5,
// MNO 6, PQRS 7, TUV 8, WXYZ 9), and a value that is not seven to fifteen digits links nowhere (the
// window the import and the ATS check use). The text prints as typed in every export.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contactHref, contactItems } from '../../src/utils/contacts.js';
import { generateMarkdownResume } from '../../src/utils/markdownExport.js';
import { generateAtsPlainText } from '../../src/utils/atsChecker.js';
import { cpwtResumeToJsonResume } from '../../src/utils/jsonResume.js';

const tel = (phone) => contactHref('phone', { phone });
const table = (rows) => { for (const [phone, href] of rows) assert.equal(tel(phone), href, JSON.stringify(phone)); };

test('a vanity number dials its letters as keypad digits', () => {
  table([
    ['1-800-FLOWERS', 'tel:18003569377'],
    ['1-800-GO-FEDEX', 'tel:18004633339'],
    ['800 555 CALL', 'tel:8005552255'],
    ['(800) FLOWERS', 'tel:8003569377'],
    ['1 (800) FLOWERS', 'tel:18003569377'],
    ['1800 FLOWERS', 'tel:18003569377'],
    ['0800 FLOWERS', 'tel:08003569377'],
    ['855-GOT-JUNK', 'tel:8554685865'],
    ['555-CALL', 'tel:5552255'],
    ['1-800-FEDEX', 'tel:180033339'],
    ['1-800-FLOWERS-NOW', 'tel:18003569377669'],
  ]);
});

test('a vanity number reads in any case, with any separator, and keeps a digit typed in its word', () => {
  table([
    ['1-800-flowers', 'tel:18003569377'],
    ['1-800-Flowers', 'tel:18003569377'],
    ['1.800.FLOWERS', 'tel:18003569377'],
    ['1–800–FLOWERS', 'tel:18003569377'], // en dashes
    ['1-800-FLOWER5', 'tel:18003569375'],
    ['  1-800-FLOWERS  ', 'tel:18003569377'],
    ['1-800-FLOWERS.', 'tel:18003569377'],
  ]);
});

test('a vanity number whose digits are seven already is one when a hyphen joins a last group of three', () => {
  table([
    ['1-800-356-WORD', 'tel:18003569673'],
    ['1-800-555-HELP', 'tel:18005554357'],
  ]);
});

test('a country code and a bracketed trunk zero come before the letters', () => {
  table([
    ['+1 800 FLOWERS', 'tel:+18003569377'],
    ['+1-800-FLOWERS', 'tel:+18003569377'],
    ['+44 (0) 800 FLOWERS', 'tel:+448003569377'],
    ['+44 800 FLOWERS', 'tel:+448003569377'],
  ]);
});

test('a word before the number or in brackets after it is a label, so a vanity number still links', () => {
  table([
    ['Phone: 1-800-FLOWERS', 'tel:18003569377'],
    ['Tel: 1-800-FLOWERS', 'tel:18003569377'],
    ['Call 1-800-FLOWERS', 'tel:18003569377'],
    ['1-800-FLOWERS (toll free)', 'tel:18003569377'],
    ['1 800 356 9377 (FLOWERS)', 'tel:18003569377'],
  ]);
});

test('the extension of a vanity number rides as ;ext=, not glued on', () => {
  table([
    ['1-800-FLOWERS ext. 12', 'tel:18003569377;ext=12'],
    ['1-800-FLOWERS extension 12', 'tel:18003569377;ext=12'],
    ['1-800-FLOWERS x12', 'tel:18003569377;ext=12'],
    ['1-800-FLOWERS #12', 'tel:18003569377;ext=12'],
    ['1-800-FLOWERS (ext 12)', 'tel:18003569377;ext=12'],
    ['1-800-FLOWERS, ext. 12', 'tel:18003569377;ext=12'],
    ['800 555 CALL x5', 'tel:8005552255;ext=5'],
    ['1-800-FEDEX x 5', 'tel:180033339;ext=5'], // the X of FEDEX is a letter; the one after the space is the marker
    ['(800) FLOWERS ext. 5', 'tel:8003569377;ext=5'],
  ]);
});

test('of two numbers, a vanity first number is the one dialled', () => {
  table([
    ['1-800-FLOWERS / 1-800-GO-FEDEX', 'tel:18003569377'],
    ['1-800-FLOWERS or 1-800-GO-FEDEX', 'tel:18003569377'],
    ['1-800-FLOWERS ext 12 / 1-800-GO-FEDEX', 'tel:18003569377;ext=12'],
    ['1-800-FLOWERS or text 55555', 'tel:18003569377'],
    ['+91 98765 43210 / 1-800-FLOWERS', 'tel:+919876543210'],
  ]);
});

test('a word after a full number stays a label, and the rules before it hold', () => {
  table([
    ['Phone: 555-0100', 'tel:5550100'],
    ['Call 5551234567', 'tel:5551234567'],
    ['Phone # 555-0100', 'tel:5550100'],
    ['Phone # 555-0100 x5', 'tel:5550100;ext=5'],
    ['555-0100 home', 'tel:5550100'],
    ['555-0100 cell', 'tel:5550100'],
    ['555-0100-home', 'tel:5550100'],
    ['555-0100 - home', 'tel:5550100'],
    ['+1 555 123 4567 mobile', 'tel:+15551234567'],
    ['+1 (555) 010-0000 (mobile)', 'tel:+15550100000'],
    ['+1-555-010-0000-mobile', 'tel:+15550100000'],
    ['(555) 123-4567 Mobile, ext 5', 'tel:5551234567;ext=5'],
    ['+1 (555) 123-4567 ext. 890', 'tel:+15551234567;ext=890'],
    ['555-123-4567x890', 'tel:5551234567;ext=890'],
    ['+44 (0) 20 7946 0958', 'tel:+442079460958'],
    ['(0) 20 7946 0958', 'tel:02079460958'],
    ['030/12345678', 'tel:03012345678'],
    ['+91 98765 43210 / +91 91234 56789', 'tel:+919876543210'],
    ['555 0100 or 555 0101', 'tel:5550100'],
    ['+34 (91) 555 0142', 'tel:+34915550142'],
    ['+1 555 0100', 'tel:+15550100'],
  ]);
});

// A space between the digits and the word is not told from a label: "555 0100 HOME" is one, "1 800 555
// HELP" the other, and a guess would dial a wrong number silently. Both keep what they linked to before
// (the digits alone), so nothing that linked correctly stops doing so.
test('seven digits then a space-set-off word are read as a number and its label', () => {
  table([
    ['555 0100 HOME', 'tel:5550100'],
    ['1 800 555 HELP', 'tel:1800555'],
    ['0800 123 FLOWERS', 'tel:0800123'],
  ]);
});

test('text that is no phone links nowhere', () => {
  table([
    ['On request', null],
    ['Available on request', null],
    ['John Smith', null],
    ['N/A', null],
    ['TBD', null],
    ['Call me', null],
    ['FLOWERS', null],
    ['2 Fast 2 Furious', null],
    ['Room 101 Building', null],
    ['007 James Bond', null],
    ['22 FLOWERS', null],
    ['1-800-F L O W E R S', null],
    ['1-800-FEDEX 12', null],
    ['1-800-FLOWERS toll free', null],
  ]);
});

test('a number under seven digits links nowhere', () => {
  table([
    ['1', null],
    ['12', null],
    ['123', null],
    ['555', null],
    ['123-456', null],
    ['Room 101', null],
    ['Agent 007', null],
    ['ext. 4455', null],
    ['x123', null],
    ['abc123', null],
    ['Available 24/7', null],
  ]);
});

test('a number over fifteen digits, or two typed with no separator, links nowhere', () => {
  table([
    ['12345678901234567890', null],
    ['+1234567890123456789', null],
    ['5551234567 5551234568', null],
    ['1-800-FLOWERS-NOW-1234', null],
    ['+123456789012345', 'tel:+123456789012345'], // fifteen is the longest number there is
  ]);
});

test('the printed phone is exactly what was typed, and the Markdown links the keypad digits', () => {
  const personal = { name: 'Jane', phone: '1-800-FLOWERS' };
  assert.deepEqual(contactItems(personal).map(({ value, href }) => [value, href]), [['1-800-FLOWERS', 'tel:18003569377']]);
  const md = generateMarkdownResume({ personal, settings: {}, sections: [] });
  assert.ok(md.includes('[1-800-FLOWERS](tel:18003569377)'), md);
  const room = generateMarkdownResume({ personal: { name: 'Jane', phone: 'Room 101' }, settings: {}, sections: [] });
  assert.ok(room.includes('Room 101') && !room.includes('tel:'), room);
});

test('the JSON Resume and the ATS text print the typed phone, with no link', () => {
  const personal = { name: 'Jane', title: 'Engineer', summary: '', hiddenFields: [], phone: '1-800-FLOWERS' };
  const resume = { id: 'r5h12v', name: 'Sample', template: 'classic', settings: {}, personal, sections: [] };
  assert.equal(cpwtResumeToJsonResume(resume).basics.phone, '1-800-FLOWERS');
  assert.ok(generateAtsPlainText(resume).includes('1-800-FLOWERS'));
});

// The link is worked out on every render for every phone, and a paste can be long: the value is read
// whole by patterns that took time squared in its length (the extension's, 445 ms on 20 000 characters).
test('a long value is read in no time', () => {
  const LIMIT_MS = 100;
  for (const phone of ['1'.repeat(60_000) + '!', '1 '.repeat(30_000) + '!', '('.repeat(60_000), '1' + ' '.repeat(60_000) + '!', '1a'.repeat(30_000)]) {
    const start = performance.now();
    assert.equal(tel(phone), null, phone.slice(0, 8));
    const ms = performance.now() - start;
    assert.ok(ms < LIMIT_MS, `contactHref took ${ms.toFixed(0)} ms on ${phone.length} characters`);
  }
});
