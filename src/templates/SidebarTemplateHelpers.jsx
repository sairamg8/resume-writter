import { useContext } from 'react';
import { HeadingStyleContext } from '@/templates/headingStyle';
import { SectionCaseContext } from '@/templates/sectionCase';
import { contactHref as sharedContactHref } from '@/templates/templateShared';

export const ROW_GAP = { compact: '4px', normal: '8px', relaxed: '14px' };

/**
 * Main-column item title/date header supporting the three titleStyle variants
 * (mirrors src/templates/pdf/shared/PdfSections.jsx's ItemHeader), scaled to the
 * sidebar main column's smaller type (10px secondary/date text).
 */
export function MainItemHeader({ title, subtitle, extra, date, titleStyle, accent, textColor }) {
  const ts = titleStyle || 'stacked';
  const dateEl = date ? <div className="text-right whitespace-nowrap ml-2 shrink-0" style={{ color: '#9ca3af', fontSize: '10px' }}>{date}</div> : null;

  if (ts === 'sidebyside') {
    return (
      <div className="flex justify-between items-baseline">
        <div className="flex items-baseline gap-2 flex-wrap min-w-0">
          {title && <span className="font-semibold" style={{ color: textColor, fontSize: 'var(--fs-entry, 11pt)' }}>{title}</span>}
          {(subtitle || extra) && <span style={{ color: accent, opacity: 0.8, fontSize: '10px' }}>{subtitle}{extra}</span>}
        </div>
        {dateEl}
      </div>
    );
  }

  return (
    <div className="flex justify-between items-start">
      <div>
        {ts === 'stacked' ? (
          <>
            {title && <div className="font-semibold" style={{ color: textColor, fontSize: 'var(--fs-entry, 11pt)' }}>{title}</div>}
            {(subtitle || extra) && <div style={{ color: accent, opacity: 0.8, fontSize: '10px' }}>{subtitle}{extra}</div>}
          </>
        ) : (
          <div>
            {title && <span className="font-semibold" style={{ color: textColor, fontSize: 'var(--fs-entry, 11pt)' }}>{title}</span>}
            {subtitle && <span style={{ color: accent, opacity: 0.85, fontSize: '10px' }}> — {subtitle}</span>}
            {extra}
          </div>
        )}
      </div>
      {dateEl}
    </div>
  );
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
    border: br === 'none' ? 'none' : br === 'thin' ? '1.5px solid rgba(255,255,255,0.25)' : `2px solid ${accent}80`,
    objectFit: 'cover',
    display: 'block',
    margin: '0 auto 12px',
  };
}

export function ItemDesc({ description, bullets, accent, textColor }) {
  const bodyColor = textColor || '#374151';
  return (
    <>
      {description && (
        <div className="mt-1 rich-text-output" style={{ color: bodyColor }} dangerouslySetInnerHTML={{ __html: description }} />
      )}
      {bullets?.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {bullets.map((b, i) => b && (
            <li key={i} className="flex gap-1.5" style={{ color: bodyColor }}>
              <span className="shrink-0 mt-0.5" style={{ color: accent }}>•</span>
              {b}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export function MainTitle({ title, accent, borderColor }) {
  const style = useContext(HeadingStyleContext);
  const sectionCase = useContext(SectionCaseContext);
  const caseClass = sectionCase === 'normal' ? '' : 'uppercase';
  const tracking = sectionCase === 'normal' ? 'tracking-normal' : 'tracking-[0.06em]';
  const bc = borderColor || accent || '#374151';
  const useNeutral = style === 'ruled' || style === 'leftbar';
  const h2 = <h2 className={`font-bold ${caseClass} ${tracking}`} style={{ color: useNeutral ? '#374151' : accent, fontSize: 'var(--fs-section, 10pt)' }}>{title}</h2>;

  if (style === 'plain') return <div className="mb-2">{h2}</div>;
  if (style === 'underline') return <div className="mb-2 pb-1" style={{ borderBottom: `var(--section-border-width,1px) solid ${bc}` }}>{h2}</div>;
  if (style === 'box') return <div className="mb-2 px-2 py-1 rounded" style={{ backgroundColor: bc + '14' }}>{h2}</div>;
  if (style === 'ruled') return (
    <div className="mb-2">
      {h2}
      <div className="mt-0.5" style={{ height: 'var(--section-border-width,1px)', backgroundColor: borderColor || '#e5e7eb' }} />
    </div>
  );
  if (style === 'leftbar') return (
    <div className="mb-2 flex items-center gap-2">
      <div className="self-stretch shrink-0 rounded-full" style={{ width: 'var(--section-border-width,1px)', backgroundColor: bc }} />
      {h2}
    </div>
  );
  return (
    <div className="mb-2 flex items-center gap-2">
      {h2}
      <div className="flex-1" style={{ height: 'var(--section-border-width,1px)', backgroundColor: borderColor || '#e5e7eb' }} />
    </div>
  );
}

export function SideTitle({ title }) {
  return (
    <div className="mb-2">
      <h2 className="font-bold uppercase tracking-[0.12em] mb-1" style={{ color: '#94a3b8', fontSize: '9px' }}>{title}</h2>
      <div className="h-px" style={{ backgroundColor: '#334155' }} />
    </div>
  );
}

export function SideContact({ icon: Icon, label, text, display, ckey, iconSize = 8, accent, personal }) {
  const href = sharedContactHref(ckey, text, personal);
  return (
    <div>
      <div className="flex items-center gap-1" style={{ color: '#94a3b8', fontSize: '9px' }}>
        <Icon size={iconSize} strokeWidth={2} />
        <span className="uppercase tracking-wider font-bold">{label}</span>
      </div>
      <div style={{ color: '#cbd5e1', fontSize: '10px', wordBreak: 'break-all' }}>
        {href ? <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>{display || text}</a> : (display || text)}
      </div>
    </div>
  );
}
