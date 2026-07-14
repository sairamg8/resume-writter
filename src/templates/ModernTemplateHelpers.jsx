import { useContext } from 'react';
import { HeadingStyleContext } from '@/templates/headingStyle';
import { SectionCaseContext } from '@/templates/sectionCase';
import { COLS } from '@/templates/templateShared';

export { COLS };
export const ROW_GAP = { compact: '4px', normal: '8px', relaxed: '14px' };

export function contactHref(key, val) {
  if (key === 'email') return `mailto:${val}`;
  if (key === 'phone') return `tel:${val.replace(/\s/g, '')}`;
  if (key === 'website' || key === 'linkedin' || key === 'github') {
    return val.startsWith('http') ? val : `https://${val}`;
  }
  return null;
}

export function ContactLink({ ckey, val, children }) {
  const href = contactHref(ckey, val);
  if (!href) return <>{children}</>;
  return <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>{children}</a>;
}

export function ItemDesc({ description, bullets, bulletColor }) {
  return (
    <>
      {description && !description.replace(/<[^>]*>/g, '').trim() ? null : description && (
        <div className="mt-1 rich-text-output" style={{ color: 'inherit', opacity: 0.8 }} dangerouslySetInnerHTML={{ __html: description }} />
      )}
      {bullets?.length > 0 && (
        <ul className="mt-1 pl-3" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {bullets.map((b, i) => b && (
            <li key={i} className="relative pl-2">
              <span className="absolute left-0 top-[6px] w-1 h-1 rounded-full" style={{ backgroundColor: bulletColor }} />
              {b}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export function ItemHeader({ title, subtitle, extra, date, titleStyle, centered, accent, textColor }) {
  const ts = titleStyle || 'stacked';
  if (ts === 'sidebyside') {
    return (
      <div className={`flex ${centered ? 'flex-col items-center' : 'justify-between items-baseline'} gap-x-4`}>
        <div className={`flex items-baseline gap-2 flex-wrap min-w-0 ${centered ? 'justify-center' : ''}`}>
          <span className="font-bold" style={{ color: textColor, fontSize: 'var(--fs-entry, 11pt)' }}>{title}</span>
          {(subtitle || extra) && <span style={{ color: accent, opacity: 0.85 }}>{subtitle}{extra}</span>}
        </div>
        {date && <span className="whitespace-nowrap shrink-0 ml-2 font-medium" style={{ color: accent }}>{date}</span>}
      </div>
    );
  }
  return (
    <div className={`flex ${centered ? 'flex-col items-center' : 'justify-between items-start'} gap-x-3`}>
      <div className={centered ? 'text-center' : ''}>
        {ts === 'stacked' ? (
          <>
            <div className="font-bold" style={{ color: textColor, fontSize: 'var(--fs-entry, 11pt)' }}>{title}</div>
            {(subtitle || extra) && <div style={{ color: accent, opacity: 0.85 }}>{subtitle}{extra}</div>}
          </>
        ) : (
          <div>
            <span className="font-bold" style={{ color: textColor, fontSize: 'var(--fs-entry, 11pt)' }}>{title}</span>
            {subtitle && <span style={{ color: accent }}> — {subtitle}</span>}
            {extra}
          </div>
        )}
      </div>
      {date && (
        <span className={`whitespace-nowrap shrink-0 ${centered ? '' : 'ml-2'} font-medium`} style={{ color: accent }}>{date}</span>
      )}
    </div>
  );
}

export function SectionTitle({ title, accent, borderColor, centered }) {
  const style = useContext(HeadingStyleContext);
  const sectionCase = useContext(SectionCaseContext);
  const caseClass = sectionCase === 'normal' ? '' : 'uppercase';
  const tracking = sectionCase === 'normal' ? 'tracking-normal' : 'tracking-widest';
  const bc = borderColor || accent;
  const h2 = (
    <h2 className={`font-bold ${caseClass} ${tracking} whitespace-nowrap`} style={{ color: accent, fontSize: 'var(--fs-section, 10pt)' }}>
      {title}
    </h2>
  );

  if (style === 'plain') return <div className={`mb-2 ${centered ? 'text-center' : ''}`}>{h2}</div>;
  if (style === 'underline') return <div className={`mb-2 pb-1 ${centered ? 'text-center' : ''}`} style={{ borderBottom: `var(--section-border-width,1px) solid ${bc}` }}>{h2}</div>;
  if (style === 'box') return <div className={`mb-2 px-2 py-1 rounded ${centered ? 'text-center' : ''}`} style={{ backgroundColor: accent + '14' }}>{h2}</div>;
  if (style === 'ruled') return (
    <div className={`mb-2 ${centered ? 'text-center' : ''}`}>
      {h2}
      <div className="mt-0.5" style={{ height: 'var(--section-border-width,1px)', backgroundColor: borderColor || accent + '30' }} />
    </div>
  );
  if (style === 'leftbar') return (
    <div className={`mb-2 flex items-center gap-2 ${centered ? 'justify-center' : ''}`}>
      <div className="self-stretch shrink-0 rounded-full" style={{ width: 'var(--section-border-width,1px)', backgroundColor: bc }} />
      {h2}
    </div>
  );
  // 'line' — Modern default
  return (
    <div className="flex items-center gap-2 mb-2">
      {centered && <div className="flex-1 h-px" style={{ backgroundColor: borderColor || accent + '30' }} />}
      {h2}
      <div className="flex-1 h-px" style={{ backgroundColor: borderColor || accent + '30' }} />
    </div>
  );
}
