// Design → Language (R2-148): a résumé's settings.language puts the words the app prints — the month
// names of every date, a current entry's "Present", the section titles it gave (not the ones the user
// renamed), the Sidebar's Contact, About Me and contact labels, and the cover letter's date — in that
// language, in every template's PDF (the preview) and in the Word export. A résumé storing no
// language, as every one saved before the setting, prints the page it always printed. The Design
// panel offers the languages with English selected for such a résumé; its ↺ and the store keep it,
// and Reset Design Settings keeps it too (it is what the résumé is written in, not a look).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, render, renderCover, renderDocx, read, allText, loadModule, TEMPLATES } from './harness.mjs';
import { drawing } from './extractors.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

before(setup);
after(teardown);

/** A current job, a degree, a renamed section and Languages: what the words land on. */
const content = () => [
  section('experience', [{ company: 'Initech', role: 'Lead', startDate: 'Jan 2021', endDate: '', current: true, description: '<p>Built the billing system.</p>' }]),
  section('education', [{ institution: 'State University', degree: 'BSc', startDate: 'Sep 2012', endDate: 'Jun 2016' }]),
  section('projects', [{ name: 'Widget', startDate: 'Mar 2020', endDate: 'Oct 2020' }], {}, { title: 'Side Work' }),
  section('skills', [{ category: 'Languages', skills: 'Go, Rust' }]),
];

const make = (template, settings = {}) => resume({
  template, settings,
  personal: { name: 'Pat Sample', email: 'pat@example.com', phone: '+1 555 0100', summary: '<p>Engineer who ships.</p>' },
  sections: content(),
});

/** German, written out by hand: what each template must print for content() at MMMM YYYY. */
const GERMAN = ['Berufserfahrung', 'Ausbildung', 'Kenntnisse', 'Side Work', 'Januar 2021 – heute', 'September 2012 – Juni 2016', 'März 2020 – Oktober 2020'];
const ENGLISH = ['Professional Experience', 'Education', 'Skills', 'Side Work', 'Present'];

/** The strings in `wants` the text does not hold, any case (a template may print its titles in capitals). */
const missingIn = (text, wants) => wants.filter((w) => !text.toLowerCase().includes(w.toLowerCase()));

describe('the PDF prints the app\'s words in the résumé\'s language', () => {
  for (const template of TEMPLATES) {
    it(`${template}: German titles, months and "heute"; the renamed title as typed; no English left`, async () => {
      const text = allText(await read(await render(make(template, { language: 'de', dateFormat: 'MMMM YYYY' }))));
      assert.deepEqual(missingIn(text, GERMAN), [], text);
      assert.deepEqual(ENGLISH.filter((w) => w !== 'Side Work' && text.toLowerCase().includes(w.toLowerCase())), [], text);
    });
  }

  it('As entered: a month the picker stored ("Jan 2021") prints in the language\'s short words', async () => {
    const text = allText(await read(await render(make('classic', { language: 'es' }))));
    assert.deepEqual(missingIn(text, ['ene 2021 – Actualidad', 'sept 2012 – jun 2016', 'Experiencia profesional', 'Educación', 'Habilidades']), [], text);
  });

  it('the Sidebar\'s own headings and contact labels: Kontakt, Über mich, E-Mail, Telefon', async () => {
    const text = allText(await read(await render(make('sidebar', { language: 'de' }))));
    assert.deepEqual(missingIn(text, ['Kontakt', 'Über mich', 'E-Mail', 'Telefon']), [], text);
    assert.deepEqual(missingIn(text, ['About Me']), ['About Me'], text);
  });

  it('the cover letter\'s date', async () => {
    const r = make('classic', { language: 'fr' });
    r.coverLetter = { ...r.coverLetter, date: '2026-01-15', body: '<p>Hello.</p>' };
    const text = allText(await read(await renderCover(r)));
    assert.ok(text.includes('15 janvier 2026'), text);
  });
});

describe('a résumé storing no language prints what it always printed', () => {
  for (const template of TEMPLATES) {
    it(`${template}: the page of English, and the English words`, async () => {
      const none = await render(make(template));
      assert.equal(await drawing(none), await drawing(await render(make(template, { language: 'en' }))));
      assert.deepEqual(missingIn(allText(await read(none)), ENGLISH), []);
    });
  }

  it('a language this build does not know (a newer build\'s) prints English and stays stored', async () => {
    const r = make('classic', { language: 'xx' });
    assert.equal(await drawing(await render(r)), await drawing(await render(make('classic'))));
    const { normalizeResume } = await loadModule('/src/utils/normalizeResume.js');
    assert.equal(normalizeResume(r).settings.language, 'xx');
  });
});

