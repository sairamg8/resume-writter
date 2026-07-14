import { Mail, Phone, MapPin, Globe, Link2, Code } from 'lucide-react';

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
  { key: 'email',    Icon: Mail   },
  { key: 'phone',    Icon: Phone  },
  { key: 'location', Icon: MapPin },
  { key: 'website',  Icon: Globe  },
  { key: 'linkedin', Icon: Link2  },
  { key: 'github',   Icon: Code   },
];

export function contactHref(key, val) {
  if (key === 'email') return `mailto:${val}`;
  if (key === 'phone') return `tel:${val.replace(/\s/g, '')}`;
  if (key === 'website' || key === 'linkedin' || key === 'github') {
    return val.startsWith('http') ? val : `https://${val}`;
  }
  return null;
}

export function ContactRow({ personal, hidden, style, layout, iconSize = 11 }) {
  const items = CONTACT_FIELDS.filter(({ key }) => !hidden.has(key) && personal?.[key]);
  if (!items.length) return null;

  const color = '#64748b';
  const lyt = layout || 'justify';

  function decorated(key, Icon) {
    const val = personal[key];
    const href = contactHref(key, val);
    const display = href
      ? <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>{val}</a>
      : val;
    if (style === 'icon') return (
      <span key={key} className="flex items-center gap-1" style={{ overflowWrap: 'anywhere' }}>
        <Icon size={iconSize} className="shrink-0" />{display}
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
        {items.map(({ key, Icon }) => <div key={key}>{decorated(key, Icon)}</div>)}
      </div>
    );
  }

  if (lyt === '2grid') {
    return (
      <div style={{ color, display: 'grid', gridTemplateColumns: 'auto auto', gap: '2px 16px' }}>
        {items.map(({ key, Icon }) => decorated(key, Icon))}
      </div>
    );
  }

  // justify
  if (style === 'icon') {
    return (
      <div className="flex flex-wrap items-center" style={{ color, gap: '2px 14px' }}>
        {items.map(({ key, Icon }) => decorated(key, Icon))}
      </div>
    );
  }
  if (style === 'bullet') {
    return (
      <div className="flex flex-wrap items-center" style={{ color }}>
        {items.map(({ key }, i) => {
          const val = personal[key];
          const href = contactHref(key, val);
          return (
            <span key={key} className="flex items-center">
              {i > 0 && <span className="mx-1.5" style={{ color: '#cbd5e1' }}>•</span>}
              {href ? <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>{val}</a> : <span>{val}</span>}
            </span>
          );
        })}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center" style={{ color }}>
      {items.map(({ key }, i) => {
        const val = personal[key];
        const href = contactHref(key, val);
        return (
          <span key={key} className="flex items-center">
            {i > 0 && <span className="mx-1.5" style={{ color: '#cbd5e1' }}>|</span>}
            {href ? <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>{val}</a> : <span>{val}</span>}
          </span>
        );
      })}
    </div>
  );
}
