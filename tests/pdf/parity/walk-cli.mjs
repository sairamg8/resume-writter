// The walker's own process (walk-cache.mjs starts it): React's production build, which mounts the
// panels ~4× faster than the development build the PDF tests load, and writes { variants, walks }
// as JSON to argv[2]. The panels behave the same in both builds; only React's dev checks differ.
process.env.NODE_ENV = 'production';
const fs = await import('node:fs');
const { setup, teardown } = await import('../harness.mjs');
const { walkAll } = await import('./panels.mjs');
const out = process.argv[2];
await setup();
const quiet = console.error;
console.error = () => {}; // React's DOM-nesting warnings for the panels' own markup
try {
  const result = await walkAll();
  fs.writeFileSync(`${out}.${process.pid}`, JSON.stringify(result));
  fs.renameSync(`${out}.${process.pid}`, out);
} finally {
  console.error = quiet;
  await teardown();
}
