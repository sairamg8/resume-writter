import { isHtmlEmpty } from '@/templates/templateShared';
import { MainTitle, MainItemHeader, ItemDesc } from '@/templates/SidebarTemplateHelpers';

export function MainExperience({ section, accent, borderColor, textColor }) {
  const s = section.settings || {};
  const twoCol = s.columns > 1;
  const showDates = s.showDates !== false;
  const showLoc = s.showLocation !== false;
  const titleOrder = s.titleOrder || 'role';
  const visibleItems = section.items.filter(i => i.visible !== false);
  return (
    <div style={{ marginBottom: 'var(--section-gap)' }}>
      <MainTitle title={section.title} accent={accent} borderColor={borderColor} />
      <div className={twoCol ? 'grid grid-cols-2' : 'flex flex-col'} style={{ gap: 'var(--item-gap)' }}>
        {visibleItems.map(item => {
          const iH = new Set(item.hiddenFields || []);
          const company = iH.has('company') ? '' : item.company;
          const role = iH.has('role') ? '' : item.role;
          const loc = (!iH.has('location') && showLoc && item.location) ? item.location : null;
          const sd = iH.has('startDate') ? '' : (item.startDate || '');
          const ed = iH.has('endDate') ? '' : (item.current ? 'Present' : (item.endDate || ''));
          const dateStr = showDates && (sd || ed) ? `${sd}${ed ? ` – ${ed}` : ''}` : '';
          const primaryTitle = titleOrder === 'role' ? role : company;
          const secondaryTitle = titleOrder === 'role' ? company : role;
          const desc = iH.has('description') ? '' : item.description;
          return (
            <div key={item.id} className="relative pl-3" style={{ borderLeft: '2px solid #e5e7eb' }}>
              <div className="absolute -left-[5px] top-1 w-2 h-2 rounded-full" style={{ backgroundColor: '#9ca3af' }} />
              <div className="flex justify-between items-start">
                <div>
                  {primaryTitle && <div className="font-semibold" style={{ color: textColor, fontSize: 'var(--fs-entry, 11pt)' }}>{primaryTitle}</div>}
                  {secondaryTitle && (
                    <div style={{ color: accent, opacity: 0.8, fontSize: '10px' }}>
                      {secondaryTitle}{loc ? ` · ${loc}` : ''}
                    </div>
                  )}
                </div>
                {dateStr && <span className="whitespace-nowrap ml-2 shrink-0" style={{ color: '#9ca3af', fontSize: '10px' }}>{dateStr}</span>}
              </div>
              {desc && <ItemDesc description={desc} bullets={item.bullets} accent={accent} textColor={textColor} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function MainProjects({ section, accent, borderColor, textColor }) {
  const s = section.settings || {};
  const twoCol = s.columns > 1;
  const showDates = s.showDates !== false;
  const visibleItems = section.items.filter(i => i.visible !== false);
  return (
    <div style={{ marginBottom: 'var(--section-gap)' }}>
      <MainTitle title={section.title} accent={accent} borderColor={borderColor} />
      <div className={twoCol ? 'grid grid-cols-2' : 'flex flex-col'} style={{ gap: 'var(--item-gap)' }}>
        {visibleItems.map(item => (
          <div key={item.id} className="relative pl-3" style={{ borderLeft: '2px solid #e5e7eb' }}>
            <div className="absolute -left-[5px] top-1 w-2 h-2 rounded-full" style={{ backgroundColor: '#9ca3af' }} />
            <div className="flex justify-between items-start">
              <div>
                <span className="font-semibold" style={{ color: textColor, fontSize: 'var(--fs-entry, 11pt)' }}>{item.name}</span>
                {item.technologies && <span style={{ color: accent, opacity: 0.7, fontSize: '10px' }}> · {item.technologies}</span>}
              </div>
              {showDates && (item.startDate || item.endDate) && (
                <span className="whitespace-nowrap ml-2 shrink-0" style={{ color: '#9ca3af', fontSize: '10px' }}>
                  {item.startDate}{item.endDate ? ` – ${item.endDate}` : ''}
                </span>
              )}
            </div>
            {item.url && <div style={{ color: accent, fontSize: '10px' }}>{item.url}</div>}
            <ItemDesc description={item.description} bullets={item.bullets} accent={accent} textColor={textColor} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function MainAwards({ section, accent, borderColor, textColor }) {
  const s = section.settings || {};
  const showDates = s.showDates !== false;
  const centered = s.alignment === 'center';
  const visibleItems = section.items.filter(i => i.visible !== false);
  return (
    <div className={centered ? 'text-center' : ''} style={{ marginBottom: 'var(--section-gap)' }}>
      <MainTitle title={section.title} accent={accent} borderColor={borderColor} />
      <div className="flex flex-col" style={{ gap: 'var(--item-gap)' }}>
        {visibleItems.map(item => (
          <div key={item.id}>
            <div className={`flex ${centered ? 'flex-col items-center' : 'justify-between items-start'}`}>
              <div>
                <span className="font-semibold" style={{ color: textColor, fontSize: 'var(--fs-entry, 11pt)' }}>{item.title}</span>
                {item.issuer && <span style={{ color: accent, opacity: 0.7, fontSize: '10px' }}> — {item.issuer}</span>}
              </div>
              {showDates && item.date && (
                <span className="whitespace-nowrap ml-2 shrink-0" style={{ color: '#9ca3af', fontSize: '10px' }}>{item.date}</span>
              )}
            </div>
            {!isHtmlEmpty(item.description) && (
              <p className="mt-0.5 rich-text-output" style={{ opacity: 0.75, fontSize: '10.5px' }} dangerouslySetInnerHTML={{ __html: item.description }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function MainVolunteering({ section, accent, borderColor, textColor }) {
  const s = section.settings || {};
  const showDates = s.showDates !== false;
  const showLoc = s.showLocation !== false;
  const visibleItems = section.items.filter(i => i.visible !== false);
  return (
    <div style={{ marginBottom: 'var(--section-gap)' }}>
      <MainTitle title={section.title} accent={accent} borderColor={borderColor} />
      <div className="flex flex-col" style={{ gap: 'var(--item-gap)' }}>
        {visibleItems.map(item => (
          <div key={item.id}>
            <MainItemHeader
              title={item.role}
              subtitle={item.org}
              extra={showLoc && item.location ? <span style={{ opacity: 0.5 }}>, {item.location}</span> : null}
              date={showDates && (item.startDate || item.endDate)
                ? `${item.startDate || ''}${item.endDate ? ` – ${item.endDate}` : ''}` : ''}
              titleStyle={s.titleStyle}
              accent={accent}
              textColor={textColor}
            />
            <ItemDesc description={item.description} bullets={item.bullets} accent={accent} textColor={textColor} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function MainCustom({ section, accent, borderColor, textColor }) {
  const s = section.settings || {};
  const twoCol = s.columns > 1;
  const visibleItems = section.items.filter(i => i.visible !== false);
  return (
    <div style={{ marginBottom: 'var(--section-gap)' }}>
      <MainTitle title={section.title} accent={accent} borderColor={borderColor} />
      <div className={twoCol ? 'grid grid-cols-2' : 'flex flex-col'} style={{ gap: 'var(--item-gap)' }}>
        {visibleItems.map(item => {
          const dateBlock = (item.location || item.date) ? (
            <>
              {item.location && <div>{item.location}</div>}
              {item.date && <div>{item.date}</div>}
            </>
          ) : null;
          return (
            <div key={item.id}>
              <MainItemHeader
                title={item.title}
                subtitle={item.subtitle}
                date={dateBlock}
                titleStyle={s.titleStyle}
                accent={accent}
                textColor={textColor}
              />
              <ItemDesc description={item.description} bullets={item.bullets} accent={accent} textColor={textColor} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
