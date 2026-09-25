// The owner's own résumé (git-ignored private/sairam-resume.json) reaches the dev server only —
// useDemoSeed makes it their account's original there — and never a build: the site is public
// and so is its bundle (OWNER-DATA, 2026-09-15). vite-plugin-owner-resume.js serves the file as
// `virtual:owner-resume` to the dev server and `null` to every build, without reading it.
import { after, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, createServer } from 'vite';
import { ownerResume, OWNER_RESUME_MODULE } from '../../vite-plugin-owner-resume.js';

const ROOT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const PRIVATE = path.join(ROOT, 'private/sairam-resume.json');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'owner-resume-'));
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

/** Every text a build writes — scripts, styles, the page — as one string. */
async function bundleText(config) {
  const out = await build({ logLevel: 'silent', ...config, build: { write: false, ...config.build } });
  return [out].flat().flatMap((o) => o.output)
    .map((f) => (f.type === 'chunk' ? f.code : Buffer.from(f.source).toString('utf8'))).join('\n');
}

/** A throwaway project whose one script prints `virtual:owner-resume`, with the plugin reading `file`. */
function project(file) {
  const dir = fs.mkdtempSync(path.join(tmp, 'p-'));
  fs.writeFileSync(path.join(dir, 'main.js'), `import r from '${OWNER_RESUME_MODULE}';\nconsole.log(JSON.stringify(r));\n`);
  return {
    dir,
    config: { configFile: false, root: dir, plugins: [ownerResume({ file })], build: { rollupOptions: { input: path.join(dir, 'main.js') } } },
  };
}

const FAKE = { name: 'Fixture — Classic', personal: { name: 'Pat Fixture', email: 'pat@example.com', phone: '+1 555 0199' }, sections: [] };

describe('vite-plugin-owner-resume: the dev server only', () => {
  it('the dev server serves the file as the module; a missing or broken file is null', async () => {
    const file = path.join(tmp, 'mine.json');
    fs.writeFileSync(file, JSON.stringify(FAKE));
    const { dir, config } = project(file);
    const server = await createServer({ ...config, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'silent' });
    try {
      assert.deepEqual((await server.ssrLoadModule(OWNER_RESUME_MODULE)).default, FAKE);
    } finally {
      await server.close();
    }
    for (const bad of [path.join(dir, 'missing.json'), (fs.writeFileSync(path.join(dir, 'bad.json'), '{ nope'), path.join(dir, 'bad.json'))]) {
      const other = await createServer({ ...project(bad).config, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'silent' });
      try {
        assert.equal((await other.ssrLoadModule(OWNER_RESUME_MODULE)).default, null, bad);
      } finally {
        await other.close();
      }
    }
  });

  it('a build gets null even though the file is there, and never reads it', async () => {
    const file = path.join(tmp, 'mine-build.json');
    fs.writeFileSync(file, JSON.stringify(FAKE));
    const { config } = project(file);

    // Track every read of the file during build across sync, async, callback and promises APIs,
    // as well as named imports (readFileSync calls fs.openSync) (VF1S.4).
    const sOpenSync = mock.method(fs, 'openSync');
    const sOpen = mock.method(fs, 'open');
    const sReadFile = mock.method(fs, 'readFile');
    const sPromisesReadFile = mock.method(fs.promises, 'readFile');
    const sPromisesOpen = mock.method(fs.promises, 'open');

    // Also make the file unreadable at the OS level (chmod 000) so any read attempt would
    // fail with EACCES and warn/throw, and capture Rollup warnings (Option B, VF1S.4).
    fs.chmodSync(file, 0);
    const warnings = [];
    const buildConfig = {
      ...config,
      build: {
        ...config.build,
        rollupOptions: {
          ...config.build?.rollupOptions,
          onwarn(w) { warnings.push(w.message || String(w)); },
        },
      },
    };

    let text;
    try {
      text = await bundleText(buildConfig);
    } finally {
      fs.chmodSync(file, 0o600);
      mock.reset();
    }

    const fileReads = [
      ...sOpenSync.mock.calls,
      ...sOpen.mock.calls,
      ...sReadFile.mock.calls,
      ...sPromisesReadFile.mock.calls,
      ...sPromisesOpen.mock.calls,
    ].filter((c) => typeof c.arguments[0] === 'string' && path.resolve(c.arguments[0]) === file);

    assert.deepEqual(fileReads, [], 'the build read the private file');
    assert.deepEqual(warnings, [], 'the build warned attempting to read the private file');
    assert.match(text, /console\.log\(JSON\.stringify\(null\)\)/);
    for (const s of ['Pat Fixture', 'pat@example.com', '555 0199']) assert.equal(text.includes(s), false, s);

    // The control: the same build with the module handing over the file shows every one of them.
    const leak = { name: 'leak', enforce: 'pre', resolveId: (id) => (id === OWNER_RESUME_MODULE ? '\0leak' : null), load: (id) => (id === '\0leak' ? `export default ${JSON.stringify(FAKE)};` : null) };
    const leaked = await bundleText({ ...config, plugins: [leak, ...config.plugins] });
    for (const s of ['Pat Fixture', 'pat@example.com', '555 0199']) assert.equal(leaked.includes(s), true, s);
  });
});

