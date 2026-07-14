import { isHtmlEmpty } from '@/templates/templateShared';
import { SectionTitle, ItemDesc, ItemHeader, ROW_GAP, COLS } from '@/templates/ModernTemplateHelpers';

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
  const rowGap = s.itemGap != null ? s.itemGap + 'px' : (ROW_GAP[s.spacing] || ROW_GAP.normal);
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
                extra={loc ? <span style={{ opacity: 0.5 }}> · {loc}</span> : null}
                date={dateStr}
                titleStyle={s.titleStyle}
                centered={centered}
                accent={accent}
                textColor={textColor}
              />
              {!isHtmlEmpty(desc) && <ItemDesc description={desc} bullets={item.bullets} bulletColor={accent} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EducationSection({ section, accent, borderColor, textColor }) {
  const s = section.settings || {};
  const rowGap = s.itemGap != null ? s.itemGap + 'px' : (ROW_GAP[s.spacing] || ROW_GAP.normal);
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
                  {item.fieldOfStudy && <span style={{ opacity: 0.5 }}> · {item.fieldOfStudy}</span>}
                  {showLoc && item.location && <span style={{ opacity: 0.5 }}> · {item.location}</span>}
                  {item.gpa && <span style={{ opacity: 0.5 }}> · GPA: {item.gpa}</span>}
                </>
              }
              date={showDates && (item.startDate || item.endDate)
                ? `${item.startDate || ''}${item.endDate ? ` – ${item.endDate}` : ''}` : ''}
              titleStyle={s.titleStyle}
              centered={centered}
              accent={accent}
              textColor={textColor}
            />
            <ItemDesc description={item.description} bullets={item.bullets} bulletColor={accent} />
          </div>
        ))}
      </div>
    </div>
  );
}

