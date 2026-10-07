// Parity matrix (how it works: matrix.mjs): every template × every control of the 'lists' family the
// editor offers on it — Design → Lists' Bullet style (R2-147) at every value it offers, and its ↺ —
// each changes the PDF (= the preview) as registry-design.mjs says, loses no text and overlaps
// nothing. Circle's ◦ is in no Latin face: its symbol font comes from the CDN stand-in, as it does from jsDelivr
// in the app.
import { after, before } from 'node:test';
import { parityFamily } from './run.mjs';
import { fakeFontsource } from '../fake-fontsource.mjs';

// The faces come from the CDN stand-in (../fake-fontsource.mjs), never the network: a URL it does not know, or a
// connection beyond this machine, fails the run after it.
let cdn;
before(() => { cdn = fakeFontsource(); });
after(() => { cdn?.restore(); cdn?.assertClean(); });

await parityFamily(['lists']);
