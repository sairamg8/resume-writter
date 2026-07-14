import { isHtmlEmpty } from '@/templates/templateShared';
import { SectionTitle, ItemHeader, ItemDesc, ROW_GAP, COLS } from '@/templates/MinimalTemplateHelpers';

export function Section({ section, accent, textColor, borderColor }) {
  const p = { section, accent, textColor, borderColor };
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

function ExperienceSection({ section, accent, textColor, borderColor }) {
  const s = section.settings || {};
  const rowGap = s.itemGap != null ? s.itemGap + 'px' : (ROW_GAP[s.spacing] || ROW_GAP.normal);
  const twoCol = s.columns > 1;
  const showDates = s.showDates !== false;
  const showLoc = s.showLocation !== false;
  const centered = s.alignment === 'center';
  const titleOrder = s.titleOrder || 'company';
  const visibleItems = section.items.filter(i => i.visible !== false);
  return (
    <div className={centered ? 'text-center' : ''}>
      <SectionTitle title={section.title} centered={centered} accent={accent} borderColor={borderColor} />
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
                extra={loc ? <span className="text-gray-400"> · {loc}</span> : null}
                date={dateStr}
                titleStyle={s.titleStyle}
                centered={centered}
                textColor={textColor}
              />
              {!isHtmlEmpty(desc) && <ItemDesc description={desc} bullets={item.bullets} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EducationSection({ section, accent, textColor, borderColor }) {
  const s = section.settings || {};
  const rowGap = s.itemGap != null ? s.itemGap + 'px' : (ROW_GAP[s.spacing] || ROW_GAP.normal);
  const twoCol = s.columns > 1;
  const showDates = s.showDates !== false;
  const showLoc = s.showLocation !== false;
  const centered = s.alignment === 'center';
  const visibleItems = section.items.filter(i => i.visible !== false);
  return (
    <div className={centered ? 'text-center' : ''}>
      <SectionTitle title={section.title} centered={centered} accent={accent} borderColor={borderColor} />
      <div className={twoCol ? 'grid grid-cols-2' : 'flex flex-col'} style={{ gap: rowGap }}>
        {visibleItems.map(item => (
          <div key={item.id}>
            <ItemHeader
              title={item.institution}
              subtitle={item.degree}
              extra={
                <>
                  {item.fieldOfStudy && <span className="text-gray-400"> · {item.fieldOfStudy}</span>}
                  {showLoc && item.location && <span className="text-gray-400"> · {item.location}</span>}
                  {item.gpa && <span className="text-gray-400"> · GPA {item.gpa}</span>}
                </>
              }
              date={showDates && (item.startDate || item.endDate)
                ? `${item.startDate || ''}${item.endDate ? ` – ${item.endDate}` : ''}` : ''}
              titleStyle={s.titleStyle}
              centered={centered}
              textColor={textColor}
            />
            <ItemDesc description={item.description} bullets={item.bullets} />
          </div>
        ))}
      </div>
    </div>
  );
}

function SkillsSection({ section, accent, textColor, borderColor }) {
  const s = section.settings || {};
  const cols = s.columns || 1;
  const style = s.skillsStyle || 'inline';
  const centered = s.alignment === 'center';
  const sep = s.separator === 'dash' ? ' – ' : ': ';
  const rowGap = s.itemGap != null ? s.itemGap + 'px' : (ROW_GAP[s.spacing] || ROW_GAP.normal);
  const isBullet = style === 'bullet';
  const visibleItems = section.items.filter(i => i.visible !== false);

  return (
    <div className={centered ? 'text-center' : ''}>
      <SectionTitle title={section.title} centered={centered} accent={accent} borderColor={borderColor} />
      {style === 'stacked' ? (
        <div className={`grid gap-x-4 ${COLS[cols] || 'grid-cols-1'}`} style={{ rowGap }}>
          {visibleItems.map(item => {
            const iH = item.hiddenFields || [];
            const showCat = item.category && !iH.includes('category');
            const showSk = item.skills && !iH.includes('skills');
            return (
              <div key={item.id} className={centered ? 'text-center' : ''}>
                {showCat && (
                  <div className="mb-0.5">
                    <div className="font-semibold" style={{ color: textColor }}>{item.category}</div>
                    <div className="h-px" style={{ backgroundColor: '#e5e7eb' }} />
                  </div>
                )}
                {showSk && <div className="text-gray-600">{item.skills}</div>}
              </div>
            );
          })}
        </div>
      ) : style === 'tags' ? (
        <div className={`grid ${COLS[cols] || 'grid-cols-1'}`} style={{ rowGap }}>
          {visibleItems.map(item => {
            const iH = item.hiddenFields || [];
            const showCat = item.category && !iH.includes('category');
            const showSk = item.skills && !iH.includes('skills');
            return (
              <div key={item.id}>
                {showCat && <span className="text-gray-500 font-medium block mb-1">{item.category}</span>}
                {showSk && (
                  <div className={`flex flex-wrap gap-1 ${centered ? 'justify-center' : ''}`}>
                    {item.skills.split(',').map((sk, i) => sk.trim() && (
                      <span key={i} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">{sk.trim()}</span>
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
                {showCat && <span className="font-medium" style={{ color: textColor }}>{item.category}{showSk ? sep : ''}</span>}
                {showSk && <span className="text-gray-600">{item.skills}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ProjectsSection({ section, accent, textColor, borderColor }) {
  const s = section.settings || {};
  const rowGap = s.itemGap != null ? s.itemGap + 'px' : (ROW_GAP[s.spacing] || ROW_GAP.normal);
  const twoCol = s.columns > 1;
  const showDates = s.showDates !== false;
  const centered = s.alignment === 'center';
  const visibleItems = section.items.filter(i => i.visible !== false);
  return (
    <div className={centered ? 'text-center' : ''}>
      <SectionTitle title={section.title} centered={centered} accent={accent} borderColor={borderColor} />
      <div className={twoCol ? 'grid grid-cols-2' : 'flex flex-col'} style={{ gap: rowGap }}>
        {visibleItems.map(item => {
          const extra = (item.technologies || item.url) ? (
            <>
              {item.technologies && <span className="text-gray-400">{' · '}{item.technologies}</span>}
              {item.url && <span style={{ color: accent }}>{' · '}{item.url}</span>}
            </>
          ) : null;
          return (
            <div key={item.id}>
              <ItemHeader
                title={item.name}
                extra={extra}
                date={showDates && (item.startDate || item.endDate)
                  ? `${item.startDate || ''}${item.endDate ? ` – ${item.endDate}` : ''}` : ''}
                titleStyle={s.titleStyle || 'inline'}
                centered={centered}
                textColor={textColor}
              />
              <ItemDesc description={item.description} bullets={item.bullets} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LanguagesSection({ section, accent, borderColor }) {
  const s = section.settings || {};
  const cols = s.columns || 2;
  const centered = s.alignment === 'center';
  const rowGap = s.itemGap != null ? s.itemGap + 'px' : (ROW_GAP[s.spacing] || ROW_GAP.normal);
  const visibleItems = section.items.filter(i => i.visible !== false);
  return (
    <div className={centered ? 'text-center' : ''}>
      <SectionTitle title={section.title} centered={centered} accent={accent} borderColor={borderColor} />
      <div className={`grid gap-x-4 ${COLS[cols] || 'grid-cols-2'}`} style={{ rowGap }}>
        {visibleItems.map(item => (
          <div key={item.id} className={`flex ${centered ? 'justify-center gap-2' : 'justify-between'}`}>
            <span className="font-medium text-gray-900">{item.language}</span>
            <span style={{ color: '#4b5563' }}>{item.proficiency}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CertificationsSection({ section, accent, borderColor }) {
  const s = section.settings || {};
  const showDates = s.showDates !== false;
  const centered = s.alignment === 'center';
  const rowGap = s.itemGap != null ? s.itemGap + 'px' : (ROW_GAP[s.spacing] || ROW_GAP.normal);
  const visibleItems = section.items.filter(i => i.visible !== false);
  return (
    <div className={centered ? 'text-center' : ''}>
      <SectionTitle title={section.title} centered={centered} accent={accent} borderColor={borderColor} />
      <div className="flex flex-col" style={{ gap: rowGap }}>
        {visibleItems.map(item => (
          <div key={item.id} className={centered ? '' : 'grid grid-cols-[1fr_auto] gap-x-4'}>
            <div>
              <span className="font-semibold text-gray-900">{item.name}</span>
              {item.issuer && <span className="text-gray-500"> — {item.issuer}</span>}
            </div>
            {showDates && item.date && <span className="whitespace-nowrap" style={{ color: '#4b5563' }}>{item.date}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function AwardsSection({ section, accent, borderColor }) {
  const s = section.settings || {};
  const showDates = s.showDates !== false;
  const centered = s.alignment === 'center';
  const rowGap = s.itemGap != null ? s.itemGap + 'px' : (ROW_GAP[s.spacing] || ROW_GAP.normal);
  const visibleItems = section.items.filter(i => i.visible !== false);
  return (
    <div className={centered ? 'text-center' : ''}>
      <SectionTitle title={section.title} centered={centered} accent={accent} borderColor={borderColor} />
      <div className="flex flex-col" style={{ gap: rowGap }}>
        {visibleItems.map(item => (
          <div key={item.id}>
            <div className={centered ? '' : 'grid grid-cols-[1fr_auto] gap-x-4'}>
              <div>
                <span className="font-semibold text-gray-900">{item.title}</span>
                {item.issuer && <span className="text-gray-500"> — {item.issuer}</span>}
              </div>
              {showDates && item.date && <span className="whitespace-nowrap" style={{ color: '#4b5563' }}>{item.date}</span>}
            </div>
            {item.description && <p className="text-gray-600 mt-0.5 rich-text-output" dangerouslySetInnerHTML={{ __html: item.description }} />}
          </div>
        ))}
      </div>
    </div>
  );
}

function VolunteeringSection({ section, accent, textColor, borderColor }) {
  const s = section.settings || {};
  const rowGap = s.itemGap != null ? s.itemGap + 'px' : (ROW_GAP[s.spacing] || ROW_GAP.normal);
  const showDates = s.showDates !== false;
  const showLoc = s.showLocation !== false;
  const centered = s.alignment === 'center';
  const visibleItems = section.items.filter(i => i.visible !== false);
  return (
    <div className={centered ? 'text-center' : ''}>
      <SectionTitle title={section.title} centered={centered} accent={accent} borderColor={borderColor} />
      <div className="flex flex-col" style={{ gap: rowGap }}>
        {visibleItems.map(item => (
          <div key={item.id}>
            <ItemHeader
              title={item.role}
              subtitle={item.org}
              extra={showLoc && item.location ? <span className="text-gray-400"> · {item.location}</span> : null}
              date={showDates && (item.startDate || item.endDate)
                ? `${item.startDate || ''}${item.endDate ? ` – ${item.endDate}` : ''}` : ''}
              titleStyle={s.titleStyle}
              centered={centered}
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
  const rowGap = s.itemGap != null ? s.itemGap + 'px' : (ROW_GAP[s.spacing] || ROW_GAP.normal);
  const visibleItems = section.items.filter(i => i.visible !== false);
  return (
    <div className={centered ? 'text-center' : ''}>
      <SectionTitle title={section.title} centered={centered} accent={accent} borderColor={borderColor} />
      <div className={`grid ${COLS[cols] || 'grid-cols-2'}`} style={{ gap: rowGap }}>
        {visibleItems.map(item => (
          <div key={item.id}>
            <p className="font-semibold text-gray-900">{item.name}</p>
            {item.jobTitle && <p className="text-gray-500">{item.jobTitle}</p>}
            {item.company && <p className="text-gray-400">{item.company}</p>}
            {item.email && <p className="text-gray-500 mt-0.5">{item.email}</p>}
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
    <div>
      <SectionTitle title={section.title} centered={centered} accent={accent} borderColor={borderColor} />
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

function CustomSection({ section, accent, textColor, borderColor }) {
  const s = section.settings || {};
  const rowGap = s.itemGap != null ? s.itemGap + 'px' : (ROW_GAP[s.spacing] || ROW_GAP.normal);
  const twoCol = s.columns > 1;
  const centered = s.alignment === 'center';
  const visibleItems = section.items.filter(i => i.visible !== false);
  return (
    <div className={centered ? 'text-center' : ''}>
      <SectionTitle title={section.title} centered={centered} accent={accent} borderColor={borderColor} />
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
              textColor={textColor}
            />
            <ItemDesc description={item.description} bullets={item.bullets} />
          </div>
        ))}
      </div>
    </div>
  );
}
