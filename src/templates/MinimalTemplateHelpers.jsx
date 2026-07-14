import { useContext } from 'react';
import { Mail, Phone, MapPin, Globe } from 'lucide-react';
import { LinkedinIcon, GithubIcon } from '@/utils/brandIcons';
import { HeadingStyleContext } from '@/templates/headingStyle';
import { SectionCaseContext } from '@/templates/sectionCase';
import { contactHref, COLS } from '@/templates/templateShared';

export { COLS };
export const ROW_GAP = { compact: '4px', normal: '8px', relaxed: '14px' };

export function ContactRow({ personal, hidden, contactStyle, contactLayout, iconSize = 11 }) {
  const items = [
    { key: 'email',    Icon: Mail,         val: personal.email,    display: personal.email },
    { key: 'phone',    Icon: Phone,        val: personal.phone,    display: personal.phone },
    { key: 'location', Icon: MapPin,       val: personal.location, display: personal.location },
    { key: 'website',  Icon: Globe,        val: personal.website,  display: personal.websiteLabel || personal.website },
    { key: 'linkedin', Icon: LinkedinIcon, val: personal.linkedin, display: personal.linkedinLabel || personal.linkedin },
    { key: 'github',   Icon: GithubIcon,   val: personal.github,   display: personal.githubLabel || personal.github },
  ].filter(({ key, val }) => !hidden.has(key) && val);

  if (!items.length) return null;

  const layout = contactLayout || 'justify';
  const color = '#555';

  function decorated(key, Icon, val, display) {
    const href = contactHref(key, val, personal);
    const label = href
      ? <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>{display}</a>
      : display;
    if (contactStyle === 'icon') return (
      <span key={key} className="flex items-center gap-1.5" style={{ overflowWrap: 'anywhere' }}>
        <Icon size={iconSize} strokeWidth={2} className="shrink-0" />{label}
      </span>
    );
    if (contactStyle === 'bullet') return (
      <span key={key} className="flex items-center gap-1" style={{ overflowWrap: 'anywhere' }}>
        <span style={{ color: '#bbb' }}>•</span>{label}
      </span>
    );
    return <span key={key} style={{ overflowWrap: 'anywhere' }}>{label}</span>;
  }

  if (layout === 'single') {
    return (
      <div className="space-y-0.5" style={{ color }}>
        {items.map(({ key, Icon, val, display }) => <div key={key}>{decorated(key, Icon, val, display)}</div>)}
      </div>
    );
  }
  if (layout === '2grid') {
    return (
      <div style={{ color, display: 'grid', gridTemplateColumns: 'auto auto', justifyContent: 'start', gap: '2px 24px' }}>
        {items.map(({ key, Icon, val, display }) => decorated(key, Icon, val, display))}
      </div>
    );
  }
  if (contactStyle === 'icon') {
    return (
      <div className="flex flex-wrap" style={{ color, gap: '2px 16px' }}>
        {items.map(({ key, Icon, val, display }) => decorated(key, Icon, val, display))}
      </div>
    );
  }
  if (contactStyle === 'bullet') {
    return (
      <div className="flex flex-wrap items-center" style={{ color }}>
        {items.map(({ key, val, display }, i) => {
          const href = contactHref(key, val, personal);
          return (
            <span key={key} className="flex items-center">
              {i > 0 && <span className="mx-1.5" style={{ color: '#bbb' }}>•</span>}
              {href ? <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>{display}</a> : <span>{display}</span>}
            </span>
          );
        })}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center" style={{ color }}>
      {items.map(({ key, val, display }, i) => {
        const href = contactHref(key, val, personal);
        return (
          <span key={key} className="flex items-center">
            {i > 0 && <span className="mx-1.5" style={{ color: '#ccc' }}>|</span>}
            {href ? <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>{display}</a> : <span>{display}</span>}
          </span>
        );
      })}
    </div>
  );
}

export function ItemHeader({ title, subtitle, extra, date, titleStyle, centered, textColor }) {
  const ts = titleStyle || 'stacked';

  if (ts === 'sidebyside') {
    return (
      <div className={`flex ${centered ? 'flex-col items-center' : 'justify-between items-baseline'} gap-x-4`}>
        <div className={`flex items-baseline gap-3 flex-wrap min-w-0 ${centered ? 'justify-center' : ''}`}>
          <span className="font-semibold" style={{ color: textColor, fontSize: 'var(--fs-entry, 11pt)' }}>{title}</span>
          {(subtitle || extra) && <span style={{ color: '#555' }}>{subtitle}{extra}</span>}
        </div>
        {date && <span className="whitespace-nowrap shrink-0" style={{ color: '#4b5563' }}>{date}</span>}
      </div>
    );
  }

  return (
    <div className={`flex ${centered ? 'flex-col items-center' : 'justify-between items-start'} gap-x-4`}>
      <div className={centered ? 'text-center' : ''}>
        {ts === 'stacked' ? (
          <>
            <div className="font-semibold" style={{ color: textColor, fontSize: 'var(--fs-entry, 11pt)' }}>{title}</div>
            {(subtitle || extra) && <div style={{ color: '#555' }}>{subtitle}{extra}</div>}
          </>
        ) : (
          <div className={`flex items-baseline gap-1.5 flex-wrap ${centered ? 'justify-center' : ''}`}>
            <span className="font-semibold" style={{ color: textColor, fontSize: 'var(--fs-entry, 11pt)' }}>{title}</span>
            {subtitle && <span style={{ color: '#555' }}>— {subtitle}</span>}
            {extra}
          </div>
        )}
      </div>
      {date && <div className="whitespace-nowrap shrink-0" style={{ color: '#4b5563' }}>{date}</div>}
    </div>
  );
}

export function ItemDesc({ description, bullets }) {
  return (
    <>
      {description && (
        <div className="mt-1 rich-text-output" style={{ color: '#3d3d3d' }} dangerouslySetInnerHTML={{ __html: description }} />
      )}
      {bullets?.length > 0 && (
        <ul className="mt-1 space-y-0.5 pl-3" style={{ color: '#3d3d3d' }}>
          {bullets.map((b, i) => b && <li key={i} className="list-['–_']">{b}</li>)}
        </ul>
      )}
    </>
  );
}

export function SectionTitle({ title, centered, accent, borderColor }) {
  const style = useContext(HeadingStyleContext);
  const sectionCase = useContext(SectionCaseContext);
  const caseClass = sectionCase === 'normal' ? '' : 'uppercase';
  const tracking = sectionCase === 'normal' ? 'tracking-normal' : 'tracking-[0.08em]';
  const base = `font-semibold ${caseClass} ${tracking}`;
  const bc = borderColor || accent || '#64748b';
  const sizeStyle = { fontSize: 'var(--fs-section, 10pt)', color: '#374151' };
  const gap = { marginTop: 'var(--section-gap)', marginBottom: '6px' };

  if (style === 'plain') return (
    <h2 className={`${base} first:mt-0 ${centered ? 'text-center' : ''}`} style={{ ...sizeStyle, ...gap, color: accent }}>{title}</h2>
  );
  if (style === 'box') return (
    <div className={`first:mt-0 px-2 py-1 rounded ${centered ? 'text-center' : ''}`} style={{ ...gap, backgroundColor: bc + '12' }}>
      <h2 className={base} style={{ ...sizeStyle, color: accent }}>{title}</h2>
    </div>
  );
  if (style === 'ruled') return (
    <div className={`first:mt-0 ${centered ? 'text-center' : ''}`} style={gap}>
      <h2 className={base} style={sizeStyle}>{title}</h2>
      <div className="mt-0.5" style={{ height: 'var(--section-border-width,1px)', backgroundColor: borderColor || '#d1d5db' }} />
    </div>
  );
  if (style === 'leftbar') return (
    <div className={`first:mt-0 flex items-center gap-2 ${centered ? 'justify-center' : ''}`} style={gap}>
      <div className="self-stretch shrink-0 rounded-full" style={{ width: 'var(--section-border-width,1px)', backgroundColor: bc }} />
      <h2 className={`${base} whitespace-nowrap`} style={sizeStyle}>{title}</h2>
    </div>
  );
  if (style === 'line') return (
    <div className="flex items-center gap-2 first:mt-0" style={gap}>
      {centered && <div className="flex-1" style={{ height: 'var(--section-border-width,1px)', backgroundColor: borderColor || '#d1d5db' }} />}
      <h2 className={`${base} whitespace-nowrap`} style={{ ...sizeStyle, color: accent }}>{title}</h2>
      <div className="flex-1" style={{ height: 'var(--section-border-width,1px)', backgroundColor: borderColor || '#d1d5db' }} />
    </div>
  );
  // underline (default)
  return (
    <div className={`first:mt-0 ${centered ? 'text-center' : ''}`} style={gap}>
      <h2 className={`${base} pb-1`} style={{ ...sizeStyle, borderBottom: `var(--section-border-width,1px) solid ${borderColor || '#e5e7eb'}` }}>{title}</h2>
    </div>
  );
}
