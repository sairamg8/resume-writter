import { isHtmlEmpty } from '@/templates/templateShared';
import { SectionTitle, ItemDesc, ItemHeader, ROW_GAP, COLS, DATE_COLOR, SUB_COLOR, BODY_COLOR } from '@/templates/ExecutiveTemplateHelpers';

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
  const showDates = s.showDates !== false;
  const showLoc = s.showLocation !== false;
  const centered = s.alignment === 'center';
  const titleOrder = s.titleOrder || 'role';
  const titleStyle = s.titleStyle || 'inline';
  const visibleItems = section.items.filter(i => i.visible !== false);

  return (
    <div style={{ marginBottom: 'var(--section-gap)' }}>
      <SectionTitle title={section.title} accent={accent} borderColor={borderColor} centered={centered} />
      <div className="flex flex-col" style={{ gap: rowGap }}>
        {visibleItems.map(item => {
          const iH = new Set(item.hiddenFields || []);
          const company = iH.has('company') ? '' : item.company;
          const role = iH.has('role') ? '' : item.role;
          const loc = (!iH.has('location') && showLoc && item.location) ? item.location : null;
          const sd = iH.has('startDate') ? '' : (item.startDate || '');
          const ed = iH.has('endDate') ? '' : (item.current ? 'Present' : (item.endDate || ''));
          const dateStr = showDates && (sd || ed) ? `${sd}${ed ? ` – ${ed}` : ''}` : '';
          const desc = iH.has('description') ? '' : item.description;
          const primary = titleOrder === 'role' ? role : company;
          const secondary = titleOrder === 'role' ? company : role;

          return (
            <div key={item.id}>
              <ItemHeader primary={primary} secondary={secondary} dateStr={dateStr} loc={loc} titleStyle={titleStyle} centered={centered} textColor={textColor} />
              {!isHtmlEmpty(desc) && <ItemDesc description={desc} bullets={item.bullets} />}
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
  const showDates = s.showDates !== false;
  const showLoc = s.showLocation !== false;
  const centered = s.alignment === 'center';
  const titleStyle = s.titleStyle || 'inline';
  const visibleItems = section.items.filter(i => i.visible !== false);

  return (
    <div style={{ marginBottom: 'var(--section-gap)' }}>
      <SectionTitle title={section.title} accent={accent} borderColor={borderColor} centered={centered} />
      <div className="flex flex-col" style={{ gap: rowGap }}>
        {visibleItems.map(item => {
          const dateStr = showDates && (item.startDate || item.endDate)
            ? `${item.startDate || ''}${item.endDate ? ` – ${item.endDate}` : ''}` : '';
          const loc = showLoc && item.location ? item.location : null;
          const degree = [item.degree, item.fieldOfStudy].filter(Boolean).join(', ');
          const secondary = (degree || item.gpa) ? (
            <>
              {degree}
              {item.gpa && <span style={{ color: '#6b7280' }}>{degree ? ' · ' : ''}GPA: {item.gpa}</span>}
            </>
          ) : null;
          return (
            <div key={item.id}>
              <ItemHeader primary={item.institution} secondary={secondary} dateStr={dateStr} loc={loc} titleStyle={titleStyle} centered={centered} textColor={textColor} />
              <ItemDesc description={item.description} bullets={item.bullets} />
            </div>
          );
        })}
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
  const rowGap = s.itemGap != null ? s.itemGap + 'px' : (ROW_GAP[s.spacing] || ROW_GAP.normal);
  const isBullet = style === 'bullet';
  const visibleItems = section.items.filter(i => i.visible !== false);

  return (
    <div style={{ marginBottom: 'var(--section-gap)' }}>
      <SectionTitle title={section.title} accent={accent} borderColor={borderColor} centered={centered} />
      {style === 'stacked' ? (
        <div className={`grid gap-x-4 ${COLS[cols] || 'grid-cols-1'}`} style={{ rowGap }}>
          {visibleItems.map(item => {
            const iH = item.hiddenFields || [];
            return (
              <div key={item.id}>
                {item.category && !iH.includes('category') && (
                  <div className="mb-0.5">
                    <div className="font-semibold" style={{ color: textColor }}>{item.category}</div>
                    <div className="h-px" style={{ backgroundColor: '#e5e7eb' }} />
                  </div>
                )}
                {item.skills && !iH.includes('skills') && <div style={{ color: BODY_COLOR }}>{item.skills}</div>}
              </div>
            );
          })}
        </div>
      ) : style === 'tags' ? (
        <div className={`grid gap-x-4 ${COLS[cols] || 'grid-cols-1'}`} style={{ rowGap }}>
          {visibleItems.map(item => {
            const iH = item.hiddenFields || [];
            return (
              <div key={item.id}>
                {item.category && !iH.includes('category') && (
                  <span className="font-bold block mb-1" style={{ color: accent }}>{item.category}</span>
                )}
                {item.skills && !iH.includes('skills') && (
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
                {showSk && <span style={{ color: BODY_COLOR }}>{item.skills}</span>}
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
    <div style={{ marginBottom: 'var(--section-gap)' }}>
      <SectionTitle title={section.title} accent={accent} borderColor={borderColor} centered={centered} />
      <div className={twoCol ? 'grid grid-cols-2' : 'flex flex-col'} style={{ gap: rowGap }}>
        {visibleItems.map(item => (
          <div key={item.id}>
            <div className={`flex ${centered ? 'flex-col items-center' : 'justify-between items-start'} gap-x-4`}>
              <div>
                <span className="font-bold" style={{ color: textColor, fontSize: 'var(--fs-entry, 11pt)' }}>{item.name}</span>
                {item.technologies && <span style={{ color: '#6b7280' }}> · {item.technologies}</span>}
                {item.url && <span style={{ color: accent }}> · {item.url}</span>}
              </div>
              {showDates && (item.startDate || item.endDate) && (
                <span className="whitespace-nowrap shrink-0" style={{ color: DATE_COLOR }}>
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

function LanguagesSection({ section, accent, borderColor, textColor }) {
  const s = section.settings || {};
  const cols = s.columns || 2;
  const centered = s.alignment === 'center';
  const rowGap = s.itemGap != null ? s.itemGap + 'px' : (ROW_GAP[s.spacing] || ROW_GAP.normal);
  const visibleItems = section.items.filter(i => i.visible !== false);

  return (
    <div style={{ marginBottom: 'var(--section-gap)' }}>
      <SectionTitle title={section.title} accent={accent} borderColor={borderColor} centered={centered} />
      <div className={`grid gap-x-6 ${COLS[cols] || 'grid-cols-2'}`} style={{ rowGap }}>
        {visibleItems.map(item => (
          <div key={item.id} className={`flex ${centered ? 'justify-center gap-2' : 'justify-between'}`}>
            <span className="font-semibold" style={{ color: textColor }}>{item.language}</span>
            <span style={{ color: SUB_COLOR }}>{item.proficiency}</span>
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
          <div key={item.id} className={`flex ${centered ? 'flex-col items-center' : 'justify-between items-start'} gap-x-4`}>
            <div>
              <span className="font-bold" style={{ color: textColor }}>{item.name}</span>
              {item.issuer && <span className="italic" style={{ color: SUB_COLOR }}> — {item.issuer}</span>}
              {item.credentialId && <span style={{ color: '#6b7280' }}> · ID: {item.credentialId}</span>}
              {item.url && (
                <a href={item.url.startsWith('http') ? item.url : `https://${item.url}`} target="_blank" rel="noopener noreferrer" className="ml-1" style={{ color: accent, textDecoration: 'none' }}>
                  · {item.urlLabel || item.url}
                </a>
              )}
            </div>
            {showDates && (item.date || item.expiry) && (
              <span className="whitespace-nowrap shrink-0" style={{ color: DATE_COLOR }}>
                {item.date}{item.expiry ? ` – ${item.expiry}` : ''}
              </span>
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
            <div className={`flex ${centered ? 'flex-col items-center' : 'justify-between items-start'} gap-x-4`}>
              <div>
                <span className="font-bold" style={{ color: textColor }}>{item.title}</span>
                {item.issuer && <span className="italic" style={{ color: SUB_COLOR }}> — {item.issuer}</span>}
              </div>
              {showDates && item.date && (
                <span className="whitespace-nowrap shrink-0" style={{ color: DATE_COLOR }}>{item.date}</span>
              )}
            </div>
            {!isHtmlEmpty(item.description) && (
              <p style={{ color: BODY_COLOR }} className="mt-0.5 rich-text-output" dangerouslySetInnerHTML={{ __html: item.description }} />
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
  const titleStyle = s.titleStyle || 'inline';
  const visibleItems = section.items.filter(i => i.visible !== false);

  return (
    <div style={{ marginBottom: 'var(--section-gap)' }}>
      <SectionTitle title={section.title} accent={accent} borderColor={borderColor} centered={centered} />
      <div className="flex flex-col" style={{ gap: rowGap }}>
        {visibleItems.map(item => {
          const dateStr = showDates && (item.startDate || item.endDate)
            ? `${item.startDate || ''}${item.endDate ? ` – ${item.endDate}` : ''}` : '';
          const secondary = (item.org || (showLoc && item.location)) ? (
            <>
              {item.org}
              {showLoc && item.location && <span style={{ color: '#6b7280' }}>{item.org ? ', ' : ''}{item.location}</span>}
            </>
          ) : null;
          return (
            <div key={item.id}>
              <ItemHeader primary={item.role} secondary={secondary} dateStr={dateStr} titleStyle={titleStyle} centered={centered} textColor={textColor} />
              <ItemDesc description={item.description} bullets={item.bullets} />
            </div>
          );
        })}
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
    <div style={{ marginBottom: 'var(--section-gap)' }}>
      <SectionTitle title={section.title} accent={accent} borderColor={borderColor} centered={centered} />
      <div className={`grid ${COLS[cols] || 'grid-cols-2'}`} style={{ gap: rowGap }}>
        {visibleItems.map(item => (
          <div key={item.id}>
            <p className="font-bold" style={{ color: textColor }}>{item.name}</p>
            {item.jobTitle && <p style={{ color: SUB_COLOR }}>{item.jobTitle}</p>}
            {item.company && <p style={{ color: SUB_COLOR }}>{item.company}</p>}
            {item.relationship && <p className="italic" style={{ color: '#6b7280' }}>{item.relationship}</p>}
            {item.email && <p className="mt-0.5" style={{ color: accent }}>{item.email}</p>}
            {item.phone && <p style={{ color: SUB_COLOR }}>{item.phone}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function InterestsSection({ section, accent, borderColor }) {
  const s = section.settings || {};
  const centered = s.alignment === 'center';
  const tagGap = s.itemGap != null ? s.itemGap + 'px' : '6px';
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
  const rowGap = s.itemGap != null ? s.itemGap + 'px' : (ROW_GAP[s.spacing] || ROW_GAP.normal);
  const twoCol = s.columns > 1;
  const centered = s.alignment === 'center';
  const titleStyle = s.titleStyle || 'stacked';
  const visibleItems = section.items.filter(i => i.visible !== false);

  return (
    <div style={{ marginBottom: 'var(--section-gap)' }}>
      <SectionTitle title={section.title} accent={accent} borderColor={borderColor} centered={centered} />
      <div className={twoCol ? 'grid grid-cols-2' : 'flex flex-col'} style={{ gap: rowGap }}>
        {visibleItems.map(item => {
          const secondary = (item.subtitle || item.location) ? (
            <>
              {item.subtitle}
              {item.location && <span style={{ color: '#6b7280' }}>{item.subtitle ? ' · ' : ''}{item.location}</span>}
            </>
          ) : null;
          return (
            <div key={item.id}>
              <ItemHeader primary={item.title} secondary={secondary} dateStr={item.date} titleStyle={titleStyle} centered={centered} textColor={textColor} />
              <ItemDesc description={item.description} bullets={item.bullets} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
