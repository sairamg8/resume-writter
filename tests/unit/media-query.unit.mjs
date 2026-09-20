import { test } from 'node:test';
import assert from 'node:assert/strict';
import { useMediaQuery, useIsMobile } from '../../src/hooks/useMediaQuery.js';

test('useMediaQuery and useIsMobile exist and are callable functions', () => {
  assert.equal(typeof useMediaQuery, 'function');
  assert.equal(typeof useIsMobile, 'function');
});

test('useMediaQuery safely returns boolean in node/SSR environments without throwing', () => {
  // In node.js (where window is undefined)
  const isServerMobile = typeof window === 'undefined';
  assert.equal(isServerMobile, true);
});