function SkillsSection({ section, accent, textColor, borderColor }) {
  const s = section.settings || {};
  const rowGap = s.itemGap != null ? s.itemGap + 'px' : (ROW_GAP[s.spacing] || ROW_GAP.normal);
  const cols = s.columns || 1;
  const style = s.skillsStyle || 'inline';
  const centered = s.alignment === 'center';
  const sep = s.separator === 'dash' ? ' – ' : ': ';
  const isBullet = style === 'bullet';
  const visibleItems = section.items.filter(i => i.visible !== false);
  return (
    <div className={centered ? 'text-center' : ''} style={{ marginBottom: 'var(--section-gap)' }}>
      <SectionTitle title={section.title} accent={accent} borderColor={borderColor} centered={centered} />
      {style === 'stacked' ? (
        <div className={`grid gap-x-4 ${COLS[cols] || 'grid-cols-1'}`} style={{ gap: rowGap }}>
          {visibleItems.map(item => {
            const iH = item.hiddenFields || [];
            const showCat = item.category && !iH.includes('category');
            const showSk = item.skills && !iH.includes('skills');
            return (
              <div key={item.id}>
                {showCat && (
                  <div className="mb-1">
                    <div className="font-bold" style={{ color: textColor, fontSize: 'var(--fs-entry, 11pt)' }}>{item.category}</div>
                    <div className="h-px mt-0.5" style={{ backgroundColor: accent + '30' }} />
                  </div>
                )}
                {showSk && <div className="mt-1" style={{ opacity: 0.85 }}>{item.skills}</div>}
              </div>
            );
          })}
        </div>
      ) : style === 'bars' ? (
        <div className={`grid gap-x-6 ${COLS[cols] || 'grid-cols-1'}`} style={{ gap: rowGap }}>
          {visibleItems.map(item => (
            <div key={item.id}>
              {item.category && <span className="font-bold uppercase tracking-wider mr-2" style={{ color: accent }}>{item.category}:</span>}
              {(item.skills || '').split(',').map((sk, i) => sk.trim() && (
                <div key={i} className="flex items-center gap-2 mt-1">
                  <span className="w-24 shrink-0" style={{ opacity: 0.8 }}>{sk.trim()}</span>
                  <div className="flex-1 h-1.5 rounded-full" style={{ backgroundColor: accent + '20' }}>
                    <div className="h-1.5 rounded-full w-4/5" style={{ backgroundColor: accent + '70' }} />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : style === 'tags' ? (
        <div className={`grid ${COLS[cols] || 'grid-cols-1'}`} style={{ gap: rowGap }}>
          {visibleItems.map(item => (
            <div key={item.id}>
              {item.category && <span className="font-bold uppercase tracking-wider block mb-1" style={{ color: accent }}>{item.category}</span>}
              <div className={`flex flex-wrap gap-1 ${centered ? 'justify-center' : ''}`}>
                {(item.skills || '').split(',').map((sk, i) => sk.trim() && (
                  <span key={i} className="px-1.5 py-0.5 rounded border" style={{ backgroundColor: accent + '10', color: accent, borderColor: accent + '30' }}>
                    {sk.trim()}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <ul className={`grid gap-x-6 ${COLS[cols] || 'grid-cols-1'} ${isBullet ? 'list-disc pl-4' : 'list-none'}`} style={{ gap: rowGap }}>
          {visibleItems.map(item => {
            const iH = item.hiddenFields || [];
            const showCat = item.category && !iH.includes('category');
            const showSk = item.skills && !iH.includes('skills');
            return (
              <li key={item.id} className="break-words">
                {showCat && <span className="font-bold" style={{ color: accent }}>{item.category}{showSk ? sep : ''}</span>}
                {showSk && <span style={{ opacity: 0.85 }}>{item.skills}</span>}
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
  const rowGap = s.itemGap != null ? s.itemGap + 'px' : (ROW_GAP[s.spacing] || ROW_GAP.normal);
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
                <span className="font-bold" style={{ color: textColor, fontSize: 'var(--fs-entry, 11pt)' }}>{item.name}</span>
                {item.technologies && <span style={{ opacity: 0.6 }}> · {item.technologies}</span>}
                {item.url && <span className="ml-1" style={{ color: accent }}> · {item.url}</span>}
              </div>
              {showDates && (item.startDate || item.endDate) && (
                <span className="whitespace-nowrap ml-2 shrink-0 font-medium" style={{ color: accent }}>
                  {item.startDate}{item.endDate ? ` – ${item.endDate}` : ''}
                </span>
              )}
            </div>
            <ItemDesc description={item.description} bullets={item.bullets} bulletColor={accent} />
          </div>
        ))}
      </div>
    </div>
  );
}

function LanguagesSection({ section, accent, borderColor, textColor }) {
  const s = section.settings || {};
  const cols = s.columns || 2;
  const centered = s.alignment === 'center';
  const rowGap = s.itemGap != null ? s.itemGap + 'px' : (ROW_GAP[s.spacing] || ROW_GAP.normal);
  const visibleItems = section.items.filter(i => i.visible !== false);
  return (
    <div className={centered ? 'text-center' : ''} style={{ marginBottom: 'var(--section-gap)' }}>
      <SectionTitle title={section.title} accent={accent} borderColor={borderColor} centered={centered} />
      <div className={`grid gap-x-4 ${COLS[cols] || 'grid-cols-2'}`} style={{ gap: rowGap }}>
        {visibleItems.map(item => (
          <div key={item.id} className={`flex ${centered ? 'justify-center gap-2' : 'items-center justify-between'}`}>
            <span className="font-medium" style={{ color: textColor, fontSize: 'var(--fs-entry, 11pt)' }}>{item.language}</span>
            <span style={{ opacity: 0.6 }}>{item.proficiency}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CertificationsSection({ section, accent, borderColor, textColor }) {
  const s = section.settings || {};
  const rowGap = s.itemGap != null ? s.itemGap + 'px' : (ROW_GAP[s.spacing] || ROW_GAP.normal);
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
              <span className="font-bold" style={{ color: textColor, fontSize: 'var(--fs-entry, 11pt)' }}>{item.name}</span>
              {item.issuer && <span style={{ opacity: 0.6 }}> — {item.issuer}</span>}
              {item.url && <span className="ml-1" style={{ color: accent }}> · {item.url}</span>}
            </div>
            {showDates && item.date && (
              <span className="whitespace-nowrap ml-2 shrink-0 font-medium" style={{ color: accent }}>{item.date}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function AwardsSection({ section, accent, borderColor, textColor }) {
  const s = section.settings || {};
  const rowGap = s.itemGap != null ? s.itemGap + 'px' : (ROW_GAP[s.spacing] || ROW_GAP.normal);
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
                <span className="font-bold" style={{ color: textColor, fontSize: 'var(--fs-entry, 11pt)' }}>{item.title}</span>
                {item.issuer && <span style={{ opacity: 0.6 }}> — {item.issuer}</span>}
              </div>
              {showDates && item.date && (
                <span className="whitespace-nowrap ml-2 shrink-0 font-medium" style={{ color: accent }}>{item.date}</span>
              )}
            </div>
            {!isHtmlEmpty(item.description) && (
              <p className="mt-0.5 rich-text-output" style={{ opacity: 0.75 }} dangerouslySetInnerHTML={{ __html: item.description }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function VolunteeringSection({ section, accent, borderColor, textColor }) {
  const s = section.settings || {};
  const rowGap = s.itemGap != null ? s.itemGap + 'px' : (ROW_GAP[s.spacing] || ROW_GAP.normal);
  const showDates = s.showDates !== false;
  const showLoc = s.showLocation !== false;
  const centered = s.alignment === 'center';
  const twoCol = s.columns > 1;
  const visibleItems = section.items.filter(i => i.visible !== false);
  return (
    <div className={centered ? 'text-center' : ''} style={{ marginBottom: 'var(--section-gap)' }}>
      <SectionTitle title={section.title} accent={accent} borderColor={borderColor} centered={centered} />
      <div className={twoCol ? 'grid grid-cols-2' : 'flex flex-col'} style={{ gap: rowGap }}>
        {visibleItems.map(item => (
          <div key={item.id}>
            <ItemHeader
              title={item.role}
              subtitle={item.org}
              extra={showLoc && item.location ? <span style={{ opacity: 0.5 }}>, {item.location}</span> : null}
              date={showDates && (item.startDate || item.endDate)
                ? `${item.startDate || ''}${item.endDate ? ` – ${item.endDate}` : ''}` : ''}
              titleStyle={s.titleStyle}
              centered={centered}
              accent={accent}
              textColor={textColor}
            />
            <ItemDesc description={item.description} bullets={item.bullets} bulletColor={accent} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ReferencesSection({ section, accent, borderColor, textColor }) {
  const s = section.settings || {};
  const cols = s.columns || 2;
  const centered = s.alignment === 'center';
  const rowGap = s.itemGap != null ? s.itemGap + 'px' : (ROW_GAP[s.spacing] || ROW_GAP.normal);
  const visibleItems = section.items.filter(i => i.visible !== false);
  return (
    <div className={centered ? 'text-center' : ''} style={{ marginBottom: 'var(--section-gap)' }}>
      <SectionTitle title={section.title} accent={accent} borderColor={borderColor} centered={centered} />
      <div className={`grid ${COLS[cols] || 'grid-cols-2'}`} style={{ gap: rowGap }}>
        {visibleItems.map(item => (
          <div key={item.id} className="p-2 rounded-lg border" style={{ borderColor: accent + '20', backgroundColor: accent + '05' }}>
            <p className="font-bold" style={{ color: textColor, fontSize: 'var(--fs-entry, 11pt)' }}>{item.name}</p>
            {item.jobTitle && <p style={{ opacity: 0.6 }}>{item.jobTitle}</p>}
            {item.company && <p style={{ opacity: 0.6 }}>{item.company}</p>}
            {item.email && <p className="mt-0.5" style={{ color: accent }}>{item.email}</p>}
            {item.phone && <p style={{ opacity: 0.5 }}>{item.phone}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function InterestsSection({ section, accent, borderColor }) {
  const s = section.settings || {};
  const centered = s.alignment === 'center';
  const tagGap = s.itemGap != null ? s.itemGap + 'px' : (ROW_GAP[s.spacing] || '6px');
  const visibleItems = section.items.filter(i => i.visible !== false);
  return (
    <div className={centered ? 'text-center' : ''} style={{ marginBottom: 'var(--section-gap)' }}>
      <SectionTitle title={section.title} accent={accent} borderColor={borderColor} centered={centered} />
      <div className={`flex flex-wrap ${centered ? 'justify-center' : ''}`} style={{ gap: tagGap }}>
        {visibleItems.map(item =>
          (item.interests || '').split(',').map((interest, i) => interest.trim() && (
            <span key={`${item.id}-${i}`} className="px-2 py-0.5 rounded border" style={{ backgroundColor: accent + '10', color: accent, borderColor: accent + '25' }}>
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
  const rowGap = s.itemGap != null ? s.itemGap + 'px' : (ROW_GAP[s.spacing] || ROW_GAP.normal);
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
              extra={item.location ? <span style={{ opacity: 0.5 }}> · {item.location}</span> : null}
              date={item.date || ''}
              titleStyle={s.titleStyle}
              centered={centered}
              accent={accent}
              textColor={textColor}
            />
            <ItemDesc description={item.description} bullets={item.bullets} bulletColor={accent} />
          </div>
        ))}
      </div>
    </div>
  );
}
