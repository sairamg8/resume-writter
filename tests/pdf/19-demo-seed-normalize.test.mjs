import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { privateOriginal } from '../../src/utils/demoSeed.js';

before(setup);
after(teardown);

test('VF2-2.2-NB1: the private original is normalized with its own updatedAt before being stamped now', async () => {
  const { normalizeResume } = await loadModule('/src/utils/normalizeResume.js');
  
  const SYNTHETIC_FILE = {
    dataVersion: 8,
    updatedAt: 1000,
    template: 'modern',
    settings: { photoTextAlign: 'center', itemGap: 12 },
    personal: { name: 'Owner', email: 'owner@example.com' },
    sections: [{ id: 's', items: [] }],
    coverLetter: { body: '<p>Hiring Manager</p>' }
  };
  
  const OWNER = { uid: 'u', email: 'Owner@Example.com' };
  
  // Using the normalize function injection
  const stamped = privateOriginal?.(SYNTHETIC_FILE, OWNER, { now: Date.now(), normalize: normalizeResume });
  const restored = normalizeResume(stamped);
  
  // Simulated import normalization
  const imported = normalizeResume(SYNTHETIC_FILE);
  
  assert.equal(restored.settings.photoTextAlign, imported.settings.photoTextAlign);
  assert.equal(restored.settings.itemGap, imported.settings.itemGap);
  assert.equal(restored.coverLetter?.body, imported.coverLetter?.body);
});
