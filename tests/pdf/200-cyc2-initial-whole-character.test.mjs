// Content hunt (cycle 2): the first letter of a name is a whole character, not half of one. Three places took
// it with an index into the string: the account avatar (displayName[0]), the Career History panel's avatar
// ((name)[0]) and the cut of a long held résumé's name in the sync tip (name.slice(0, 31)). A name that opens
// with an emoji (a UTF-16 pair) drew half of it, a lone surrogate the browser shows as a box, and a name that
// opens with a space drew a blank avatar. They now take the first code point of the trimmed name, as the
// project and sidebar avatars already do. fake-dom has no layout: the markup is rendered and read.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { setup, teardown, loadModule, resume } from './harness.mjs';

before(setup);
after(teardown);

const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
const user = { uid: 'u1', displayName: 'Alex Johnson', email: 'alex@example.com', photoURL: null };

it('the account avatar shows a whole emoji, skips leading spaces, and falls back to U', async () => {
  const { default: AuthBar } = await loadModule('/src/components/AuthBar.jsx');
  const html = (displayName) => renderToStaticMarkup(createElement(AuthBar, { user: { ...user, displayName }, cloudAvailable: true, signOut() {}, isOnline: true }));
  assert.match(html('🙂 Sam Rivera'), />🙂<\/div>/, 'the whole emoji');
  assert.match(html('   Sam Rivera'), />S<\/div>/, 'leading spaces are not the initial');
  assert.match(html('   '), />U<\/div>/, 'only spaces: the nameless U');
  assert.match(html('Alex Johnson'), />A<\/div>/);
});

it('the Career History avatar shows a whole emoji and not a blank for a name with leading spaces', async () => {
  const { CareerHistoryPanel } = await loadModule('/src/components/CareerHistoryPanel.jsx');
  const html = (name) => {
    const cv = Object.assign(resume({ personal: { name, title: 'Engineer' } }), { name: 'CV', updatedAt: 1000 });
    return renderToStaticMarkup(createElement(MemoryRouter, null, createElement(CareerHistoryPanel, { resumes: [cv], activeId: cv.id })));
  };
  assert.match(html('🙂 Sam Rivera'), />🙂<\/div>/);
  assert.doesNotMatch(html('🙂 Sam Rivera'), LONE_SURROGATE);
  assert.match(html('  sam rivera'), />S<\/div>/, 'the first letter, upper-cased, after the spaces');
  assert.match(html(''), />\?<\/div>/);
});

it('a long held name is cut by whole characters in the sync tip', async () => {
  const { clip } = await loadModule('/src/components/AuthBar.jsx');
  const name = `${'a'.repeat(30)}🙂${'b'.repeat(10)}`;
  const cut = clip(name);
  assert.doesNotMatch(cut, LONE_SURROGATE, 'no half emoji at the cut');
  assert.equal(cut, `${'a'.repeat(30)}🙂…`);
  assert.equal(clip('short'), 'short');
  assert.equal(clip('x'.repeat(32)), 'x'.repeat(32));
  const dot = fs.readFileSync(new URL('../../src/components/shell/CollectionSyncDot.jsx', import.meta.url), 'utf8');
  assert.match(dot, /import \{ SyncDot, clip \} from '\.\.\/AuthBar\.jsx'/, 'the workspace icon cuts names the same way');
});
