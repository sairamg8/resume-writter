// Parity matrix (how it works: matrix.mjs): every template × every control of the 'lists' family the
// editor offers on it — Design → Lists' Bullet style (R2-147) at every value it offers, and its ↺ —
// each changes the PDF (= the preview) as registry-design.mjs says, loses no text and overlaps
// nothing. Circle's ◦ is in no Latin face: its symbol font comes from jsDelivr, as in the app, so
// offline these skip.
import { parityFamily } from './run.mjs';

let online = null;
const isOnline = async () => {
  if (online === null) online = await fetch('https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-symbols-2@5/metadata.json', { signal: AbortSignal.timeout(5000) }).then((r) => r.ok, () => false);
  return online;
};

await parityFamily(['lists'], { skip: async () => (await isOnline() ? null : 'offline: Circle\'s glyph comes from jsDelivr') });
