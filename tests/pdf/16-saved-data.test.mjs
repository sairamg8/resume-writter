// Résumés saved by older builds — in this browser, in the cloud, in an exported .json — are made
// current on the way in (src/utils/normalizeResume.js); these tests check the migrations and
// what the documents print afterwards.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, render, renderCover, read, allText, itemsWith, loadModule, readDocx } from './harness.mjs';
import { drawing, PNG_2X2 as PNG } from './extractors.mjs';

before(setup);
after(teardown);

/** The letter block every résumé created before bf0467f saved: a recipient title nobody typed. */
const OLD_DEFAULT = { recipientName: '', recipientTitle: 'Hiring Manager', company: '', date: '', subject: '' };

/** A résumé as a build before data version 7 saved it: the old letter default, no dataVersion. */
function legacy(coverLetter = {}) {
  const r = resume({ coverLetter: { ...OLD_DEFAULT, body: '<p>Hello</p>', ...coverLetter } });
  delete r.dataVersion;
  return r;
}

const normalizer = () => loadModule('/src/utils/normalizeResume.js');

async function coverDocx(r) {
  const { renderCoverLetterDocx } = await loadModule('/src/utils/wordExport.js');
  return readDocx(new Uint8Array(await (await renderCoverLetterDocx(r)).arrayBuffer()));
}

describe('a letter saved with the old "Hiring Manager" default (R1-0)', () => {
  it('prints no recipient line once it is loaded — not in the PDF, not in Word', async () => {
    const { normalizeResume } = await normalizer();
    const r = normalizeResume(legacy());
    assert.equal(r.coverLetter.recipientTitle, '');
    assert.equal(allText(await read(await renderCover(r))), 'Test Person Engineer Hello Sincerely, Test Person Engineer');
    assert.deepEqual((await coverDocx(r)).texts, ['Test Person', 'Engineer', 'Hello', 'Sincerely,', 'Test Person', 'Engineer']);
  });

  it('keeps the title when the user filled in any other line of the block', async () => {
    const { normalizeResume } = await normalizer();
    for (const key of ['recipientName', 'company', 'subject', 'date']) {
      const r = normalizeResume(legacy({ [key]: 'Globex' }));
      assert.equal(r.coverLetter.recipientTitle, 'Hiring Manager', key);
    }
    const kept = normalizeResume(legacy({ company: 'Globex Corp' }));
    assert.ok(allText(await read(await renderCover(kept))).includes('Hiring Manager Globex Corp'));
    // Blank lines are empty lines: the user filled nothing in.
    assert.equal(normalizeResume(legacy({ date: '  ', subject: '\n' })).coverLetter.recipientTitle, '');
  });

  it('a "Hiring Manager" the user typed after the migration is theirs: it stays and prints', async () => {
    const { normalizeResume, DATA_VERSION } = await normalizer();
    // A résumé created by this build carries the current version, so the migration never runs on it.
    const typed = resume({ coverLetter: { recipientTitle: 'Hiring Manager', body: '<p>Hello</p>' } });
    assert.equal(typed.dataVersion, DATA_VERSION);
    assert.equal(normalizeResume(typed), typed, 'the same object: nothing to change');
    // A migrated letter the user then fills in again is loaded (or synced, or imported) as it is.
    const migrated = normalizeResume(legacy());
    const edited = { ...migrated, coverLetter: { ...migrated.coverLetter, recipientTitle: 'Hiring Manager' } };
    const reloaded = normalizeResume(JSON.parse(JSON.stringify(edited)));
    assert.equal(reloaded.coverLetter.recipientTitle, 'Hiring Manager');
    assert.ok(allText(await read(await renderCover(reloaded))).includes('Hiring Manager'));
  });

  it('is not an edit: the input is not mutated, updatedAt is kept, the rest is untouched', async () => {
    const { normalizeResume, DATA_VERSION } = await normalizer();
    const old = { ...legacy({ closing: 'Best' }), template: 'dark', updatedAt: 5 };
    const before = JSON.parse(JSON.stringify(old));
    const r = normalizeResume(old);
    assert.deepEqual(old, before, 'the input is not mutated');
    assert.deepEqual(r, {
      ...before, template: 'classic', dataVersion: DATA_VERSION,
      coverLetter: { ...before.coverLetter, recipientTitle: '' },
    });
    assert.equal(normalizeResume(r), r, 'a current résumé: the same object');
    // An older résumé with no letter gets no letter; junk passes through.
    const { coverLetter: _letter, ...noLetter } = before;
    assert.ok(!('coverLetter' in normalizeResume(noLetter)));
    for (const v of [null, undefined, 'text', 7]) assert.equal(normalizeResume(v), v);
    assert.equal(normalizeResume({ ...before, dataVersion: 'x' }).coverLetter.recipientTitle, '', 'a junk version is no version');
  });
});

