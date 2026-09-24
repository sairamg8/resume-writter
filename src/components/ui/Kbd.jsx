import { shortcutKeys } from '../../utils/uiFormat.js';
import { cx } from './compose.js';

/** A Mac (⌘ glyphs) or not (Ctrl words) — read from the browser; false on the server. */
export function isMacPlatform() {
  if (typeof navigator === 'undefined') return false;
  const platform = navigator.userAgentData?.platform || navigator.platform || navigator.userAgent || '';
  return /mac|iphone|ipad|ipod/i.test(platform);
}

const TONES = {
  light: 'border-slate-200 bg-white text-slate-600 shadow-[0_1px_0_0_rgb(226_232_240)]',
  dark: 'border-white/20 bg-white/10 text-white/90',
};

/**
 * A keyboard key cap, or a row of them: `<Kbd combo="mod+k" />` draws ⌘ K on a Mac and Ctrl K
 * elsewhere (uiFormat.shortcutKeys); `<Kbd>Esc</Kbd>` draws one cap as written. `tone` 'light'
 * (default) or 'dark' (inside a tooltip). Screen readers hear the keys' words ("Ctrl K"), never
 * the glyphs — an aria-label on a plain span is not read, so the words are sr-only text.
 */
export function Kbd({ combo, tone = 'light', className, children }) {
  const keys = combo ? shortcutKeys(combo, isMacPlatform()) : [children];
  const spoken = combo ? shortcutKeys(combo, false).join(' ') : null;
  return (
    <span className={cx('inline-flex items-center gap-0.5', className)}>
      {keys.map((key, i) => (
        <kbd
          key={i}
          aria-hidden={spoken ? 'true' : undefined}
          className={cx(
            'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded border px-1 font-sans text-[11px] font-medium leading-none',
            TONES[tone] ?? TONES.light,
          )}
        >
          {key}
        </kbd>
      ))}
      {spoken && <span className="sr-only">{spoken}</span>}
    </span>
  );
}
