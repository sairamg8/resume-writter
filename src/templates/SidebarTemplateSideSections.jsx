import { SideTitle } from '@/templates/SidebarTemplateHelpers';

export function SideSkills({ section, accent }) {
  const visibleItems = section.items.filter(i => i.visible !== false);
  const style = section.settings?.skillsStyle || 'tags';
  return (
    <div style={{ marginBottom: 'var(--section-gap)' }}>
      <SideTitle title={section.title} />
      {style === 'stacked' ? (
        <div className="flex flex-col" style={{ gap: 'var(--item-gap)' }}>
          {visibleItems.map(item => {
            const iH = item.hiddenFields || [];
            const skills = item.skills && !iH.includes('skills')
              ? item.skills.split(',').map(sk => sk.trim()).filter(Boolean)
              : [];
            return (
              <div key={item.id}>
                {item.category && !iH.includes('category') && (
                  <div className="font-bold uppercase tracking-wider mb-0.5" style={{ color: '#64748b', fontSize: '9px' }}>{item.category}</div>
                )}
                {skills.map((sk, i) => (
                  <div key={i} className="text-[10px]" style={{ color: '#cbd5e1' }}>{'• '}{sk}</div>
                ))}
              </div>
            );
          })}
        </div>
      ) : style === 'tags' ? (
        <div className="flex flex-col" style={{ gap: 'var(--item-gap)' }}>
          {visibleItems.map(item => {
            const iH = item.hiddenFields || [];
            return (
              <div key={item.id}>
                {item.category && !iH.includes('category') && (
                  <div className="font-bold uppercase tracking-wider mb-0.5" style={{ color: '#64748b', fontSize: '9px' }}>{item.category}</div>
                )}
                {item.skills && !iH.includes('skills') && (
                  <div className="flex flex-wrap gap-0.5">
                    {item.skills.split(',').map((sk, i) => sk.trim() && (
                      <span key={i} className="px-1.5 py-0.5 rounded text-[9px] font-medium" style={{ backgroundColor: '#334155', color: '#cbd5e1' }}>
                        {sk.trim()}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : style === 'bars' ? (
        <div className="flex flex-col" style={{ gap: 'var(--item-gap)' }}>
          {visibleItems.map(item => {
            const iH = item.hiddenFields || [];
            return (
              <div key={item.id}>
                {item.category && !iH.includes('category') && (
                  <div className="font-bold uppercase tracking-wider mb-0.5" style={{ color: '#64748b', fontSize: '9px' }}>{item.category}</div>
                )}
                {item.skills && !iH.includes('skills') && item.skills.split(',').map((sk, i) => sk.trim() && (
                  <div key={i} className="mb-1">
                    <div className="text-[10px] mb-0.5" style={{ color: '#cbd5e1' }}>{sk.trim()}</div>
                    <div className="h-1 rounded-full" style={{ backgroundColor: '#334155' }}>
                      <div className="h-1 rounded-full w-4/5" style={{ backgroundColor: accent + '80' }} />
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col" style={{ gap: 'var(--item-gap)' }}>
          {visibleItems.map(item => {
            const iH = item.hiddenFields || [];
            return (
              <div key={item.id}>
                {item.category && !iH.includes('category') && (
                  <span className="font-bold text-[9px] uppercase mr-1" style={{ color: '#64748b' }}>{item.category}: </span>
                )}
                {item.skills && !iH.includes('skills') && (
                  <span className="text-[10px]" style={{ color: '#cbd5e1' }}>{item.skills}</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function SideEducation({ section }) {
  const showDates = section.settings?.showDates !== false;
  const visibleItems = section.items.filter(i => i.visible !== false);
  return (
    <div style={{ marginBottom: 'var(--section-gap)' }}>
      <SideTitle title={section.title} />
      <div className="flex flex-col" style={{ gap: 'var(--item-gap)' }}>
        {visibleItems.map(item => (
          <div key={item.id}>
            <div className="font-semibold text-[11px]" style={{ color: '#e2e8f0' }}>{item.degree}</div>
            {item.institution && <div className="text-[10px]" style={{ color: '#94a3b8' }}>{item.institution}</div>}
            {item.gpa && <div className="text-[10px]" style={{ color: '#64748b' }}>GPA: {item.gpa}</div>}
            {showDates && (item.startDate || item.endDate) && (
              <div className="text-[10px]" style={{ color: '#64748b' }}>
                {item.startDate}{item.endDate ? ` – ${item.endDate}` : ''}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SideLanguages({ section }) {
  const visibleItems = section.items.filter(i => i.visible !== false);
  return (
    <div style={{ marginBottom: 'var(--section-gap)' }}>
      <SideTitle title={section.title} />
      <div className="flex flex-col" style={{ gap: 'var(--item-gap)' }}>
        {visibleItems.map(item => (
          <div key={item.id} className="flex justify-between">
            <span className="text-[10px]" style={{ color: '#e2e8f0' }}>{item.language}</span>
            <span className="text-[10px]" style={{ color: '#64748b' }}>{item.proficiency}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SideCertifications({ section }) {
  const showDates = section.settings?.showDates !== false;
  const visibleItems = section.items.filter(i => i.visible !== false);
  return (
    <div style={{ marginBottom: 'var(--section-gap)' }}>
      <SideTitle title={section.title} />
      <div className="flex flex-col" style={{ gap: 'var(--item-gap)' }}>
        {visibleItems.map(item => (
          <div key={item.id}>
            <div className="font-semibold text-[10px]" style={{ color: '#e2e8f0' }}>{item.name}</div>
            {item.issuer && <div className="text-[10px]" style={{ color: '#94a3b8' }}>{item.issuer}</div>}
            {showDates && item.date && <div className="text-[10px]" style={{ color: '#64748b' }}>{item.date}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SideInterests({ section }) {
  const visibleItems = section.items.filter(i => i.visible !== false);
  return (
    <div style={{ marginBottom: 'var(--section-gap)' }}>
      <SideTitle title={section.title} />
      <div className="flex flex-wrap gap-0.5">
        {visibleItems.map(item =>
          (item.interests || '').split(',').map((interest, i) => interest.trim() && (
            <span key={`${item.id}-${i}`} className="px-1.5 py-0.5 rounded text-[9px]" style={{ backgroundColor: '#334155', color: '#cbd5e1' }}>
              {interest.trim()}
            </span>
          ))
        )}
      </div>
    </div>
  );
}

export function SideReferences({ section }) {
  const visibleItems = section.items.filter(i => i.visible !== false);
  return (
    <div style={{ marginBottom: 'var(--section-gap)' }}>
      <SideTitle title={section.title} />
      <div className="flex flex-col" style={{ gap: 'var(--item-gap)' }}>
        {visibleItems.map(item => (
          <div key={item.id}>
            <div className="font-semibold text-[10px]" style={{ color: '#e2e8f0' }}>{item.name}</div>
            {item.jobTitle && <div className="text-[10px]" style={{ color: '#94a3b8' }}>{item.jobTitle}</div>}
            {item.email && <div className="text-[10px]" style={{ color: '#64748b' }}>{item.email}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
