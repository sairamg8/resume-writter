import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';

before(setup);
after(teardown);

describe('Owner resume persistence for sairamgudiputi8@gmail.com', () => {
  const OWNER_EMAIL = 'sairamgudiputi8@gmail.com';
  const OTHER_EMAIL = 'other@example.com';

  it('getOwnerResumeFor returns valid resume only for sairamgudiputi8@gmail.com', async () => {
    const { getOwnerResumeFor } = await loadModule('/src/utils/ownerDataPayload.js');
    const owner = getOwnerResumeFor(OWNER_EMAIL);
    assert.ok(owner, 'owner resume exists');
    assert.equal(owner.personal.email, OWNER_EMAIL);
    assert.ok(Array.isArray(owner.sections), 'has sections');
    assert.ok(owner.sections.length > 0, 'sections not empty');

    // Case insensitivity
    assert.ok(getOwnerResumeFor('SairamGudiputi8@Gmail.com'));

    // Non-owner gets null
    assert.equal(getOwnerResumeFor(OTHER_EMAIL), null);
    assert.equal(getOwnerResumeFor(''), null);
    assert.equal(getOwnerResumeFor(null), null);
  });

  it('restores owner resume on initial load when account has no resumes', async () => {
    const { createDemoRestore } = await loadModule('/src/utils/demoRestore.js');
    const { PRIVATE_ORIGINAL_ID } = await loadModule('/src/utils/demoSeed.js');

    let restored = [];
    const store = {
      restoreResumes: (list) => { restored = list; },
    };
    const demoRestore = createDemoRestore({
      accounts: [OWNER_EMAIL],
      ownerResume: null, // live mode where virtual:owner-resume is null
      now: () => 1000,
    });

    const user = { uid: 'u_sairam', email: OWNER_EMAIL };
    const account = { uid: 'u_sairam', cloud: true, cloudOriginals: [], cloudDeleted: [] };
    demoRestore.update({ user, account, appState: { resumes: [] }, sync: {}, store });

    assert.equal(restored.length, 1);
    assert.equal(restored[0].id, PRIVATE_ORIGINAL_ID);
    assert.equal(restored[0].keep, true);
    assert.equal(restored[0].personal.email, OWNER_EMAIL);
  });

  it('persists and restores owner resume when all existing resumes are deleted', async () => {
    const { createDemoRestore } = await loadModule('/src/utils/demoRestore.js');
    const { PRIVATE_ORIGINAL_ID } = await loadModule('/src/utils/demoSeed.js');

    let restored = [];
    const store = {
      restoreResumes: (list) => { restored = list; },
    };
    const demoRestore = createDemoRestore({
      accounts: [OWNER_EMAIL],
      ownerResume: null,
      now: () => 2000,
    });

    const user = { uid: 'u_sairam', email: OWNER_EMAIL };
    const account = { uid: 'u_sairam', cloud: true, cloudOriginals: [], cloudDeleted: [] };

    // Initial state: 1 resume present
    const existing = { id: PRIVATE_ORIGINAL_ID, keep: true, sections: [], personal: { email: OWNER_EMAIL } };
    demoRestore.update({ user, account, appState: { resumes: [existing] }, sync: {}, store });
    assert.equal(restored.length, 0, 'no restore while resume is present');

    // User deletes all resumes (appState.resumes becomes [])
    demoRestore.update({
      user,
      account,
      appState: { resumes: [], deletedIds: [PRIVATE_ORIGINAL_ID] },
      sync: {},
      store,
    });

    assert.equal(restored.length, 1, 'owner resume persists when all deleted');
    assert.equal(restored[0].id, PRIVATE_ORIGINAL_ID);
    assert.equal(restored[0].keep, true);
  });

  it('never restores owner resume for another account when all resumes are deleted', async () => {
    const { createDemoRestore } = await loadModule('/src/utils/demoRestore.js');

    let restored = [];
    const store = {
      restoreResumes: (list) => { restored = list; },
    };
    const demoRestore = createDemoRestore({
      accounts: [OWNER_EMAIL],
      ownerResume: null,
      now: () => 3000,
    });

    const user = { uid: 'u_other', email: OTHER_EMAIL };
    const account = { uid: 'u_other', cloud: true, cloudOriginals: [], cloudDeleted: [] };
    demoRestore.update({ user, account, appState: { resumes: [] }, sync: {}, store });

    assert.equal(restored.length, 0, 'other user gets nothing');
  });
});
