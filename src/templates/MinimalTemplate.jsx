import { getFontById } from '@/utils/fonts';
import { HeadingStyleContext } from '@/templates/headingStyle';
import { SectionCaseContext } from '@/templates/sectionCase';
import { photoStyle, isHtmlEmpty } from '@/templates/templateShared';
import { ContactRow } from '@/templates/MinimalTemplateHelpers';
import { Section } from '@/templates/MinimalTemplateSections';

export default function MinimalTemplate({ data }) {
  const { personal, sections } = data;
  const st = data.settings || {};
  const fontFamily = st.customFont || getFontById(st.font)?.family || "'Inter', sans-serif";
  const accent = st.accentColor || '#2563eb';
  const borderColor = st.sectionBorderColor || '';
  const textColor = st.textColor || '#1a1a1a';
  const nameColor = st.nameColor || textColor;
  const jobTitleColor = st.jobTitleColor || '#555';
  const headerAlign = st.headerAlign || 'left';
  const headerLayout = st.headerLayout || 'stack';
  const contactStyle = st.contactStyle || 'bar';
  const contactLayout = st.contactLayout || 'justify';
  const centered = headerAlign === 'center';
  const hidden = new Set(personal?.hiddenFields || []);
  const baseSize = st.fontSizeBase || 11;
  const nameSize = baseSize + (st.fontSizeNameDelta ?? 8);
  const sectionSize = baseSize + (st.fontSizeSectionDelta ?? 1);
  const entrySize = baseSize + (st.fontSizeEntryDelta ?? 0);
  const contactProps = { personal, hidden, contactStyle, contactLayout, iconSize: st.iconSize ?? 11, settings: st };

  const NameTitle = () => headerLayout === 'inline' ? (
    <div className={`flex flex-wrap items-baseline ${centered ? 'justify-center' : ''}`} style={{ gap: `${st.headerInlineGap ?? 8}px` }}>
      <h1 className="font-light tracking-tight" style={{ color: nameColor, fontSize: 'var(--fs-name, 19pt)' }}>{personal.name || 'Your Name'}</h1>
      {personal.title && <span style={{ color: jobTitleColor, fontSize: 'var(--fs-entry, 11pt)' }}>{personal.title}</span>}
    </div>
  ) : (
    <>
      <h1 className="font-light tracking-tight" style={{ color: nameColor, fontSize: 'var(--fs-name, 19pt)' }}>{personal.name || 'Your Name'}</h1>
      {personal.title && <p className="mb-1" style={{ color: jobTitleColor, fontSize: 'var(--fs-entry, 11pt)' }}>{personal.title}</p>}
    </>
  );

  return (
    <SectionCaseContext.Provider value={st.sectionTitleCase || 'upper'}>
    <HeadingStyleContext.Provider value={st.headingStyle || 'underline'}>
      <div style={{ fontFamily, color: textColor, fontSize: baseSize + 'pt', lineHeight: st.lineHeightValue ?? 1.5, '--fs-base': baseSize + 'pt', '--fs-name': nameSize + 'pt', '--fs-section': sectionSize + 'pt', '--fs-entry': entrySize + 'pt', '--section-gap': (st.sectionGap ?? 16) + 'px', '--item-gap': (st.itemGap ?? 12) + 'px', '--section-border-width': (st.sectionBorderWidth ?? 1) + 'px' }}>
        <div className="mb-5">
          <div className={`flex ${centered ? 'flex-col items-center text-center' : (st.photoTextAlign === 'center' ? 'items-center' : st.photoTextAlign === 'bottom' ? 'items-end' : 'items-start')} gap-3`}>
            {personal.photo && !hidden.has('photo') && (
              <img src={personal.photo} alt="" style={photoStyle(st, accent)} />
            )}
            <div className={centered ? 'text-center' : 'flex-1'}>
              <NameTitle />
              <ContactRow {...contactProps} />
            </div>
          </div>
          {!hidden.has('summary') && !isHtmlEmpty(personal.summary) && (
            <div className="mt-3 border-l-2 pl-3 italic rich-text-output" style={{ color: '#555', borderColor: accent + '60' }} dangerouslySetInnerHTML={{ __html: personal.summary }} />
          )}
        </div>
        {sections.filter(s => s.visible !== false).map(s => {
          const ss = s.settings || {};
          const ov = {};
          if (ss.spaceBefore != null) ov.marginTop = ss.spaceBefore + 'px';
          if (ss.spaceAfter  != null) ov['--section-gap'] = ss.spaceAfter + 'px';
          if (ss.itemGap     != null) ov['--item-gap']    = ss.itemGap    + 'px';
          return <div key={s.id} style={ov}><Section section={s} accent={accent} textColor={textColor} borderColor={borderColor} /></div>;
        })}
      </div>
    </HeadingStyleContext.Provider>
    </SectionCaseContext.Provider>
  );
}
