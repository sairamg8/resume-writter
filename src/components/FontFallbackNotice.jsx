import { useSyncExternalStore } from 'react';
import { fontFallback, fontFallbackMessage, subscribeFontFallback } from '@/utils/fontFallback';

/**
 * Above the preview while the PDF prints in Noto Sans because the chosen font could not be loaded
 * (offline, or the CDN blocked): "Lora could not be loaded — the PDF uses Noto Sans until you are
 * back online." Gone with the first build that loads the font (R2-146).
 */
export function FontFallbackNotice() {
  const font = useSyncExternalStore(subscribeFontFallback, fontFallback, () => null);
  if (!font) return null;
  const online = typeof window === 'undefined' || window.navigator?.onLine !== false;
  return (
    <p data-font-fallback={font} className="mb-3 max-w-md text-center text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 shrink-0">
      {fontFallbackMessage(font, online)}
    </p>
  );
}