describe('cloud sync merge (R1-0)', () => {
  it('a cloud copy saved by an older build comes in migrated, whichever side wins', async () => {
    const { mergeResumeLists } = await loadModule('/src/utils/syncMerge.js');
    const { normalizeResume, DATA_VERSION } = await normalizer();
    const cloudOnly = { ...legacy(), id: 'cloud_only', updatedAt: 1 };
    const cloudNewer = { ...legacy({ closing: 'Cloud' }), id: 'both', updatedAt: 20 };
    const localOlder = { ...normalizeResume(legacy({ closing: 'Local' })), id: 'both', updatedAt: 10 };
    const gone = { ...legacy(), id: 'gone', updatedAt: 30 };
    const merged = mergeResumeLists([localOlder], [cloudOnly, cloudNewer, gone], new Set(['gone']));
    assert.deepEqual(merged.map((r) => r.id).toSorted(), ['both', 'cloud_only']);
    for (const r of merged) {
      assert.equal(r.coverLetter.recipientTitle, '', r.id);
      assert.equal(r.dataVersion, DATA_VERSION, r.id);
    }
    assert.equal(merged.find((r) => r.id === 'both').coverLetter.closing, 'Cloud', 'the newer copy wins');
    assert.equal(merged.find((r) => r.id === 'both').updatedAt, 20, 'not an edit: updatedAt is kept');

    const tie = mergeResumeLists([{ ...localOlder, updatedAt: 20 }], [cloudNewer], new Set());
    assert.equal(tie[0].coverLetter.closing, 'Local', 'this browser wins a tie');
  });
});

describe('a photo saved in a format the PDF cannot draw (R1-1)', () => {
  const WEBP = 'data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA';
  const PERSONAL = { name: 'Test Person', title: 'Engineer', email: 'me@example.com' };
  const docs = [
    ...['classic', 'modern', 'minimal', 'executive', 'sidebar'].map((t) => [t, (personal) => render(resume({ template: t, personal: { ...PERSONAL, ...personal }, settings: { photoBorder: 'accent' } }))]),
    ['cover letter', (personal) => renderCover(resume({ personal: { ...PERSONAL, ...personal }, settings: { photoBorder: 'accent' }, coverLetter: { body: '<p>Hello</p>' } }))],
  ];
  for (const [name, make] of docs) {
    it(`${name}: a WebP photo prints as no photo — no empty ring, no gap before the name`, async () => {
      const [withWebp, without] = await Promise.all([make({ photo: WEBP }), make({})]);
      const pos = (pages) => itemsWith(pages, 'Test Person').map((t) => [Math.round(t.x), Math.round(t.y)]);
      const [a, b] = [await read(withWebp), await read(without)];
      assert.deepEqual(pos(a), pos(b), 'the name sits where it sits without a photo');
      assert.deepEqual([...a[0].strokes].sort(), [...b[0].strokes].sort(), 'no ring is stroked');
    });
  }
});

