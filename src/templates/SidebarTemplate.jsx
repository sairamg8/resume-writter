import { Mail, Phone, MapPin, Globe } from 'lucide-react';
import { LinkedinIcon, GithubIcon } from '@/utils/brandIcons';
import { getFontById } from '@/utils/fonts';
import { HeadingStyleContext } from '@/templates/headingStyle';
import { SectionCaseContext } from '@/templates/sectionCase';
import { ROW_GAP, photoStyle, MainTitle, SideTitle, SideContact } from '@/templates/SidebarTemplateHelpers';
import { SideSkills, SideEducation, SideLanguages, SideCertifications, SideInterests, SideReferences } from '@/templates/SidebarTemplateSideSections';
import { MainExperience, MainProjects, MainAwards, MainVolunteering, MainCustom } from '@/templates/SidebarTemplateMainSections';

const SIDEBAR_TYPES = new Set(['skills', 'education', 'languages', 'certifications', 'interests', 'references']);

export default function SidebarTemplate({ data }) {
  const { personal, sections } = data;
  const st = data.settings || {};
  const fontFamily    = st.customFont || getFontById(st.font)?.family || "'Inter', sans-serif";
  const accent        = st.accentColor        || '#2563eb';
  const textColor     = st.textColor          || '#1e293b';
  const sidebarBg     = st.sidebarBg          || '#1e293b';
  const headerText    = st.headerTextColor    || '#ffffff';
  const nameColor     = st.nameColor          || headerText;
  const jobTitleColor = st.jobTitleColor      || accent;
  const borderColor   = st.sectionBorderColor || '';
  const hidden = new Set(personal?.hiddenFields || []);

  const baseSize    = st.fontSizeBase || 11;
  const nameSize    = baseSize + (st.fontSizeNameDelta    ?? 8);
  const sectionSize = baseSize + (st.fontSizeSectionDelta ?? 1);
  const entrySize   = baseSize + (st.fontSizeEntryDelta   ?? 0);

  const visibleSections = sections.filter(s => s.visible !== false);
  const sidebarSections = visibleSections.filter(s =>  SIDEBAR_TYPES.has(s.type));
  const mainSections    = visibleSections.filter(s => !SIDEBAR_TYPES.has(s.type));

  const cp = { iconSize: st.iconSize ?? 8, accent, personal };

  function applySpacing(ss) {
    const ov = {};
    if (ss.spaceBefore != null) ov.marginTop = ss.spaceBefore + 'px';
    if (ss.spaceAfter  != null) ov['--section-gap'] = ss.spaceAfter + 'px';
    if (ss.itemGap     != null) ov['--item-gap']    = ss.itemGap + 'px';
    else if (ss.spacing)        ov['--item-gap']    = ROW_GAP[ss.spacing] || ROW_GAP.normal;
    return ov;
  }

  function renderSide(section) {
    switch (section.type) {
      case 'skills':         return <SideSkills         key={section.id} section={section} accent={accent} />;
      case 'education':      return <SideEducation      key={section.id} section={section} />;
      case 'languages':      return <SideLanguages      key={section.id} section={section} />;
      case 'certifications': return <SideCertifications key={section.id} section={section} />;
      case 'interests':      return <SideInterests      key={section.id} section={section} />;
      case 'references':     return <SideReferences     key={section.id} section={section} />;
      default:               return null;
    }
  }

  function renderMain(section) {
    const props = { key: section.id, section, accent, borderColor, textColor };
    switch (section.type) {
      case 'experience':   return <MainExperience   {...props} />;
      case 'projects':     return <MainProjects     {...props} />;
      case 'awards':       return <MainAwards       {...props} />;
      case 'volunteering': return <MainVolunteering {...props} />;
      default:             return <MainCustom       {...props} />;
    }
  }

  const cssVars = {
    fontFamily, color: textColor, fontSize: baseSize + 'pt',
    lineHeight: st.lineHeightValue ?? 1.5, minHeight: '100%',
    '--fs-base': baseSize + 'pt', '--fs-name': nameSize + 'pt',
    '--fs-section': sectionSize + 'pt', '--fs-entry': entrySize + 'pt',
    '--section-gap': (st.sectionGap ?? 16) + 'px', '--item-gap': (st.itemGap ?? 12) + 'px',
    '--section-border-width': (st.sectionBorderWidth ?? 1) + 'px',
  };

  return (
    <SectionCaseContext.Provider value={st.sectionTitleCase || 'upper'}>
    <HeadingStyleContext.Provider value={st.headingStyle || 'line'}>
    <div className="flex" style={cssVars}>
      <div className="w-[38%] shrink-0 px-4 py-5" style={{ backgroundColor: sidebarBg, color: '#e2e8f0' }}>
        <div className="mb-5 text-center">
          {personal.photo && !hidden.has('photo') && (
            <img src={personal.photo} alt="" style={photoStyle(st, accent)} />
          )}
          <h1 className="font-bold leading-tight" style={{ color: nameColor, fontSize: 'var(--fs-name, 19pt)' }}>{personal.name || 'Your Name'}</h1>
          {personal.title && <p className="mt-0.5" style={{ color: jobTitleColor, fontSize: 'var(--fs-entry, 10pt)' }}>{personal.title}</p>}
        </div>
        <div style={{ marginBottom: 'var(--section-gap)' }}>
          <SideTitle title="Contact" />
          <div className="space-y-1.5">
            {!hidden.has('email')    && personal.email    && <SideContact icon={Mail}         ckey="email"    label="Email"    text={personal.email}    {...cp} />}
            {!hidden.has('phone')    && personal.phone    && <SideContact icon={Phone}        ckey="phone"    label="Phone"    text={personal.phone}    {...cp} />}
            {!hidden.has('location') && personal.location && <SideContact icon={MapPin}       ckey="location" label="Location" text={personal.location} {...cp} />}
            {!hidden.has('website')  && personal.website  && <SideContact icon={Globe}        ckey="website"  label="Website"  text={personal.website}  display={personal.websiteLabel  || personal.website}  {...cp} />}
            {!hidden.has('linkedin') && personal.linkedin && <SideContact icon={LinkedinIcon} ckey="linkedin" label="LinkedIn" text={personal.linkedin} display={personal.linkedinLabel || personal.linkedin} {...cp} />}
            {!hidden.has('github')   && personal.github   && <SideContact icon={GithubIcon}   ckey="github"   label="GitHub"   text={personal.github}   display={personal.githubLabel  || personal.github}   {...cp} />}
          </div>
        </div>
        {sidebarSections.map(section => (
          <div key={section.id} style={applySpacing(section.settings || {})}>{renderSide(section)}</div>
        ))}
      </div>
      <div className="flex-1 px-5 py-5" style={{ color: textColor }}>
        {!hidden.has('summary') && personal.summary && personal.summary.replace(/<[^>]*>/g, '').trim() && (
          <div style={{ marginBottom: 'var(--section-gap)' }}>
            <MainTitle title="About Me" accent={accent} borderColor={borderColor} />
            <div className="rich-text-output" style={{ color: textColor }} dangerouslySetInnerHTML={{ __html: personal.summary }} />
          </div>
        )}
        {mainSections.map(section => (
          <div key={section.id} style={applySpacing(section.settings || {})}>{renderMain(section)}</div>
        ))}
      </div>
    </div>
    </HeadingStyleContext.Provider>
    </SectionCaseContext.Provider>
  );
}
