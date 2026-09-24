// Parity matrix: every template × every Font Family the Design panel offers — each prints the whole
// résumé in its own face (registry-design.mjs). The faces come from jsDelivr (Fontsource), as in the
// app; offline they cannot load and these skip (Noto Sans, the default, is offline-safe: 05-fonts).
import { parityFamily } from './run.mjs';

let online = null;
const isOnline = async () => {
  if (online === null) online = await fetch('https://cdn.jsdelivr.net/npm/@fontsource/inter@5/metadata.json', { signal: AbortSignal.timeout(5000) }).then((r) => r.ok, () => false);
  return online;
};

await parityFamily(['fonts'], { skip: async () => (await isOnline() ? null : 'offline: the fonts come from jsDelivr') });
