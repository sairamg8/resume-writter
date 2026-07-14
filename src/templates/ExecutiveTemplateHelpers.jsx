import { useContext } from 'react';
import { Mail, Phone, MapPin, Globe } from 'lucide-react';
import { LinkedinIcon, GithubIcon } from '@/utils/brandIcons';
import { HeadingStyleContext } from '@/templates/headingStyle';
import { SectionCaseContext } from '@/templates/sectionCase';
import { contactHref, isHtmlEmpty, COLS } from '@/templates/templateShared';

export { COLS };
export const ROW_GAP = { compact: '4px', normal: '8px', relaxed: '14px' };
export const DATE_COLOR = '#4b5563';
export const SUB_COLOR  = '#4b5563';
export const BODY_COLOR = '#333333';

/**
 * Item title/date header supporting the three titleStyle variants (mirrors
 * src/templates/pdf/shared/PdfSections.jsx's ItemHeader so Canvas and the
 * exported PDF render the same layout for a given section.settings.titleStyle).
 */
export function ItemHeader({ primary, secondary, dateStr, loc, titleStyle = 'inline', centered = false, textColor }) {
  const dateBlock = (dateStr || loc) ? (
    <div className="shrink-0 text-right whitespace-nowrap" style={{ color: DATE_COLOR }}>
      {dateStr && <div>{dateStr}</div>}
      {loc && <div>{loc}</div>}
    </div>
  ) : null;

  if (titleStyle === 'stacked') {
    return (
      <div className={`flex ${centered ? 'flex-col items-center' : 'justify-between items-start'} gap-x-4`}>
        <div className={centered ? 'text-center' : 'min-w-0'}>
          <div className="font-bold" style={{ color: textColor, fontSize: 'var(--fs-entry, 11pt)' }}>{primary}</div>
          {secondary && <div className="italic" style={{ color: SUB_COLOR }}>{secondary}</div>}
        </div>
        {dateBlock}
      </div>
    );
  }
  if (titleStyle === 'sidebyside') {
    return (
      <div className={`flex ${centered ? 'flex-col items-center' : 'justify-between items-end'} gap-x-4`}>
        <div className={`flex flex-wrap items-baseline gap-1.5 ${centered ? 'justify-center' : ''}`}>
          <span className="font-bold" style={{ color: textColor, fontSize: 'var(--fs-entry, 11pt)' }}>{primary}</span>
          {secondary && <span className="italic" style={{ color: SUB_COLOR }}>{secondary}</span>}
        </div>
        {dateBlock}
      </div>
    );
  }
  // inline (default)
  return (
    <div className={`flex ${centered ? 'flex-col items-center' : 'justify-between items-start'} gap-x-4`}>
      <div className={centered ? 'text-center' : 'min-w-0'}>
        <span className="font-bold" style={{ color: textColor, fontSize: 'var(--fs-entry, 11pt)' }}>{primary}</span>
        {secondary && <span className="italic" style={{ color: SUB_COLOR }}>{', '}{secondary}</span>}
      </div>
      {dateBlock}
    </div>
  );
}

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
  const color = '#444444';

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
        <span style={{ color: '#999' }}>•</span>{label}
      </span>
    );
    return <span key={key} style={{ overflowWrap: 'anywhere' }}>{label}</span>;
  }

  if (layout === 'single') {
    return (
      <div className="mt-1 space-y-0.5" style={{ color }}>
        {items.map(({ key, Icon, val, display }) => <div key={key}>{decorated(key, Icon, val, display)}</div>)}
      </div>
    );
  }
  if (layout === '2grid') {
    return (
      <div className="mt-1" style={{ color, display: 'grid', gridTemplateColumns: 'auto auto', justifyContent: 'start', gap: '2px 24px' }}>
        {items.map(({ key, Icon, val, display }) => decorated(key, Icon, val, display))}
      </div>
    );
  }
  if (contactStyle === 'icon') {
    return (
      <div className="mt-1 flex flex-wrap" style={{ color, gap: '2px 16px' }}>
        {items.map(({ key, Icon, val, display }) => decorated(key, Icon, val, display))}
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
            {i > 0 && <span className="mx-2" style={{ color: '#ccc' }}>|</span>}
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
      {!isHtmlEmpty(description) && (
        <div className="mt-1 rich-text-output" style={{ color: BODY_COLOR }} dangerouslySetInnerHTML={{ __html: description }} />
      )}
      {bullets?.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {bullets.map((b, i) => b && (
            <li key={i} className="flex gap-1.5" style={{ color: BODY_COLOR }}>
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
  const headingStyle = useContext(HeadingStyleContext);
  const sectionCase = useContext(SectionCaseContext);
  const caseClass = sectionCase === 'normal' ? '' : 'uppercase';
  const tracking = sectionCase === 'normal' ? 'tracking-normal' : 'tracking-[0.06em]';
  const bc = borderColor || accent;

  const h2 = (
    <h2 className={`font-bold ${caseClass} ${tracking} whitespace-nowrap`} style={{ color: accent, fontSize: 'var(--fs-section, 10pt)' }}>
      {title}
    </h2>
  );

  if (headingStyle === 'plain') return <div className={`mb-2 ${centered ? 'text-center' : ''}`}>{h2}</div>;
  if (headingStyle === 'box') return (
    <div className={`mb-2 px-2 py-1 rounded ${centered ? 'text-center' : ''}`} style={{ backgroundColor: bc + '14' }}>{h2}</div>
  );
  if (headingStyle === 'ruled') return (
    <div className={`mb-2 ${centered ? 'text-center' : ''}`}>
      {h2}
      <div className="mt-0.5" style={{ height: 'var(--section-border-width,1px)', backgroundColor: borderColor || '#d1d5db' }} />
    </div>
  );
  if (headingStyle === 'leftbar') return (
    <div className={`mb-2 flex items-center gap-2 ${centered ? 'justify-center' : ''}`}>
      <div className="self-stretch shrink-0 rounded-full" style={{ width: 'var(--section-border-width,3px)', backgroundColor: bc }} />
      {h2}
    </div>
  );
  if (headingStyle === 'line') return (
    <div className="flex items-center gap-2 mb-2">
      {centered && <div className="flex-1" style={{ height: 'var(--section-border-width,1px)', backgroundColor: bc + '50' }} />}
      {h2}
      <div className="flex-1" style={{ height: 'var(--section-border-width,1px)', backgroundColor: bc + '50' }} />
    </div>
  );
  // underline (default)
  return (
    <div className={`mb-2 pb-1 ${centered ? 'text-center' : ''}`} style={{ borderBottom: `var(--section-border-width,1px) solid ${bc}` }}>
      {h2}
    </div>
  );
}
