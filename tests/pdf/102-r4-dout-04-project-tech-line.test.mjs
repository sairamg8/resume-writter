// R4-DOUT-04: the Word export printed a project's technologies and link on its name's line after a
// " · " (" · Reactx · github.example/me/tidepool<TAB>2021" when the name was empty), where the PDF
// (PdfSectionsTwo's ProjectsSection) prints the name alone with the date and the technologies and link
// on the line under it, a " · " only between the two. Word now prints them as the PDF does: the name
// and the date on the title line, "Reactx · link" (or either alone) after a line break under it, and
// no run that opens with " · ". Fictional data only.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, renderDocx } from './harness.mjs';

before(setup);
after(teardown);

const URL = 'github.example/me/tidepool';
const docOf = (item, settings = {}) => renderDocx(resume({ sections: [section('projects', [{ startDate: '2021', ...item }], settings)] }));
/** The lines (split at its line breaks) of the paragraph holding `word`. */
const linesWith = (doc, word) => {
  const p = doc.paragraphs.find((q) => q.text.includes(word));
  assert.ok(p, `"${word}" printed: ${JSON.stringify(doc.texts)}`);
  return p.text.split('\n');
};
/**
 * No printed line opens with the separator (a run may: the " · " between the technologies and the
 * link, and the centred "Title · date" dot, R4-DOUT-03).
 */
const noLeadingSeparator = (doc) => assert.ok(!doc.texts.some((t) => t.split('\n').some((l) => /^\s*·/.test(l))), `a line opens with " · ": ${JSON.stringify(doc.texts)}`);

describe('Word: a project prints its technologies and link on the line under its name, as the PDF does', () => {
  it('the name alone with the date, then "technologies · link"', async () => {
    const doc = await docOf({ name: 'Tidepool', technologies: 'Reactx', url: URL });
    const lines = linesWith(doc, 'Tidepool');
    assert.equal(lines.length, 2, JSON.stringify(lines));
    assert.ok(lines[0].startsWith('Tidepool\t') && lines[0].includes('2021') && !lines[0].includes('Reactx'), JSON.stringify(lines));
    assert.equal(lines[1], `Reactx · ${URL}`);
    assert.ok(doc.links.some((l) => l && l.includes(URL)), 'the link is still a link');
    noLeadingSeparator(doc);
  });

  it('only one of the two: printed alone on the line under the name, with no separator', async () => {
    const link = await docOf({ name: 'Tidepool', url: URL });
    assert.equal(linesWith(link, 'Tidepool')[1], URL);
    noLeadingSeparator(link);
    const tech = await docOf({ name: 'Tidepool', technologies: 'Reactx' });
    assert.deepEqual(linesWith(tech, 'Tidepool').slice(1), ['Reactx']);
    noLeadingSeparator(tech);
  });

  it('without a name: the date alone on its line, the technologies and link under it, no leading " · "', async () => {
    const doc = await docOf({ name: '', technologies: 'Reactx', url: URL });
    const lines = linesWith(doc, 'Reactx');
    assert.equal(lines.length, 2, JSON.stringify(lines));
    assert.ok(lines[0].startsWith('\t') && lines[0].includes('2021'), JSON.stringify(lines));
    assert.equal(lines[1], `Reactx · ${URL}`);
    noLeadingSeparator(doc);
  });

  it('centred: "Name · date" (the PDF\'s CentredLine, R4-DOUT-03), then the technologies and link on a line of their own', async () => {
    const doc = await docOf({ name: 'Tidepool', technologies: 'Reactx', url: URL }, { alignment: 'center' });
    const lines = linesWith(doc, 'Tidepool');
    assert.equal(lines.length, 2, JSON.stringify(lines));
    assert.ok(lines[0].startsWith('Tidepool · ') && lines[0].includes('2021'), JSON.stringify(lines));
    assert.equal(lines[1], `Reactx · ${URL}`);
    assert.ok(!lines.some((l) => /^\s*·/.test(l)), JSON.stringify(lines));
  });
});
