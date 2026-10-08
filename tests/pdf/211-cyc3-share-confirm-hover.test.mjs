// The share dialog's Publish / Update and "Yes, unpublish" buttons: a hover class equal to the base class gave a mouse
// user no feedback on the confirm step of an irreversible action. They darken (brand-pressed) or fade (the kit's danger
// Button), as the kit does. Source pin.
import { it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../../src/components/ShareLinkModal.jsx', import.meta.url), 'utf8');
const classOf = (handler) => src.match(new RegExp(`onClick=\\{${handler}\\}[^>]*className="([^"]*)"`))[1].split(/\s+/);

for (const [handler, base] of [['publish', 'bg-cv-brand'], ['unpublish', 'bg-cv-bad']]) {
  it(`${handler}: the hover class is not the base class`, () => {
    const classes = classOf(handler);
    assert.ok(classes.includes(base), 'has its base fill');
    assert.ok(!classes.includes(`hover:${base}`), 'hover is not the base fill');
    assert.ok(classes.some((c) => c.startsWith('hover:') && c !== `hover:${base}`), 'it has a hover class');
  });
}