describe('a Modern résumé saved before its banner took Photo → Text Position (R7-10)', () => {
  // The push of 0b83cb1, the first deployed build whose Modern banner printed the stored value.
  const LIVE = Date.UTC(2026, 8, 15, 2, 32, 51);
  /** A Modern résumé with a photo as a build saved it: `dataVersion` undefined = none stored. */
  const saved = (photoTextAlign, { dataVersion, updatedAt = LIVE - 60_000, template = 'modern', photoSize = 'md' } = {}) => {
    const r = resume({ template, personal: { photo: PNG, email: 'me@example.com' }, settings: { photoSize, photoTextAlign } });
    if (photoTextAlign === undefined) delete r.settings.photoTextAlign;
    if (dataVersion === undefined) delete r.dataVersion; else r.dataVersion = dataVersion;
    return { ...r, updatedAt };
  };
  // Every build before dff28b7 drew Modern's banner as Top draws it now, whatever was stored
  // (checked on an export of 4bc56fe: same name, contacts and photo positions).
  const asItPrinted = async (r) => drawing(await render({ ...r, settings: { ...r.settings, photoTextAlign: 'top' } }));

  it('prints as it always did — the text at the photo\'s top — once it is loaded', async () => {
    const { normalizeResume } = await normalizer();
    for (const photoSize of ['md', 'lg']) {
      for (const [label, old] of [
        ['the stored default, Center, no version', saved('center', { photoSize })],
        ['no Text Position stored', saved(undefined, { photoSize })],
        ['a value the PDF never knew', saved('middle', { photoSize })],
        ['version 8, last edited before the change went live', saved('center', { dataVersion: 8, photoSize })],
      ]) {
        const r = normalizeResume(old);
        const [now, before] = [await drawing(await render(r)), await asItPrinted(old)];
        assert.ok(now === before, `${photoSize}, ${label}: draws the page it drew before`);
        assert.equal(r.settings.photoTextAlign, 'top', `${photoSize}, ${label}: the panel shows Top`);
      }
      // …which Center really does not draw: the comparison above can fail.
      assert.notEqual(await drawing(await render(saved('center', { photoSize }))), await asItPrinted(saved('center', { photoSize })));
    }
  });

  it('the Cypress fixtures are stamped with this build\'s data version, so no migration runs on them', async () => {
    const { DATA_VERSION } = await normalizer();
    const helpers = await import('../helpers.js');
    assert.equal(helpers.DATA_VERSION, DATA_VERSION, 'tests/helpers.js');
    assert.equal(helpers.buildTestState('modern').resumes[0].dataVersion, DATA_VERSION);
  });

  // Guard: nothing else was ever migrated; the fix is the test above.
  it('keeps a Bottom, any other template, and Center on a résumé edited since it went live', async () => {
    const { normalizeResume } = await normalizer();
    assert.equal(normalizeResume(saved('bottom')).settings.photoTextAlign, 'bottom', 'Bottom: a choice (and one Classic prints)');
    for (const template of ['classic', 'minimal', 'executive', 'sidebar']) {
      assert.equal(normalizeResume(saved('center', { template })).settings.photoTextAlign, 'center', template);
    }
    const seen = saved('center', { dataVersion: 8, updatedAt: LIVE + 60_000 });
    assert.equal(normalizeResume(seen).settings.photoTextAlign, 'center', 'edited while its preview printed Center');
    const migrated = normalizeResume(saved('center'));
    assert.equal(normalizeResume(migrated), migrated, 'it runs once');
    const chosen = { ...migrated, settings: { ...migrated.settings, photoTextAlign: 'center' }, updatedAt: 1 };
    assert.equal(normalizeResume(JSON.parse(JSON.stringify(chosen))).settings.photoTextAlign, 'center', 'a Center chosen afterwards is the user\'s');
  });
});

describe('Between Items saved at the old 12 px default (R2-1)', () => {
  it('becomes 8 px for a résumé saved before data version 8; a value the user chose is kept', async () => {
    const { normalizeResume, DATA_VERSION } = await normalizer();
    const old = (settings, dataVersion) => {
      const r = resume({ settings });
      if (dataVersion === undefined) delete r.dataVersion; else r.dataVersion = dataVersion;
      return r;
    };
    assert.equal(normalizeResume(old({ itemGap: 12 })).settings.itemGap, 8, 'no version: migrated');
    assert.equal(normalizeResume(old({ itemGap: 12 }, 7)).settings.itemGap, 8, 'version 7: migrated');
    assert.equal(normalizeResume(old({ itemGap: 20 })).settings.itemGap, 20, 'a chosen value is kept');
    assert.equal(normalizeResume(old({ itemGap: 0 })).settings.itemGap, 0, 'zero is a chosen value');
    const current = old({ itemGap: 12 }, DATA_VERSION);
    assert.equal(normalizeResume(current), current, '12 px set on this build is the user\'s: untouched');
    // Version 7's letter migration still runs alongside, and only once.
    const both = normalizeResume({ ...old({ itemGap: 12 }), coverLetter: { ...OLD_DEFAULT, body: '<p>Hi</p>' } });
    assert.deepEqual([both.settings.itemGap, both.coverLetter.recipientTitle, both.dataVersion], [8, '', DATA_VERSION]);
    const v7 = normalizeResume({ ...old({ itemGap: 12 }, 7), coverLetter: { ...OLD_DEFAULT, body: '<p>Hi</p>' } });
    assert.equal(v7.coverLetter.recipientTitle, 'Hiring Manager', 'a version-7 letter kept its title: v7 already ran on it');
  });
});