describe('Word prints the same words', () => {
  it('German titles and dates; the renamed title as typed', async () => {
    const { texts } = await renderDocx(make('classic', { language: 'de', dateFormat: 'MMMM YYYY' }));
    const all = texts.join('\n');
    assert.deepEqual(missingIn(all, ['Berufserfahrung', 'Ausbildung', 'Kenntnisse', 'Side Work', 'Januar 2021 – heute', 'September 2012 – Juni 2016']), [], all);
    assert.ok(!/present|professional experience/i.test(all), all);
  });

  it('the Sidebar\'s About Me', async () => {
    const { texts } = await renderDocx(make('sidebar', { language: 'it' }));
    assert.deepEqual(missingIn(texts.join('\n'), ['Chi sono', 'Esperienza professionale', 'In corso']), [], texts.join('\n'));
  });

  it('no language: the English document', async () => {
    const a = await renderDocx(make('classic'));
    const b = await renderDocx(make('classic', { language: 'en' }));
    assert.deepEqual(a.texts, b.texts);
    assert.deepEqual(missingIn(a.texts.join('\n'), ENGLISH), []);
  });
});

describe('Design → Language', () => {
  /** The Design panel for `r` with Language opened: its select, `pick(value)` and `reset()` (each returns the writes). */
  async function languageRow(r) {
    const { default: DesignPanel } = await loadModule('/src/components/DesignPanel.jsx');
    const writes = [];
    const view = mount(DesignPanel, { resume: r, updateSetting: (key, value) => writes.push([key, value]), setTemplate: () => {}, resetSettings: () => {} });
    const all = () => [...elements(view.container)];
    const heading = all().find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === 'Language');
    assert.ok(heading, 'a Language section in the Design panel');
    view.act(() => reactProps(heading).onClick());
    const label = all().find((el) => el.tagName === 'LABEL' && el.textContent.trim() === 'Résumé language');
    assert.ok(label, 'a "Résumé language" label');
    const select = [...elements(label.parentNode)].find((el) => el.tagName === 'SELECT');
    assert.ok(select, 'its select');
    const reset = all().find((el) => el.tagName === 'BUTTON' && el.getAttribute('title') === 'Reset Language to defaults');
    assert.ok(reset, 'the section\'s ↺');
    const run = (fn) => { writes.length = 0; view.act(fn); return [...writes]; };
    return {
      value: reactProps(select).value,
      options: [...select.options].map((o) => [o.getAttribute('value'), o.textContent.trim()]),
      pick: (value) => run(() => reactProps(select).onChange({ target: { value } })),
      reset: () => run(() => reactProps(reset).onClick({ stopPropagation() {} })),
      unmount: () => view.unmount(),
    };
  }

  it('offers each language by its own name, English selected for a résumé storing none', async () => {
    const row = await languageRow(make('classic'));
    assert.equal(row.value, 'en');
    assert.deepEqual(row.options, [
      ['en', 'English'], ['es', 'Español'], ['fr', 'Français'], ['de', 'Deutsch'], ['pt', 'Português'], ['it', 'Italiano'],
      ['nl', 'Nederlands'], ['ar', 'العربية'], ['he', 'עברית'], ['fa', 'فارسی'], ['ur', 'اردو'],
    ]);
    assert.deepEqual(row.pick('fr'), [['language', 'fr']]);
    assert.deepEqual(row.reset(), [['language', 'en']]);
    await row.unmount();
  });

  it('shows the stored language; an unknown one as English', async () => {
    for (const [stored, shown] of [['nl', 'nl'], ['xx', 'en']]) {
      const row = await languageRow(make('classic', { language: stored }));
      assert.equal(row.value, shown, stored);
      await row.unmount();
    }
  });

  it('Reset Design Settings keeps the language; English is stored as none', async () => {
    const { settingsAfterReset } = await loadModule('/src/utils/defaultData.js');
    const kept = settingsAfterReset(make('modern', { language: 'pt', accentColor: '#ff0000' }));
    assert.equal(kept.language, 'pt');
    assert.notEqual(kept.accentColor, '#ff0000', 'the rest of the design is reset');
    assert.equal('language' in settingsAfterReset(make('modern', { language: 'en' })), false);
    assert.equal('language' in settingsAfterReset(make('modern')), false);
  });
});