// A guard: nothing has ever bundled the file; this keeps it that way.
describe('the owner\'s private résumé is in no bundle the app builds', () => {
  const skip = !fs.existsSync(PRIVATE) && 'private/sairam-resume.json is not on this machine: nothing private to look for';

  it('neither the production build nor the e2e build holds its name, phone, e-mail or any other text of it', { skip }, async () => {
    const data = JSON.parse(fs.readFileSync(PRIVATE, 'utf8'));
    // The file's contact details and every phrase of it — rich text split at its tags; single
    // words like "Performance" are in any bundle — that the app's own source does not hold. Not the
    // e-mail: the owner's build takes it from VITE_CONTACT_EMAIL and VITE_DEMO_ACCOUNTS (siteOwner.js),
    // so it is meant to be in that bundle, as the site's public contact address (R2-143).
    const { name, phone, email } = data.personal;
    const texts = new Set(['name', 'phone', 'linkedin', 'github', 'website'].map((k) => data.personal[k]?.trim()).filter((t) => t?.length >= 6));
    const walk = (v) => {
      if (typeof v === 'string') v.split(/<[^>]*>/).map((t) => t.replace(/\s+/g, ' ').trim()).filter((t) => t.length >= 16 && t.includes(' ')).forEach((t) => texts.add(t));
      else if (v && typeof v === 'object') Object.values(v).forEach(walk);
    };
    walk(data);
    const source = fs.readdirSync(path.join(ROOT, 'src'), { recursive: true })
      .map((f) => path.join(ROOT, 'src', f)).filter((f) => fs.statSync(f).isFile())
      .map((f) => fs.readFileSync(f, 'utf8')).join('\n');
    const markers = [...texts].filter((t) => !source.includes(t));
    assert.ok(markers.includes(name.trim()), 'the name is looked for');
    if (phone?.trim().length >= 6) assert.ok(markers.includes(phone.trim()), 'the phone is looked for');
    assert.ok(markers.length >= 10, `only ${markers.length} texts to look for`);

    // The control: a build that does bundle the file (a plain import of it) shows the markers,
    // so a clean result below means they are not there — not that minifying hid them.
    const entry = path.join(tmp, 'leak.js');
    fs.writeFileSync(entry, `import r from ${JSON.stringify(PRIVATE)};\nconsole.log(JSON.stringify(r));\n`);
    const leaked = await bundleText({ configFile: false, root: tmp, build: { rollupOptions: { input: entry } } });
    const found = markers.filter((t) => leaked.includes(t));
    assert.ok(found.length >= markers.length * 0.9 && found.includes(name.trim()), `the control build shows ${found.length} of ${markers.length}`);

    // Counts only in the messages: a failure must not print the private text into a test log.
    for (const mode of ['production', 'e2e']) {
      const text = await bundleText({ root: ROOT, configFile: path.join(ROOT, 'vite.config.js'), mode });
      const inBundle = found.filter((t) => text.includes(t));
      assert.equal(inBundle.length, 0, `${mode} bundle: ${inBundle.length} of ${found.length} texts of the file${inBundle.includes(name.trim()) ? ', the name among them' : ''}`);
      // The address is public, but never as the résumé's own field.
      assert.equal(new RegExp(`"?email"?\\s*:\\s*"${email.trim().replace(/[.+]/g, '\\$&')}"`).test(text), false, `${mode}: the résumé's e-mail field`);
    }
  });
});
