import { MARGIN_MAP, LINE_HEIGHT_MAP } from '@/constants/resume';

export function timeAgo(ts) {
  const secs = Math.floor((Date.now() - ts) / 1000);
  if (secs < 60) return 'Just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

export function computeMargin(settings) {
  const v = settings.marginV ?? 14;
  const h = settings.marginH ?? 18;
  if (settings.marginV != null || settings.marginH != null) return `${v}mm ${h}mm`;
  return MARGIN_MAP[settings.margins] || MARGIN_MAP.normal;
}

export function computeLineHeight(settings) {
  if (settings.lineHeightValue != null) return String(settings.lineHeightValue);
  return LINE_HEIGHT_MAP[settings.lineHeight] || '1.5';
}
