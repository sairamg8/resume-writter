// R2-133 (the audit's first leftover): every dashboard card drew the same mock résumé. The thumbnail
// took only the accent colour, and every way of making a résumé stores the same one (#374151), so
// Classic, Modern, Sidebar … were pixel-identical. It now draws the template's own layout — Modern's
// accent band, the Sidebar's column in its colour, Timeline's line, a centred header — and the photo
// when the résumé shows one.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { setup, teardown, loadModule, TEMPLATES } from './harness.mjs';
import { PNG_2X2 as PNG } from './extractors.mjs';

before(setup);
after(teardown);

const SAME_ACCENT = { accentColor: '#374151' };
async function thumbnail(template, { settings = SAME_ACCENT, personal = {} } = {}) {
  const { ResumeCard } = await loadModule('/src/components/ResumeCard.jsx');
  const html = renderToString(createElement(ResumeCard, {
    resume: { id: 'r1', name: 'Mine', template, updatedAt: 0, settings, personal },
    onOpen() {}, onDuplicate() {}, onDelete() {}, onRename() {},
  }));
  // The thumbnail is everything before the card's name.
  return html.slice(0, html.indexOf('>Mine<'));
}

describe('dashboard thumbnails (R2-133)', () => {
  it('each template draws its own thumbnail, with the same accent', async () => {
    const seen = new Map();
    for (const template of TEMPLATES) {
      const t = await thumbnail(template);
      assert.ok(!seen.has(t), `${template} draws the same thumbnail as ${seen.get(t)}`);
      seen.set(t, template);
    }
  });

  it('the Sidebar\'s column takes its colour; Modern\'s band takes the accent', async () => {
    assert.match(await thumbnail('sidebar', { settings: { ...SAME_ACCENT, sidebarBg: '#7c2d12' } }), /#7c2d12/);
    assert.match(await thumbnail('modern', { settings: { accentColor: '#0f766e' } }), /background-color:#0f766e/);
  });

  it('a centred header draws centred; a shown photo draws, a hidden one does not', async () => {
    assert.notEqual(await thumbnail('classic', { settings: { ...SAME_ACCENT, headerAlign: 'center' } }), await thumbnail('classic'));
    const shown = await thumbnail('classic', { personal: { photo: PNG } });
    const hidden = await thumbnail('classic', { personal: { photo: PNG, hiddenFields: ['photo'] } });
    assert.match(shown, /data-thumb-photo/);
    assert.doesNotMatch(hidden, /data-thumb-photo/);
    assert.equal(hidden, await thumbnail('classic'));
  });

  it('an old résumé with no settings, or a template the app does not offer, still draws (as Classic)', async () => {
    assert.equal(await thumbnail('fancy'), await thumbnail('classic'));
    assert.ok((await thumbnail('modern', { settings: undefined })).length > 100);
  });
});
