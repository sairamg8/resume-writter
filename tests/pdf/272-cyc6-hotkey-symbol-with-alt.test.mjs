// A shortcut that is a symbol ('[' collapses the sidebar, '/' searches, '?' shows the shortcuts) never fired on a
// keyboard that makes the symbol with Alt: '[' is AltGr+8 on a German layout (Windows reports Ctrl+Alt, a German
// Mac Option+5), '/' and '?' are AltGr keys on a Brazilian one. matchesHotkey took the Alt as a command and said no.
// Now a symbol typed with Alt (or Ctrl+Alt) is the shortcut; Ctrl or Cmd alone, and a letter with Alt, still are not.
// Run: node --test tests/pdf/272-cyc6-hotkey-symbol-with-alt.test.mjs
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';

let matchesHotkey;
before(async () => {
  await setup();
  ({ matchesHotkey } = await loadModule('/src/hooks/useHotkeys.js'));
});
after(teardown);

const key = (k, mods = {}) => ({ key: k, ...mods });

it('a symbol made with AltGr (Ctrl+Alt on Windows) is the shortcut', () => {
  assert.ok(matchesHotkey(key('[', { ctrlKey: true, altKey: true }), '['));
  assert.ok(matchesHotkey(key('/', { ctrlKey: true, altKey: true }), '/'));
  assert.ok(matchesHotkey(key('?', { ctrlKey: true, altKey: true, shiftKey: true }), '?'));
});

it('a symbol made with Option (Alt alone) on a Mac layout is the shortcut', () => {
  assert.ok(matchesHotkey(key('[', { altKey: true }), '[', true));
  assert.ok(matchesHotkey(key('[', { altKey: true }), '[', false));
});

it('Ctrl or Cmd with a symbol, with no Alt, is still not the shortcut', () => {
  assert.ok(!matchesHotkey(key('[', { ctrlKey: true }), '['));
  assert.ok(!matchesHotkey(key('[', { metaKey: true }), '[', true));
  assert.ok(!matchesHotkey(key('/', { metaKey: true, altKey: true }), '/', true));
});

it('a letter with Alt or Ctrl+Alt is still not the shortcut', () => {
  assert.ok(!matchesHotkey(key('c', { altKey: true }), 'c'));
  assert.ok(!matchesHotkey(key('c', { ctrlKey: true, altKey: true }), 'c'));
});

it('a shortcut that asks for Ctrl or Alt itself is read as before', () => {
  assert.ok(matchesHotkey(key('Enter', { ctrlKey: true }), 'mod+Enter', false));
  assert.ok(matchesHotkey(key('k', { altKey: true }), 'alt+k'));
  assert.ok(!matchesHotkey(key('k'), 'alt+k'));
});
