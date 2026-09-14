import { useContext } from 'react';
import { HeadingStyleContext } from '@/templates/headingStyle';
import { SectionCaseContext } from '@/templates/sectionCase';
import { contactHref, COLS } from '@/templates/templateShared';
import { ContactIcon } from '@/utils/contactIcons';

export { COLS };
export const SKILL_ROW_GAP = { compact: '4px', normal: '8px', relaxed: '14px' };

export function ContactRow({ personal, hidden, contactStyle, contactLayout, iconSize = 11, settings }) {
  const items = [
    { key: 'email',    val: personal.email,    display: personal.email },
    { key: 'phone',    val: personal.phone,    display: personal.phone },
    { key: 'location', val: personal.location, display: personal.location },
    { key: 'website',  val: personal.website,  display: personal.websiteLabel || personal.website },
    { key: 'linkedin', val: personal.linkedin, display: personal.linkedinLabel || personal.linkedin },
    { key: 'github',   val: personal.github,   display: personal.githubLabel || personal.github },
  ].filter(({ key, val }) => !hidden.has(key) && val);

  if (!items.length) return null;

  const layout = contactLayout || 'justify';
  const color = '#555';

  function decorated(key, val, display) {
    const href = contactHref(key, val, personal);
    const label = href
      ? <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>{display}</a>
      : display;
    if (contactStyle === 'icon') return (
      <span key={key} className="flex items-center gap-1.5" style={{ overflowWrap: 'anywhere' }}>
        <ContactIcon field={key} settings={settings} size={iconSize} strokeWidth={2} className="shrink-0" />
        {label}
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
      <div className="mt-1 space-y-0.5" style={{ color }}>
        {items.map(({ key, val, display }) => <div key={key}>{decorated(key, val, display)}</div>)}
      </div>
    );
  }
  if (layout === '2grid') {
    return (
      <div className="mt-1" style={{ color, display: 'grid', gridTemplateColumns: 'auto auto', justifyContent: 'start', gap: '2px 24px' }}>
        {items.map(({ key, val, display }) => decorated(key, val, display))}
      </div>
    );
  }
  // justify (default)
  if (contactStyle === 'icon') {
    return (
      <div className="mt-1 flex flex-wrap" style={{ color, gap: '2px 16px' }}>
        {items.map(({ key, val, display }) => decorated(key, val, display))}
      </div>
    );
  }
  if (contactStyle === 'bullet') {
    return (
      <div className="mt-1 flex flex-wrap items-center" style={{ color }}>
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
    <div className="mt-1 flex flex-wrap items-center" style={{ color }}>
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

export function ItemDesc({ description, bullets }) {
  return (
    <>
      {description && (
        <div className="mt-1 rich-text-output" style={{ color: '#333333' }} dangerouslySetInnerHTML={{ __html: description }} />
      )}
      {bullets?.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {bullets.map((b, i) => b && (
            <li key={i} className="flex gap-1.5" style={{ color: '#333333' }}>
              <span className="shrink-0 mt-0.5" style={{ color: '#6b7280' }}>•</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export function SectionTitle({ title, accent, borderColor, centered }) {
  const style = useContext(HeadingStyleContext);
  const sectionCase = useContext(SectionCaseContext);
  const caseClass = sectionCase === 'normal' ? '' : 'uppercase';
  const tracking = sectionCase === 'normal' ? 'tracking-normal' : 'tracking-[0.06em]';
  const bc = borderColor || accent;
  const coloredH2 = (
    <h2 className={`font-bold ${caseClass} ${tracking} whitespace-nowrap`} style={{ color: accent, fontSize: 'var(--fs-section, 10pt)' }}>{title}</h2>
  );
  const neutralH2 = (
    <h2 className={`font-bold ${caseClass} ${tracking} whitespace-nowrap`} style={{ color: '#374151', fontSize: 'var(--fs-section, 10pt)' }}>{title}</h2>
  );

  if (style === 'plain') return <div className={`mb-2 ${centered ? 'text-center' : ''}`}>{coloredH2}</div>;
  if (style === 'underline') return <div className={`mb-2 pb-1 ${centered ? 'text-center' : ''}`} style={{ borderBottom: `var(--section-border-width,1px) solid ${bc}` }}>{coloredH2}</div>;
  if (style === 'box') return (
    <div className={`mb-2 px-2 py-1 rounded ${centered ? 'text-center' : ''}`} style={{ backgroundColor: bc + '14' }}>{coloredH2}</div>
  );
  if (style === 'ruled') return (
    <div className={`mb-2 ${centered ? 'text-center' : ''}`}>
      {neutralH2}
      <div className="mt-0.5" style={{ height: 'var(--section-border-width,1px)', backgroundColor: borderColor || '#e5e7eb' }} />
    </div>
  );
  if (style === 'leftbar') return (
    <div className={`mb-2 flex items-center gap-2 ${centered ? 'justify-center' : ''}`}>
      <div className="self-stretch shrink-0 rounded-full" style={{ width: 'var(--section-border-width,1px)', backgroundColor: bc }} />
      {neutralH2}
    </div>
  );
  const lineColor = borderColor || (accent + '40');
  return (
    <div className="flex items-center gap-2 mb-2">
      {centered && <div className="flex-1" style={{ height: 'var(--section-border-width,1px)', backgroundColor: lineColor }} />}
      {coloredH2}
      <div className="flex-1" style={{ height: 'var(--section-border-width,1px)', backgroundColor: lineColor }} />
    </div>
  );
}

export function ItemHeader({ title, subtitle, extra, date, titleStyle, centered, accent, textColor }) {
  const ts = titleStyle || 'stacked';

  if (ts === 'sidebyside') {
    return (
      <div className={`flex ${centered ? 'flex-col items-center' : 'justify-between items-baseline'} gap-x-4`}>
        <div className={`flex items-baseline gap-3 flex-wrap min-w-0 ${centered ? 'justify-center' : ''}`}>
          <span className="font-semibold" style={{ color: textColor, fontSize: 'var(--fs-entry, 11pt)' }}>{title}</span>
          {(subtitle || extra) && <span style={{ color: '#4b5563' }}>{subtitle}{extra}</span>}
        </div>
        {date && <span className="whitespace-nowrap shrink-0 ml-2" style={{ color: accent }}>{date}</span>}
      </div>
    );
  }

  return (
    <div className={`flex ${centered ? 'flex-col items-center' : 'justify-between items-start'} gap-x-3`}>
      <div className={centered ? 'text-center' : ''}>
        {ts === 'stacked' ? (
          <>
            <div className="font-semibold" style={{ color: textColor, fontSize: 'var(--fs-entry, 11pt)' }}>{title}</div>
            {(subtitle || extra) && <div style={{ color: '#4b5563' }}>{subtitle}{extra}</div>}
          </>
        ) : (
          <div>
            <span className="font-semibold" style={{ color: textColor, fontSize: 'var(--fs-entry, 11pt)' }}>{title}</span>
            {subtitle && <span style={{ color: '#4b5563' }}> — {subtitle}</span>}
            {extra}
          </div>
        )}
      </div>
      {date && (
        <span className={`whitespace-nowrap shrink-0 ${centered ? '' : 'ml-2'}`} style={{ color: accent }}>{date}</span>
      )}
    </div>
  );
}
