// A push to a branch other than master deployed the live site (2026-09-25): Cloudflare Workers Builds
// builds and deploys every branch. vite.config.js now refuses a Workers Build of any other branch
// (vite-deploy-guard.js), so its deploy never runs; master's, GitHub CI's and a local build go on.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { refusedBuild } from '../../vite-deploy-guard.js';

test('a Workers Build of a branch other than master is refused', () => {
  for (const branch of ['claude/wf-owner-ui', 'claude/busy-darwin-yjb13t', 'main']) {
    assert.match(refusedBuild({ WORKERS_CI: '1', WORKERS_CI_BRANCH: branch }), new RegExp(`"${branch}"`), branch);
  }
});

test("master's Workers Build, GitHub CI and a local build go on", () => {
  assert.equal(refusedBuild({ WORKERS_CI: '1', WORKERS_CI_BRANCH: 'master' }), null);
  assert.equal(refusedBuild({ GITHUB_ACTIONS: 'true', GITHUB_REF_NAME: 'claude/wf-owner-ui' }), null);
  assert.equal(refusedBuild({}), null);
});

test('vite.config.js stops on it before building', () => {
  const src = fs.readFileSync(new URL('../../vite.config.js', import.meta.url), 'utf8');
  assert.match(src, /const refused = refusedBuild\(\)\nif \(refused\) throw new Error\(refused\)/);
});
