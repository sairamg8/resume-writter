// R4-DVIS-27: from 640 px up, signed out, the Dashboard's toolbar put a 30 px "Sign in with Google"
// button with 12 px text beside 38 px buttons with 14 px text. B2 (UI redesign) restyled the account
// control in the canvas look: the full button and the compact icon button are one height (36 px, h-9)
// with 13 px semibold text and the control radius, so the full button no longer sizes itself by the
// toolbar's py/text classes (the toolbar's Job Tracker and Projects buttons became the bar's nav links).
// What this still pins: the full button carries the label at the canvas size and the compact icon-only
// button of the phone header, the editor and the workspace top bar is the same height and has no label.
// The fake DOM has no layout, so the classes are read from the real component, rendered with
// react-dom/server.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { setup, teardown, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const noop = () => {};

/** The signed-out button's opening tag, as its class tokens, and what it holds. */
function signInButton(AuthBar, compact) {
  const html = renderToStaticMarkup(createElement(AuthBar, {
    user: null, authLoading: false, cloudAvailable: true, signInWithGoogle: noop, signOut: noop, compact,
  }));
  const m = /<button[^>]*data-testid="sign-in-button"[^>]*>([\s\S]*?)<\/button>/.exec(html);
  assert.ok(m, `the sign-in button: ${html}`);
  const tokens = (/class="([^"]*)"/.exec(m[0])?.[1] ?? '').split(/\s+/).filter(Boolean);
  return { tokens, label: m[1].replace(/<[^>]*>/g, '').trim() };
}

it('signed out, the full button is the canvas size with its label; the compact one is the same height, icon only', async () => {
  const { default: AuthBar } = await loadModule('/src/components/AuthBar.jsx');
  const full = signInButton(AuthBar, false);
  assert.equal(full.label, 'Sign in with Google');
  for (const t of ['cv-field', 'h-9', 'text-[13px]', 'font-semibold', 'px-3']) assert.ok(full.tokens.includes(t), `full: ${t} in ${full.tokens.join(' ')}`);
  const compact = signInButton(AuthBar, true);
  assert.equal(compact.label, '', 'the compact button has no label');
  for (const t of ['cv-field', 'h-9', 'w-9']) assert.ok(compact.tokens.includes(t), `compact: ${t} in ${compact.tokens.join(' ')}`);
  for (const t of ['px-3', 'sm:px-4', 'sm:py-2', 'sm:text-sm']) assert.ok(!compact.tokens.includes(t), `the compact button is not resized (${t})`);
});
