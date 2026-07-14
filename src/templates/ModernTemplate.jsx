import { Mail, Phone, MapPin, Globe } from 'lucide-react';
import { LinkedinIcon, GithubIcon } from '@/utils/brandIcons';
import { getFontById } from '@/utils/fonts';
import { HeadingStyleContext } from '@/templates/headingStyle';
import { SectionCaseContext } from '@/templates/sectionCase';
import { isHtmlEmpty, modernPhotoStyle } from '@/templates/templateShared';
import { ContactLink } from '@/templates/ModernTemplateHelpers';
import { Section } from '@/templates/ModernTemplateSections';

export default function ModernTemplate({ data }) {
  const { personal, sections } = data;
  const st = data.settings || {};
  const fontFamily = st.customFont || getFontById(st.font)?.family || "'Inter', sans-serif";
  const accent = st.accentColor || '#2563eb';
  const textColor = st.textColor || '#1f2937';
  const borderColor = st.sectionBorderColor || '';
  const headerText = st.headerTextColor || '#ffffff';
  const nameColor = st.nameColor || headerText;
  const jobTitleColor = st.jobTitleColor || headerText;
  const hidden = new Set(personal?.hiddenFields || []);
  const baseSize = st.fontSizeBase || 11;
  const nameSize = baseSize + (st.fontSizeNameDelta ?? 8);
  const sectionSize = baseSize + (st.fontSizeSectionDelta ?? 1);
  const entrySize = baseSize + (st.fontSizeEntryDelta ?? 0);

  return (
    <SectionCaseContext.Provider value={st.sectionTitleCase || 'upper'}>
    <HeadingStyleContext.Provider value={st.headingStyle || 'line'}>
    <div style={{
      fontFamily,
      color: textColor,
      fontSize: baseSize + 'pt',
      lineHeight: st.lineHeightValue ?? 1.5,
      '--fs-base': baseSize + 'pt',
      '--fs-name': nameSize + 'pt',
      '--fs-section': sectionSize + 'pt',
      '--fs-entry': entrySize + 'pt',
      '--section-gap': (st.sectionGap ?? 16) + 'px',
      '--item-gap': (st.itemGap ?? 12) + 'px',
      '--section-border-width': (st.sectionBorderWidth ?? 1) + 'px',
    }}>
      <div className="px-6 py-5 rounded-sm" style={{ backgroundColor: accent, color: headerText, marginBottom: 'var(--section-gap)' }}>
        <div className="flex items-start gap-4">
          {personal.photo && !hidden.has('photo') && (
            <img src={personal.photo} alt="" style={modernPhotoStyle(st, '#ffffff')} />
          )}
          <div className="flex-1 min-w-0">
            <h1 className="font-bold tracking-tight mb-0.5" style={{ color: nameColor, fontSize: 'var(--fs-name, 19pt)' }}>{personal.name || 'Your Name'}</h1>
            {personal.title && <p className="opacity-80 mb-2" style={{ color: jobTitleColor, fontSize: 'var(--fs-entry, 11pt)' }}>{personal.title}</p>}
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 opacity-90" style={{ fontSize: baseSize + 'pt' }}>
              {!hidden.has('email')    && personal.email    && <span className="flex items-center gap-1"><Mail     size={9} strokeWidth={2}/><ContactLink ckey="email"    val={personal.email}   >{personal.email}</ContactLink></span>}
              {!hidden.has('phone')    && personal.phone    && <span className="flex items-center gap-1"><Phone    size={9} strokeWidth={2}/><ContactLink ckey="phone"    val={personal.phone}   >{personal.phone}</ContactLink></span>}
              {!hidden.has('location') && personal.location && <span className="flex items-center gap-1"><MapPin   size={9} strokeWidth={2}/>{personal.location}</span>}
              {!hidden.has('website')  && personal.website  && <span className="flex items-center gap-1"><Globe    size={9} strokeWidth={2}/><ContactLink ckey="website"  val={personal.website} >{personal.website}</ContactLink></span>}
              {!hidden.has('linkedin') && personal.linkedin && <span className="flex items-center gap-1"><LinkedinIcon size={9} strokeWidth={2}/><ContactLink ckey="linkedin" val={personal.linkedin}>{personal.linkedin}</ContactLink></span>}
              {!hidden.has('github')   && personal.github   && <span className="flex items-center gap-1"><GithubIcon   size={9} strokeWidth={2}/><ContactLink ckey="github"   val={personal.github}  >{personal.github}</ContactLink></span>}
            </div>
          </div>
        </div>
        {!isHtmlEmpty(personal.summary) && (
          <div className="mt-3 rich-text-output" style={{ opacity: 0.85 }} dangerouslySetInnerHTML={{ __html: personal.summary }} />
        )}
      </div>
      {sections.filter(s => s.visible !== false).map(s => {
        const ss = s.settings || {};
        const ov = {};
        if (ss.spaceBefore != null) ov.marginTop = ss.spaceBefore + 'px';
        if (ss.spaceAfter  != null) ov['--section-gap'] = ss.spaceAfter + 'px';
        if (ss.itemGap     != null) ov['--item-gap']    = ss.itemGap    + 'px';
        return <div key={s.id} style={ov}><Section section={s} accent={accent} borderColor={borderColor} textColor={textColor} /></div>;
      })}
    </div>
    </HeadingStyleContext.Provider>
    </SectionCaseContext.Provider>
  );
}
