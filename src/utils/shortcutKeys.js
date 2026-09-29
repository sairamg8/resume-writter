// A shortcut's key glyphs (the kit's Kbd), apart from uiFormat.js, which re-exports it: the Dashboard's
// dialogs draw a close button whose tooltip can show a shortcut, and importing uiFormat for this one
// function put all of it (the workspace pages' date and avatar formats) on the start-up path
// (71-startup-chunks). Pure (no React, no `@/` alias), like uiFormat.

const KEY_WORDS = {
  mod: ['⌘', 'Ctrl'], meta: ['⌘', 'Meta'], ctrl: ['⌃', 'Ctrl'], alt: ['⌥', 'Alt'], shift: ['⇧', 'Shift'],
  enter: ['↵', 'Enter'], escape: ['Esc', 'Esc'], esc: ['Esc', 'Esc'], space: ['Space', 'Space'],
  backspace: ['⌫', 'Backspace'], delete: ['Del', 'Del'], tab: ['Tab', 'Tab'],
  arrowup: ['↑', '↑'], arrowdown: ['↓', '↓'], arrowleft: ['←', '←'], arrowright: ['→', '→'],
};

/**
 * A shortcut as the key caps to draw: 'mod+k' → ['⌘', 'K'] on a Mac, ['Ctrl', 'K'] elsewhere;
 * 'shift+?' → ['⇧', '?']; '/' → ['/']. `mod` is ⌘ on a Mac and Ctrl elsewhere, as useHotkeys reads it.
 */
export function shortcutKeys(combo, isMac = false) {
  return String(combo ?? '').split(/\+(?!$)/).filter(Boolean).map((part) => {
    const word = KEY_WORDS[part.toLowerCase()];
    if (word) return word[isMac ? 0 : 1];
    return part.length === 1 ? part.toUpperCase() : part[0].toUpperCase() + part.slice(1);
  });
}
