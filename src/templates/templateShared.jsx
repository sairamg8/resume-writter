export const COLS = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' };

export function isHtmlEmpty(html) {
  return !html || !html.replace(/<[^>]*>/g, '').trim();
}

export function photoStyle(settings, accent) {
  const sh = settings?.photoShape || 'circle';
  const sz = settings?.photoSize || 'md';
  const br = settings?.photoBorder || 'accent';
  const ph = settings?.photoHeight || 'match';
  const w = sz === 'sm' ? 130 : sz === 'lg' ? 200 : 165;
  const h = sh === 'circle' ? w : ph === 'tall' ? Math.round(w * 1.4) : ph === 'taller' ? Math.round(w * 1.8) : w;
  return {
    width: w + 'px',
    height: h + 'px',
    borderRadius: sh === 'rounded' ? '10px' : sh === 'square' ? '3px' : '50%',
    border: br === 'none' ? 'none' : br === 'thin' ? '1.5px solid #e5e7eb' : `1.5px solid ${accent}60`,
    objectFit: 'cover',
    flexShrink: 0,
  };
}

// Compact photo variant for the Modern template's inline accent-band header,
// mirroring src/templates/pdf/ModernTemplatePDF.jsx's getPhotoStyle() sizing.
export function modernPhotoStyle(settings, accent) {
  const sh = settings?.photoShape || 'circle';
  const sz = settings?.photoSize || 'md';
  const br = settings?.photoBorder || 'accent';
  const ph = settings?.photoHeight || 'match';
  const w = sz === 'sm' ? 42 : sz === 'lg' ? 68 : 54;
  const h = sh === 'circle' ? w : ph === 'tall' ? Math.round(w * 1.4) : ph === 'taller' ? Math.round(w * 1.8) : w;
  return {
    width: w + 'px',
    height: h + 'px',
    borderRadius: sh === 'rounded' ? '8px' : sh === 'square' ? '2px' : '50%',
    border: br === 'none' ? 'none' : br === 'thin' ? '2px solid rgba(255,255,255,0.5)' : `2px solid ${accent}`,
    objectFit: 'cover',
    flexShrink: 0,
  };
}

export function contactHref(key, val, personal) {
  if (key === 'email') return `mailto:${val}`;
  if (key === 'phone') return `tel:${val.replace(/\s/g, '')}`;
  if (key === 'website' || key === 'linkedin' || key === 'github') {
    const urlOverride = personal?.[key + 'Url'];
    const url = urlOverride || val;
    return url.startsWith('http') ? url : `https://${url}`;
  }
  return null;
}
