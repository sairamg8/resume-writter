import { contactHref as sharedHref } from '@/templates/templateShared';
import { ContactIcon } from '@/utils/contactIcons';

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
    borderRadius: sh === 'rounded' ? '8px' : sh === 'square' ? '2px' : '50%',
    border: br === 'none' ? 'none' : br === 'thin' ? '1.5px solid #e5e7eb' : `1.5px solid ${accent}60`,
    objectFit: 'cover',
    flexShrink: 0,
  };
}

export const CONTACT_FIELDS = [
  { key: 'email' },
  { key: 'phone' },
  { key: 'location' },
  { key: 'website' },
  { key: 'linkedin' },
  { key: 'github' },
];

export function contactHref(key, val) {
  return sharedHref(key, val);
}

export function ContactRow({ personal, hidden, style, layout, iconSize = 11, settings }) {
  const items = CONTACT_FIELDS.filter(({ key }) => !hidden.has(key) && personal?.[key]);
  if (!items.length) return null;

  const color = '#64748b';
  const lyt = layout || 'justify';

  function decorated(key) {
    const val = personal[key];
    const href = contactHref(key, val);
    const display = href
      ? <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>{val}</a>
      : val;
    if (style === 'icon') return (
      <span key={key} className="flex items-center gap-1" style={{ overflowWrap: 'anywhere' }}>
        <ContactIcon field={key} settings={settings} size={iconSize} strokeWidth={2} className="shrink-0" />
        {display}
      </span>
    );
    if (style === 'bullet') return (
      <span key={key} className="flex items-center gap-1" style={{ overflowWrap: 'anywhere' }}>
        <span style={{ color: '#cbd5e1' }}>•</span>{display}
      </span>
    );
    return <span key={key} style={{ overflowWrap: 'anywhere' }}>{display}</span>;
  }

  if (lyt === 'single') {
    return (
      <div className="space-y-0.5" style={{ color }}>
        {items.map(({ key }) => <div key={key}>{decorated(key)}</div>)}
      </div>
    );
  }

  if (lyt === '2grid') {
    return (
      <div style={{ color, display: 'grid', gridTemplateColumns: 'auto auto', gap: '2px 16px' }}>
        {items.map(({ key }) => decorated(key))}
      </div>
    );
  }

  if (style === 'icon') {
    return (
      <div className="flex flex-wrap items-center" style={{ color, gap: '2px 14px' }}>
        {items.map(({ key }) => decorated(key))}
      </div>
    );
  }
  if (style === 'bullet') {
    return (
      <div className="flex flex-wrap items-center" style={{ color }}>
        {items.map(({ key }, i) => (
          <span key={key} className="flex items-center">
            {i > 0 && <span className="mx-1.5" style={{ color: '#cbd5e1' }}>•</span>}
            {decorated(key)}
          </span>
        ))}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center" style={{ color }}>
      {items.map(({ key }, i) => (
        <span key={key} className="flex items-center">
          {i > 0 && <span className="mx-1.5" style={{ color: '#e2e8f0' }}>|</span>}
          {personal[key]}
        </span>
      ))}
    </div>
  );
}
