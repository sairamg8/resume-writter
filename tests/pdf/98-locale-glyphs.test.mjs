// A résumé's text reads back as typed in every language (R2-148). fontkit keeps one glyph object per glyph
// id, holding the characters of its FIRST request, and the PDF's ToUnicode entry is written from them. Two
// characters one glyph draws then read as the first one asked for: Source Serif 4 (Academic) draws the
// apostrophe ’ (U+2019) and ʼ (U+02BC) alike, and the cache, seeded in code-point order, gave French
// "Aujourd’hui" a ʼ; IBM Plex Sans Arabic draws Arabic kaf (ك) and Persian keheh (ک) alike where they
// join the next letter, so after an Arabic résumé a Persian one read "اكنون" for "اکنون".
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, render, read, allText } from './harness.mjs';

before(setup);
after(teardown);

const job = () => section('experience', [{ company: 'Initech', role: 'Lead', startDate: '01/2021', current: true }]);
const codes = (s) => [...s].map((c) => `U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`).join(' ');
const around = (text, at, n = 12) => (at < 0 ? text.slice(0, 80) : text.slice(Math.max(0, at - 2), at + n));

it('Academic (Source Serif 4): French "Aujourd’hui" reads with its ’ (U+2019)', async () => {
  const text = allText(await read(await render(resume({ template: 'academic', settings: { language: 'fr' }, sections: [job()] }))));
  assert.ok(text.includes('Aujourd’hui'), `read: ${codes(around(text, text.search(/aujourd/i)))}`);
});

it('a Persian name with keheh (ک) reads as typed after an Arabic one with kaf (ك) printed the same bold glyph', async () => {
  await render(resume({ settings: { language: 'ar' }, personal: { name: 'كنان' }, sections: [job()] }));
  const text = allText(await read(await render(resume({ settings: { language: 'fa' }, personal: { name: 'کنان' }, sections: [job()] }))));
  assert.ok(text.includes('کنان'), `read: ${codes(text.slice(0, 40))}`);
});

it('Timeline: Persian "اکنون" in its bold date line reads as typed, after an Arabic résumé', async () => {
  await render(resume({ template: 'timeline', settings: { language: 'ar' }, personal: { name: 'كنان' }, sections: [job()] }));
  const text = allText(await read(await render(resume({ template: 'timeline', settings: { language: 'fa' }, sections: [job()] }))));
  assert.ok(text.includes('اکنون'), `read: ${codes(text)}`);
});
