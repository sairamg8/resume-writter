import { isHtmlEmpty } from '@/templates/templateShared';
import { SectionTitle, ItemDesc, ItemHeader, SKILL_ROW_GAP, COLS } from '@/templates/ClassicTemplateHelpers';

export function Section({ section, accent, borderColor, textColor }) {
  const p = { section, accent, borderColor, textColor };
  switch (section.type) {
    case 'experience':     return <ExperienceSection     {...p} />;
    case 'education':      return <EducationSection      {...p} />;
    case 'skills':         return <SkillsSection         {...p} />;
    case 'projects':       return <ProjectsSection       {...p} />;
    case 'languages':      return <LanguagesSection      {...p} />;
    case 'certifications': return <CertificationsSection {...p} />;
    case 'awards':         return <AwardsSection         {...p} />;
    case 'volunteering':   return <VolunteeringSection   {...p} />;
    case 'references':     return <ReferencesSection     {...p} />;
    case 'interests':      return <InterestsSection      {...p} />;
    default:               return <CustomSection         {...p} />;
  }
}

function ExperienceSection({ section, accent, borderColor, textColor }) {
  const s = section.settings || {};
  const rowGap = s.itemGap != null ? s.itemGap + 'px' : (SKILL_ROW_GAP[s.spacing] || SKILL_ROW_GAP.normal);
  const twoCol = s.columns > 1;
  const showDates = s.showDates !== false;
  const showLoc = s.showLocation !== false;
  const centered = s.alignment === 'center';
  const titleOrder = s.titleOrder || 'company';
  const visibleItems = section.items.filter(i => i.visible !== false);
  return (
    <div className={centered ? 'text-center' : ''} style={{ marginBottom: 'var(--section-gap)' }}>
      <SectionTitle title={section.title} accent={accent} borderColor={borderColor} centered={centered} />
      <div className={twoCol ? 'grid grid-cols-2' : 'flex flex-col'} style={{ gap: rowGap }}>
        {visibleItems.map(item => {
          const iH = new Set(item.hiddenFields || []);
          const company = iH.has('company') ? '' : item.company;
          const role = iH.has('role') ? '' : item.role;
          const loc = (!iH.has('location') && showLoc && item.location) ? item.location : null;
          const sd = iH.has('startDate') ? '' : (item.startDate || '');
          const ed = iH.has('endDate') ? '' : (item.current ? 'Present' : (item.endDate || ''));
          const dateStr = showDates && (sd || ed) ? `${sd}${ed ? ` – ${ed}` : ''}` : '';
          const desc = iH.has('description') ? '' : item.description;
          return (
            <div key={item.id}>
              <ItemHeader
                title={titleOrder === 'role' ? role : company}
                subtitle={titleOrder === 'role' ? company : role}
                extra={loc ? <span className="text-gray-400">, {loc}</span> : null}
                date={dateStr}
                titleStyle={s.titleStyle}
                centered={centered}
                accent={accent}
                textColor={textColor}
              />
              {!desc?.replace(/<[^>]*>/g, '').trim() ? null : <ItemDesc description={desc} bullets={item.bullets} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EducationSection({ section, accent, borderColor, textColor }) {
  const s = section.settings || {};
  const rowGap = s.itemGap != null ? s.itemGap + 'px' : (SKILL_ROW_GAP[s.spacing] || SKILL_ROW_GAP.normal);
  const twoCol = s.columns > 1;
  const showDates = s.showDates !== false;
  const showLoc = s.showLocation !== false;
  const centered = s.alignment === 'center';
  const visibleItems = section.items.filter(i => i.visible !== false);
  return (
    <div className={centered ? 'text-center' : ''} style={{ marginBottom: 'var(--section-gap)' }}>
      <SectionTitle title={section.title} accent={accent} borderColor={borderColor} centered={centered} />
      <div className={twoCol ? 'grid grid-cols-2' : 'flex flex-col'} style={{ gap: rowGap }}>
        {visibleItems.map(item => (
          <div key={item.id}>
            <ItemHeader
              title={item.institution}
              subtitle={item.degree}
              extra={
                <>
                  {item.fieldOfStudy && <span className="text-gray-400">, {item.fieldOfStudy}</span>}
                  {showLoc && item.location && <span className="text-gray-400"> · {item.location}</span>}
                  {item.gpa && <span className="text-gray-400"> · GPA: {item.gpa}</span>}
                </>
              }
              date={showDates && (item.startDate || item.endDate)
                ? `${item.startDate || ''}${item.endDate ? ` – ${item.endDate}` : ''}` : ''}
              titleStyle={s.titleStyle}
              centered={centered}
              accent={accent}
              textColor={textColor}
            />
            <ItemDesc description={item.description} bullets={item.bullets} />
          </div>
        ))}
      </div>
    </div>
  );
}

function SkillsSection({ section, accent, borderColor, textColor }) {
  const s = section.settings || {};
  const cols = s.columns || 1;
  const style = s.skillsStyle || 'inline';
  const centered = s.alignment === 'center';
  const sep = s.separator === 'dash' ? ' – ' : ': ';
  const rowGap = s.itemGap != null ? s.itemGap + 'px' : (SKILL_ROW_GAP[s.spacing] || SKILL_ROW_GAP.normal);
  const isBullet = style === 'bullet';
  const visibleItems = section.items.filter(i => i.visible !== false);

  return (
    <div className={centered ? 'text-center' : ''} style={{ marginBottom: 'var(--section-gap)' }}>
      <SectionTitle title={section.title} accent={accent} borderColor={borderColor} centered={centered} />
      {style === 'stacked' ? (
        <div className={`grid gap-x-4 ${COLS[cols] || 'grid-cols-1'}`} style={{ rowGap }}>
          {visibleItems.map(item => {
            const iH = item.hiddenFields || [];
            const showCat = item.category && !iH.includes('category');
            const showSk = item.skills && !iH.includes('skills');
            return (
              <div key={item.id}>
                {showCat && (
                  <div className="mb-1">
                    <div className="font-semibold" style={{ color: textColor, fontSize: 'var(--fs-entry, 11pt)' }}>{item.category}</div>
                    <div className="h-px mt-0.5" style={{ backgroundColor: '#e5e7eb' }} />
                  </div>
                )}
                {showSk && <div className="text-gray-600 mt-1">{item.skills}</div>}
              </div>
            );
          })}
        </div>
      ) : style === 'tags' ? (
        <div className={`grid gap-x-4 ${COLS[cols] || 'grid-cols-1'}`} style={{ rowGap }}>
          {visibleItems.map(item => {
            const iH = item.hiddenFields || [];
            const showCat = item.category && !iH.includes('category');
            const showSk = item.skills && !iH.includes('skills');
            return (
              <div key={item.id}>
                {showCat && <span className="font-bold uppercase tracking-wider block mb-1" style={{ color: accent }}>{item.category}</span>}
                {showSk && (
                  <div className={`flex flex-wrap gap-1 ${centered ? 'justify-center' : ''}`}>
                    {item.skills.split(',').map((sk, i) => sk.trim() && (
                      <span key={i} className="px-1.5 py-0.5 rounded" style={{ backgroundColor: accent + '15', color: accent, border: `1px solid ${accent}30` }}>
                        {sk.trim()}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <ul className={`grid gap-x-6 ${COLS[cols] || 'grid-cols-1'} ${isBullet ? 'list-disc pl-4' : 'list-none'}`} style={{ rowGap }}>
          {visibleItems.map(item => {
            const iH = item.hiddenFields || [];
            const showCat = item.category && !iH.includes('category');
            const showSk = item.skills && !iH.includes('skills');
            return (
              <li key={item.id} className="break-words">
                {showCat && <span className="font-semibold" style={{ color: textColor }}>{item.category}{showSk ? sep : ''}</span>}
                {showSk && <span className="text-gray-600">{item.skills}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ProjectsSection({ section, accent, borderColor, textColor }) {
  const s = section.settings || {};
  const rowGap = s.itemGap != null ? s.itemGap + 'px' : (SKILL_ROW_GAP[s.spacing] || SKILL_ROW_GAP.normal);
  const twoCol = s.columns > 1;
  const showDates = s.showDates !== false;
  const centered = s.alignment === 'center';
  const visibleItems = section.items.filter(i => i.visible !== false);
  return (
    <div className={centered ? 'text-center' : ''} style={{ marginBottom: 'var(--section-gap)' }}>
      <SectionTitle title={section.title} accent={accent} borderColor={borderColor} centered={centered} />
      <div className={twoCol ? 'grid grid-cols-2' : 'flex flex-col'} style={{ gap: rowGap }}>
        {visibleItems.map(item => (
          <div key={item.id}>
            <div className={`flex ${centered ? 'flex-col items-center' : 'justify-between items-start'}`}>
              <div>
                <span className="font-semibold text-xs" style={{ color: textColor }}>{item.name}</span>
                {item.technologies && <span className="text-gray-400"> · {item.technologies}</span>}
                {item.url && <span className="ml-1" style={{ color: accent }}> · {item.url}</span>}
              </div>
              {showDates && (item.startDate || item.endDate) && (
                <span className={`whitespace-nowrap shrink-0 ${centered ? '' : 'ml-2'}`} style={{ color: accent }}>
                  {item.startDate}{item.endDate ? ` – ${item.endDate}` : ''}
                </span>
              )}
            </div>
            <ItemDesc description={item.description} bullets={item.bullets} />
          </div>
        ))}
      </div>
    </div>
  );
}

function LanguagesSection({ section, accent, borderColor }) {
  const s = section.settings || {};
  const cols = s.columns || 2;
  const centered = s.alignment === 'center';
  const rowGap = s.itemGap != null ? s.itemGap + 'px' : (SKILL_ROW_GAP[s.spacing] || SKILL_ROW_GAP.normal);
  const visibleItems = section.items.filter(i => i.visible !== false);
  return (
    <div className={centered ? 'text-center' : ''} style={{ marginBottom: 'var(--section-gap)' }}>
      <SectionTitle title={section.title} accent={accent} borderColor={borderColor} centered={centered} />
      <div className={`grid gap-x-4 ${COLS[cols] || 'grid-cols-2'}`} style={{ rowGap }}>
        {visibleItems.map(item => (
          <div key={item.id} className="flex items-center justify-between">
            <span className="font-medium text-gray-900 text-xs">{item.language}</span>
            <span className="text-gray-400">{item.proficiency}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CertificationsSection({ section, accent, borderColor }) {
  const s = section.settings || {};
  const rowGap = s.itemGap != null ? s.itemGap + 'px' : (SKILL_ROW_GAP[s.spacing] || SKILL_ROW_GAP.normal);
  const showDates = s.showDates !== false;
  const centered = s.alignment === 'center';
  const visibleItems = section.items.filter(i => i.visible !== false);
  return (
    <div className={centered ? 'text-center' : ''} style={{ marginBottom: 'var(--section-gap)' }}>
      <SectionTitle title={section.title} accent={accent} borderColor={borderColor} centered={centered} />
      <div className="flex flex-col" style={{ gap: rowGap }}>
        {visibleItems.map(item => (
          <div key={item.id} className={`flex ${centered ? 'flex-col items-center' : 'justify-between items-start'}`}>
            <div>
              <span className="font-semibold text-gray-900 text-xs">{item.name}</span>
              {item.issuer && <span className="text-gray-500"> — {item.issuer}</span>}
              {item.credentialId && <span className="text-gray-400"> · ID: {item.credentialId}</span>}
              {item.url && (
                <a href={item.url.startsWith('http') ? item.url : `https://${item.url}`} target="_blank" rel="noopener noreferrer" className="ml-1" style={{ color: accent, textDecoration: 'none' }}>
                  · {item.urlLabel || item.url}
                </a>
              )}
            </div>
            {showDates && (item.date || item.expiry) && (
              <span className="whitespace-nowrap ml-2 shrink-0" style={{ color: accent }}>
                {item.date}{item.expiry ? ` – ${item.expiry}` : ''}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function AwardsSection({ section, accent, borderColor }) {
  const s = section.settings || {};
  const rowGap = s.itemGap != null ? s.itemGap + 'px' : (SKILL_ROW_GAP[s.spacing] || SKILL_ROW_GAP.normal);
  const showDates = s.showDates !== false;
  const centered = s.alignment === 'center';
  const visibleItems = section.items.filter(i => i.visible !== false);
  return (
    <div className={centered ? 'text-center' : ''} style={{ marginBottom: 'var(--section-gap)' }}>
      <SectionTitle title={section.title} accent={accent} borderColor={borderColor} centered={centered} />
      <div className="flex flex-col" style={{ gap: rowGap }}>
        {visibleItems.map(item => (
          <div key={item.id}>
            <div className={`flex ${centered ? 'flex-col items-center' : 'justify-between items-start'}`}>
              <div>
                <span className="font-semibold text-gray-900 text-xs">{item.title}</span>
                {item.issuer && <span className="text-gray-500"> — {item.issuer}</span>}
              </div>
              {showDates && item.date && (
                <span className="whitespace-nowrap ml-2 shrink-0" style={{ color: accent }}>{item.date}</span>
              )}
            </div>
            {!isHtmlEmpty(item.description) && (
              <p className="text-gray-600 mt-0.5 rich-text-output" dangerouslySetInnerHTML={{ __html: item.description }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function VolunteeringSection({ section, accent, borderColor, textColor }) {
  const s = section.settings || {};
  const rowGap = s.itemGap != null ? s.itemGap + 'px' : (SKILL_ROW_GAP[s.spacing] || SKILL_ROW_GAP.normal);
  const showDates = s.showDates !== false;
  const showLoc = s.showLocation !== false;
  const centered = s.alignment === 'center';
  const visibleItems = section.items.filter(i => i.visible !== false);
  return (
    <div className={centered ? 'text-center' : ''} style={{ marginBottom: 'var(--section-gap)' }}>
      <SectionTitle title={section.title} accent={accent} borderColor={borderColor} centered={centered} />
      <div className="flex flex-col" style={{ gap: rowGap }}>
        {visibleItems.map(item => (
          <div key={item.id}>
            <ItemHeader
              title={item.role}
              subtitle={item.org}
              extra={showLoc && item.location ? <span className="text-gray-400">, {item.location}</span> : null}
              date={showDates && (item.startDate || item.endDate)
                ? `${item.startDate || ''}${item.endDate ? ` – ${item.endDate}` : ''}` : ''}
              titleStyle={s.titleStyle}
              centered={centered}
              accent={accent}
              textColor={textColor}
            />
            <ItemDesc description={item.description} bullets={item.bullets} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ReferencesSection({ section, accent, borderColor }) {
  const s = section.settings || {};
  const cols = s.columns || 2;
  const centered = s.alignment === 'center';
  const rowGap = s.itemGap != null ? s.itemGap + 'px' : (SKILL_ROW_GAP[s.spacing] || SKILL_ROW_GAP.normal);
  const visibleItems = section.items.filter(i => i.visible !== false);
  return (
    <div className={centered ? 'text-center' : ''} style={{ marginBottom: 'var(--section-gap)' }}>
      <SectionTitle title={section.title} accent={accent} borderColor={borderColor} centered={centered} />
      <div className={`grid ${COLS[cols] || 'grid-cols-2'}`} style={{ gap: rowGap }}>
        {visibleItems.map(item => (
          <div key={item.id} className="p-2 rounded border border-gray-100">
            <p className="font-semibold text-gray-900 text-xs">{item.name}</p>
            {item.jobTitle && <p className="text-gray-500">{item.jobTitle}</p>}
            {item.company && <p className="text-gray-500">{item.company}</p>}
            {item.relationship && <p className="text-gray-400 italic">{item.relationship}</p>}
            {item.email && <p className="mt-0.5" style={{ color: accent }}>{item.email}</p>}
            {item.phone && <p className="text-gray-400">{item.phone}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function InterestsSection({ section, accent, borderColor }) {
  const s = section.settings || {};
  const centered = s.alignment === 'center';
  const tagGap = s.itemGap != null ? s.itemGap + 'px' : (SKILL_ROW_GAP[s.spacing] || '6px');
  const visibleItems = section.items.filter(i => i.visible !== false);
  return (
    <div style={{ marginBottom: 'var(--section-gap)' }}>
      <SectionTitle title={section.title} accent={accent} borderColor={borderColor} centered={centered} />
      <div className={`flex flex-wrap ${centered ? 'justify-center' : ''}`} style={{ gap: tagGap }}>
        {visibleItems.map(item =>
          (item.interests || '').split(',').map((interest, i) => interest.trim() && (
            <span key={`${item.id}-${i}`} className="px-2 py-0.5 rounded" style={{ backgroundColor: accent + '12', color: accent }}>
              {interest.trim()}
            </span>
          ))
        )}
      </div>
    </div>
  );
}

function CustomSection({ section, accent, borderColor, textColor }) {
  const s = section.settings || {};
  const rowGap = s.itemGap != null ? s.itemGap + 'px' : (SKILL_ROW_GAP[s.spacing] || SKILL_ROW_GAP.normal);
  const twoCol = s.columns > 1;
  const centered = s.alignment === 'center';
  const visibleItems = section.items.filter(i => i.visible !== false);
  return (
    <div className={centered ? 'text-center' : ''} style={{ marginBottom: 'var(--section-gap)' }}>
      <SectionTitle title={section.title} accent={accent} borderColor={borderColor} centered={centered} />
      <div className={twoCol ? 'grid grid-cols-2' : 'flex flex-col'} style={{ gap: rowGap }}>
        {visibleItems.map(item => (
          <div key={item.id}>
            <ItemHeader
              title={item.title}
              subtitle={item.subtitle}
              extra={item.location ? <span className="text-gray-400"> · {item.location}</span> : null}
              date={item.date || ''}
              titleStyle={s.titleStyle}
              centered={centered}
              accent={accent}
              textColor={textColor}
            />
            <ItemDesc description={item.description} bullets={item.bullets} />
          </div>
        ))}
      </div>
    </div>
  );
}
