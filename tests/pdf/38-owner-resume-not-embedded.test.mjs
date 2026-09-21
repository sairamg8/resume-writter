// The owner's résumé must never ship in a build — in ANY encoding. cdea2fe (2026-09-20) embedded it as
// an "encrypted" base64 payload (src/utils/ownerDataPayload.js) that demoRestore decoded for the owner's
// e-mail. The decoder and its key sat in the same file, so it was obfuscation, and it reached the public
// bundle and origin/master. tests/pdf/24-private-data only looks for the PLAINTEXT of the private file,
// so it could not see it. These tests close that door for any encoding of any data:
//   1. no source file holds a long base64-like literal — an embedded data blob;
//   2. nothing in src still names the payload module;
//   3. with the dev-only `ownerResume` null — every build — the owner's account gets NO résumé out of
//      the code (control: the file the dev server supplies still restores);
//   4. the production entry chunk holds no such blob either.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { setup, teardown, loadModule } from './harness.mjs';

const ROOT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const SRC = path.join(ROOT, 'src');
const OWNER_EMAIL = 'sairamgudiputi8@gmail.com';
// A base64-like run this long is data, not code. The payload of a data: URI (a small asset Vite inlines) is fine.
const BLOB = /(?<!base64,)[A-Za-z0-9+/]{1500,}={0,2}/g;

before(setup);
after(teardown);

const sourceFiles = () => fs.readdirSync(SRC, { recursive: true })
  .filter((f) => /\.(jsx?|mjs|json|css|html|svg)$/.test(f))
  .map((f) => path.join(SRC, f))
  .filter((f) => fs.statSync(f).isFile());

/** A restore that records what it was asked to put back. */
function restoreFor({ ownerResume, now }) {
  const calls = [];
  const restore = createRestore({ ownerResume, now });
  return { calls, restore, store: { restoreResumes: (list) => calls.push(list) } };
}
let createRestore;

describe('the owner\'s résumé is embedded in no build, in any encoding', () => {
  before(async () => {
    const { createDemoRestore } = await loadModule('/src/utils/demoRestore.js');
    createRestore = ({ ownerResume, now }) => createDemoRestore({ accounts: [OWNER_EMAIL], ownerResume, now: () => now });
  });

  it('no source file holds an embedded data blob (a base64-like literal of 1500+ characters)', () => {
    // Lengths only in the message: a failure must not print the data into a test log.
    const blobs = sourceFiles().flatMap((f) => [...fs.readFileSync(f, 'utf8').matchAll(BLOB)]
      .map((m) => `${path.relative(ROOT, f)} (${m[0].length} chars)`));
    assert.deepEqual(blobs, []);
  });

  it('nothing in src names the payload module any more', () => {
    assert.equal(fs.existsSync(path.join(SRC, 'utils/ownerDataPayload.js')), false, 'the module is gone');
    const users = sourceFiles()
      .filter((f) => /ownerDataPayload|getOwnerResumeFor|OWNER_PAYLOAD/.test(fs.readFileSync(f, 'utf8')))
      .map((f) => path.relative(ROOT, f));
    assert.deepEqual(users, []);
  });

  it('a build (ownerResume null) hands the owner nothing out of the code, empty account or all résumés deleted', () => {
    const { calls, restore, store } = restoreFor({ ownerResume: null, now: 1000 });
    const user = { uid: 'u_owner', email: OWNER_EMAIL };
    const account = { uid: 'u_owner', cloud: true, cloudOriginals: [], cloudDeleted: [] };
    restore.update({ user, account, appState: { resumes: [] }, sync: {}, store });
    restore.update({ user, account, appState: { resumes: [], deletedIds: ['original_private'] }, sync: {}, store });
    // A count, never the résumé: a failure here would otherwise print the owner's data into a test log.
    assert.equal(calls.length, 0, `${calls.length} restore call(s) put a résumé back out of the code`);
  });

  it('control: the file the dev server supplies still comes back as the account\'s original', async () => {
    const { PRIVATE_ORIGINAL_ID } = await loadModule('/src/utils/demoSeed.js');
    const fixture = { name: 'Fixture', personal: { name: 'Pat Fixture', email: OWNER_EMAIL }, sections: [] };
    const { calls, restore, store } = restoreFor({ ownerResume: fixture, now: 2000 });
    const user = { uid: 'u_owner', email: OWNER_EMAIL };
    const account = { uid: 'u_owner', cloud: true, cloudOriginals: [], cloudDeleted: [] };
    restore.update({ user, account, appState: { resumes: [] }, sync: {}, store });
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0].id, PRIVATE_ORIGINAL_ID);
    assert.equal(calls[0][0].keep, true);
  });

  it('control: a supplied file also comes back after every résumé was deleted, and is not re-imported while one is present', async () => {
    const { PRIVATE_ORIGINAL_ID } = await loadModule('/src/utils/demoSeed.js');
    const fixture = { name: 'Fixture', personal: { name: 'Pat Fixture', email: OWNER_EMAIL }, sections: [] };
    const { calls, restore, store } = restoreFor({ ownerResume: fixture, now: 3000 });
    const user = { uid: 'u_owner', email: OWNER_EMAIL };
    const account = { uid: 'u_owner', cloud: true, cloudOriginals: [], cloudDeleted: [] };
    const present = { id: PRIVATE_ORIGINAL_ID, keep: true, sections: [], personal: { email: OWNER_EMAIL } };
    restore.update({ user, account, appState: { resumes: [present] }, sync: {}, store });
    assert.equal(calls.length, 0, 'nothing is restored while the résumé is present');
    restore.update({ user, account, appState: { resumes: [], deletedIds: [PRIVATE_ORIGINAL_ID] }, sync: {}, store });
    assert.equal(calls.length, 1, 'restored once after everything was deleted');
    assert.equal(calls[0][0].id, PRIVATE_ORIGINAL_ID);
  });

  it('the production entry chunk holds no embedded data blob either', { timeout: 240_000 }, async () => {
    const out = await build({ root: ROOT, configFile: path.join(ROOT, 'vite.config.js'), mode: 'production', logLevel: 'silent', build: { write: false } });
    const entries = [out].flat().flatMap((o) => o.output).filter((f) => f.type === 'chunk' && f.isEntry);
    assert.ok(entries.length >= 1, 'an entry chunk is built');
    const blobs = entries.flatMap((c) => [...c.code.matchAll(BLOB)].map((m) => `${c.fileName} (${m[0].length} chars)`));
    assert.deepEqual(blobs, []);
  });
});
