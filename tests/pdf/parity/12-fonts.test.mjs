// Parity matrix: every template × every Font Family the Design panel offers — each prints the whole
// résumé in its own face (registry-design.mjs). The faces come from the CDN stand-in (fake-fontsource.mjs).
import { after, before } from 'node:test';
import { parityFamily } from './run.mjs';
import { fakeFontsource } from '../fake-fontsource.mjs';

// The faces come from the CDN stand-in (../fake-fontsource.mjs), never the network: a URL it does not know, or a
// connection beyond this machine, fails the run after it.
let cdn;
before(() => { cdn = fakeFontsource(); });
after(() => { cdn?.restore(); cdn?.assertClean(); });

await parityFamily(['fonts']);
