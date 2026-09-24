import { useEffect, useLayoutEffect, useRef } from 'react';

// Keyboard shortcuts for the workspace pages — `c` create, `/` search, `?` help, ⌘/Ctrl+Enter
// save. A single key must never fire while the user is typing ("c" in a title is a letter, not
// "create"), and a page's shortcuts must not fire under an open dialog. The matching is pure and
// exported, so node tests drive it with plain event objects (tests/unit/ui-hotkeys.unit.mjs).

const MODIFIERS = new Set(['mod', 'ctrl', 'meta', 'alt', 'shift']);
const KEY_NAMES = { esc: 'escape', space: ' ', spacebar: ' ', return: 'enter', up: 'arrowup', down: 'arrowdown', left: 'arrowleft', right: 'arrowright', del: 'delete' };
const NOT_TEXT = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file', 'image']);

/** 'mod+shift+k' → { key: 'k', mod, ctrl, meta, alt, shift } (key lower-case; `mod` is ⌘ on a Mac, Ctrl elsewhere). */
export function parseHotkey(combo) {
  const parts = String(combo).split(/\+(?!$)/);
  const spec = { key: '', mod: false, ctrl: false, meta: false, alt: false, shift: false };
  for (const raw of parts) {
    const part = raw.toLowerCase();
    if (MODIFIERS.has(part) && parts.length > 1) spec[part] = true;
    else spec.key = KEY_NAMES[part] ?? part;
  }
  return spec;
}

/** Whether a combo holds ⌘, Ctrl, Alt or `mod` — such a shortcut may fire while typing. */
export function hasCommandModifier(spec) {
  return spec.mod || spec.ctrl || spec.meta || spec.alt;
}

/**
 * Whether the keydown `event` is the shortcut `combo`. Letters compare case-blind with Shift
 * required to match ('c' is not Shift+C); a symbol ('?', '/') is the character itself, whatever
 * Shift it took on this keyboard. A bare key never matches with ⌘/Ctrl/Alt held, so ⌘C stays copy.
 */
export function matchesHotkey(event, combo, isMac = false) {
  const spec = typeof combo === 'string' ? parseHotkey(combo) : combo;
  const key = String(event.key ?? '').toLowerCase();
  if (key !== spec.key) return false;
  const wantMeta = spec.meta || (spec.mod && isMac);
  const wantCtrl = spec.ctrl || (spec.mod && !isMac);
  if (!!event.metaKey !== wantMeta || !!event.ctrlKey !== wantCtrl || !!event.altKey !== spec.alt) return false;
  const letter = /^[a-z]$/.test(spec.key);
  const named = spec.key.length > 1;
  if ((letter || named || spec.shift) && !!event.shiftKey !== spec.shift) return false;
  return true;
}

/** Whether keys typed at `el` are text: a text input, a textarea, a select, or editable content. */
export function isTypingTarget(el) {
  if (!el || typeof el !== 'object') return false;
  const tag = String(el.tagName ?? '').toUpperCase();
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') return !NOT_TEXT.has(String(el.type ?? 'text').toLowerCase());
  if (el.isContentEditable) return true;
  return !!el.closest?.('[contenteditable=""], [contenteditable="true"]');
}

/** A binding's handler and its options, from the function or `{ handler, allowInInput }` form. */
const bindingOf = (value) => (typeof value === 'function' ? { handler: value } : value ?? {});

const macNow = () => typeof navigator !== 'undefined'
  && /mac|iphone|ipad|ipod/i.test(navigator.userAgentData?.platform || navigator.platform || '');

/**
 * Registers keyboard shortcuts on the window while mounted.
 *
 *     useHotkeys({
 *       c: () => setCreating(true),
 *       '/': () => searchRef.current?.focus(),
 *       '?': () => setHelpOpen(true),
 *       'mod+Enter': { handler: save, allowInInput: true },
 *     });
 *
 * - A binding is a function, or `{ handler, allowInInput, preventDefault }`. The handler gets the
 *   event; the default action is prevented unless `preventDefault: false`.
 * - A bare key (no ⌘/Ctrl/Alt/`mod`) is ignored while focus is in a text field, a select or
 *   editable content, unless `allowInInput`; a combo with ⌘/Ctrl/Alt fires there too. Key repeats of
 *   bare keys, IME composition and events a component already handled (defaultPrevented) are ignored.
 * - While a modal dialog is open (aria-modal) the page's shortcuts sleep; a dialog's own
 *   shortcuts pass `{ allowInDialog: true }`. `{ enabled: false }` turns them all off.
 */
export function useHotkeys(bindings, { enabled = true, allowInDialog = false } = {}) {
  const latest = useRef(bindings);
  useLayoutEffect(() => {
    latest.current = bindings;
  });

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return undefined;
    const onKeyDown = (event) => {
      if (event.defaultPrevented || event.isComposing) return;
      if (!allowInDialog && document.querySelector('[aria-modal="true"]')) return;
      const isMac = macNow();
      for (const [combo, value] of Object.entries(latest.current ?? {})) {
        const spec = parseHotkey(combo);
        if (!matchesHotkey(event, spec, isMac)) continue;
        const { handler, allowInInput = false, preventDefault = true } = bindingOf(value);
        const bare = !hasCommandModifier(spec);
        if (bare && !allowInInput && isTypingTarget(event.target)) return;
        if (bare && event.repeat) return;
        if (preventDefault) event.preventDefault();
        handler?.(event);
        return;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled, allowInDialog]);
}
