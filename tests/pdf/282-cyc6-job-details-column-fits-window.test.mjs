// The Job page's Details column is sticky from lg, 160 px down so that it clears the page header (278). It is about
// 500 px tall and had no height limit: on a short window (a 1280x720 laptop: 720 - 56 top bar - 160 offset = 504 px,
// less the browser's own bars) its last rows (Source, Résumé, Created, Updated) stayed below the fold and could not be
// reached until the page ended. It is now no taller than the room left under the top bar and the header, and scrolls
// inside that. fake-dom has no layout: the classes on the aside are read.
// Run: node --test tests/pdf/282-cyc6-job-details-column-fits-window.test.mjs
import { it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const text = fs.readFileSync(new URL('../../src/pages/JobDetail.jsx', import.meta.url), 'utf8');

it('the sticky Details column is capped to the window under the header and scrolls inside', () => {
  const aside = /<aside aria-label="Job details" className="([^"]*)"/.exec(text);
  assert.ok(aside, 'the Details aside is there');
  const tokens = aside[1].split(/\s+/);
  assert.ok(tokens.includes('lg:sticky'), 'still sticky from lg');
  const cap = tokens.find((t) => t.startsWith('lg:max-h-'));
  assert.ok(cap, `it has a lg:max-h-… cap: ${aside[1]}`);
  // dvh, so a phone-style collapsing address bar does not leave it taller than the visible window.
  assert.match(cap, /100dvh/, `the cap follows the window's height: ${cap}`);
  // 3.5rem top bar + the 10rem (lg:top-40) offset must both come off the window.
  const sub = /-(\d+(?:\.\d+)?)rem\)/.exec(cap);
  assert.ok(sub && Number(sub[1]) >= 13.5, `the cap leaves room for the top bar and the 160 px offset: ${cap}`);
  assert.ok(tokens.includes('lg:overflow-y-auto'), 'and the column scrolls inside the cap');
});
