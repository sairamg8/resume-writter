// R5-HUNT11-WEBSITE-FREEZE-LEAD (the dev server's half): the PDF worker must start on `yarn dev`.
// On the dev server plugin-react wraps every JSX module for React Fast Refresh, and the wrapper starts
// with `import "/@react-refresh"`, whose first statement assigns to `window`. A worker has no `window`,
// so the PDF worker died at load ("window is not defined"), pdfBuild.js gave up on it, and every preview
// build ran on the main thread: a 9-page résumé stood still for up to a second per build while its owner
// typed (their `yarn dev` session, a Website field). A build never refreshes, so the gates that read
// ./dist could not see it.
// This starts the dev server in-process and walks the modules it serves the worker (the entry, then
// every /src/ import in what it serves, dynamic ones included): none may import the refresh runtime,
// the PDF templates must still be compiled, and the editor's own components must still refresh.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const ROOT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const REFRESH = '/@react-refresh';
/** The URL pdfBuild.js starts the worker from. */
const WORKER_ENTRY = '/src/utils/pdfWorker.js?worker_file&type=module';
/** A project module imported in served code, static or dynamic: `from "/src/x.js"`, `import("/src/x.jsx")`. */
const LOCAL_IMPORT = /(?:\bfrom\s*|\bimport\s*\(?\s*)["'](\/src\/[^"']+)["']/g;

let server;
const served = async (url) => (await server.environments.client.transformRequest(url))?.code ?? '';

/** Every /src/ module reachable from `entry`, as the dev server serves it: Map of path -> code. */
async function walk(entry) {
  const modules = new Map();
  const queue = [entry];
  while (queue.length) {
    const url = queue.pop();
    const key = url.split('?')[0];
    if (modules.has(key)) continue;
    const code = await served(url);
    modules.set(key, code);
    for (const [, next] of code.matchAll(LOCAL_IMPORT)) queue.push(next);
  }
  return modules;
}

before(async () => {
  // HMR stays on: plugin-react skips Fast Refresh when it is off, which would pass this for the wrong reason.
  server = await createServer({
    root: ROOT, configFile: path.join(ROOT, 'vite.config.js'), mode: 'development', logLevel: 'silent',
    server: { middlewareMode: true, ws: false }, appType: 'custom',
    optimizeDeps: { noDiscovery: true, include: [] },
  });
}, { timeout: 120_000 });
after(async () => { await server?.close(); });

describe('the PDF worker starts on the dev server (R5-HUNT11-WEBSITE-FREEZE-LEAD)', () => {
  it('no module served to the worker imports the React Fast Refresh runtime', async () => {
    const modules = await walk(WORKER_ENTRY);
    // The walk must really have reached the templates (a dynamic import per template), not stopped at the entry.
    assert.ok(modules.has('/src/utils/pdfWorkerJobs.js'), 'the walk reaches the worker\'s job queue');
    const jsx = [...modules.keys()].filter((k) => k.startsWith('/src/templates/pdf/') && k.endsWith('.jsx'));
    assert.ok(jsx.length >= 10, `the walk reaches the PDF templates (${jsx.length} JSX files)`);
    const offenders = [...modules].filter(([, code]) => code.includes(REFRESH)).map(([key]) => key);
    assert.deepEqual(offenders, [], `${offenders.length} module(s) the PDF worker loads import ${REFRESH}, which needs \`window\` `
      + 'and kills the worker on the dev server; keep them out of plugin-react (PDF_WORKER_JSX in vite.config.js): '
      + offenders.slice(0, 5).join(', '));
  });

  it('a template that skips Fast Refresh is still compiled from JSX', async () => {
    const code = await served('/src/templates/pdf/ClassicTemplatePDF.jsx');
    assert.match(code, /\b_?jsxs?(?:DEV)?\(/, 'the template calls the JSX runtime');
    assert.doesNotMatch(code, /<View[\s>]/, 'no raw JSX is left in it');
  });

  it('the editor\'s own components still refresh (the fix is not "Fast Refresh off")', async () => {
    const code = await served('/src/components/PersonalInfoEditor.jsx');
    assert.ok(code.includes(REFRESH), 'PersonalInfoEditor.jsx is still wrapped for Fast Refresh on the dev server');
  });
});
