import { View, Text } from '@react-pdf/renderer';
import { PdfRichText } from './PdfRichText';
import {
  SectionTitleOf,
  RenderColGrid,
  ItemHeader,
  RenderBullets,
} from './PdfSections';

export function ExperienceSection({ section, settings, marginBottom, itemGap, italicSubs, centered }) {
  const s = section.settings || {};
  const titleOrder = s.titleOrder || 'company';
  const showDates  = s.showDates  !== false;
  const showLoc    = s.showLocation !== false;
  const titleStyle = s.titleStyle || 'stacked';
  const entrySize  = (settings?.fontSizeBase || 11) + (settings?.fontSizeEntryDelta ?? 0);
  const lineH      = settings?.lineHeightValue || 1.5;
  const visibleItems = (section.items || []).filter(i => i.visible !== false);
  const cols       = s.columns || 1;
  const accent     = settings?.accentColor || '#2563eb';
  const isModern   = settings?._template === 'modern';

  return (
    <View style={{ marginBottom }}>
      <SectionTitleOf section={section} settings={settings} centered={centered} />
      <RenderColGrid
        items={visibleItems}
        cols={cols}
        gap={itemGap}
        renderItem={(item) => {
          const iH  = item.hiddenFields || [];
          const company = iH.includes('company') ? '' : (item.company || '');
          const role    = iH.includes('role')    ? '' : (item.role    || '');
          const loc  = !iH.includes('location') && showLoc ? (item.location || '') : '';
          const sd   = iH.includes('startDate') ? '' : (item.startDate || '');
          const ed   = iH.includes('endDate')   ? '' : (item.current   ? 'Present' : (item.endDate || ''));
          const dateStr = showDates && (sd || ed) ? `${sd}${ed ? ` – ${ed}` : ''}` : '';
          const mainTitle  = titleOrder === 'role' ? role    : company;
          const subTitle   = titleOrder === 'role' ? company : role;
          const desc = iH.includes('description') ? '' : item.description;
          return (
            <View>
              <ItemHeader
                primary={mainTitle}
                sub={subTitle || undefined}
                loc={loc || undefined}
                dateStr={dateStr}
                settings={settings}
                titleStyle={titleStyle}
                italicSub={italicSubs}
                centered={centered}
              />
              {desc && desc.replace(/<[^>]*>/g, '').trim() && (
                <PdfRichText html={desc} style={{ fontSize: entrySize, color: '#333333', lineHeight: lineH, marginTop: 2, textAlign: centered ? 'center' : 'left' }} />
              )}
              <RenderBullets bullets={item.bullets} style={{ fontSize: entrySize, color: '#333333', lineHeight: lineH, textAlign: centered ? 'center' : 'left' }} accent={accent} isModern={isModern} template={settings?._template} />
            </View>
          );
        }}
      />
    </View>
  );
}

export function SkillsSection({ section, settings, marginBottom, itemGap, centered }) {
  const s        = section.settings || {};
  const style    = s.skillsStyle || 'inline';
  const sep      = s.separator === 'dash' ? ' – ' : ': ';
  const isBullet = style === 'bullet';
  const textColor = settings?.textColor  || '#1a1a1a';
  const accent    = settings?.accentColor || '#2563eb';
  const entrySize = (settings?.fontSizeBase || 11) + (settings?.fontSizeEntryDelta ?? 0);
  const lineH     = settings?.lineHeightValue || 1.5;
  const visibleItems = (section.items || []).filter(i => i.visible !== false);
  const cols       = s.columns || 1;
  const isModern   = settings?._template === 'modern';
  const isMinimal  = settings?._template === 'minimal';

  return (
    <View style={{ marginBottom }}>
      <SectionTitleOf section={section} settings={settings} centered={centered} />
      {style === 'bars' ? (
        <RenderColGrid
          items={visibleItems}
          cols={cols}
          gap={itemGap}
          renderItem={(item) => {
            const iH = item.hiddenFields || [];
            const showCat = item.category && !iH.includes('category');
            const showSk  = item.skills   && !iH.includes('skills');
            const skills = showSk ? (item.skills || '').split(',').map(sk => sk.trim()).filter(Boolean) : [];
            return (
              <View>
                {showCat && (
                  <Text style={{ fontSize: entrySize, fontWeight: 'bold', color: accent, letterSpacing: 0.5, textTransform: 'uppercase' }}>{item.category}</Text>
                )}
                {skills.map((sk, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                    <Text style={{ fontSize: entrySize - 1, width: 70, color: '#1a1a1a', opacity: 0.8 }}>{sk}</Text>
                    <View style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: accent + '20' }}>
                      <View style={{ width: '80%', height: 3, borderRadius: 2, backgroundColor: accent + 'b3' }} />
                    </View>
                  </View>
                ))}
              </View>
            );
          }}
        />
      ) : style === 'stacked' ? (
        <RenderColGrid
          items={visibleItems}
          cols={cols}
          gap={itemGap}
          renderItem={(item) => {
            const iH = item.hiddenFields || [];
            const showCat = item.category && !iH.includes('category');
            const showSk  = item.skills   && !iH.includes('skills');
            return (
              <View>
                {showCat && (
                  <View style={{ marginBottom: 2 }}>
                    <Text style={{ fontSize: entrySize, fontWeight: 'bold', color: isModern ? accent : textColor, textAlign: centered ? 'center' : 'left' }}>{item.category}</Text>
                    <View style={{ height: 0.5, backgroundColor: '#e5e7eb', marginTop: 1, marginBottom: 1 }} />
                  </View>
                )}
                {showSk && <Text style={{ fontSize: entrySize, color: '#4b5563', lineHeight: lineH, textAlign: centered ? 'center' : 'left' }}>{item.skills}</Text>}
              </View>
            );
          }}
        />
      ) : style === 'tags' ? (
        <RenderColGrid
          items={visibleItems}
          cols={cols}
          gap={itemGap}
          renderItem={(item) => {
            const iH   = item.hiddenFields || [];
            const showCat = item.category && !iH.includes('category');
            const showSk  = item.skills   && !iH.includes('skills');
            const tags = showSk ? (item.skills || '').split(',').map(sk => sk.trim()).filter(Boolean) : [];
            return (
              <View style={{ alignItems: centered ? 'center' : 'flex-start' }}>
                {showCat && (
                  <Text style={{ fontSize: entrySize, fontWeight: 'bold', color: accent, marginBottom: 4, letterSpacing: 0.5, textAlign: centered ? 'center' : 'left' }}>
                    {item.category.toUpperCase()}
                  </Text>
                )}
                {tags.length > 0 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 3, justifyContent: centered ? 'center' : 'flex-start' }}>
                    {tags.map((tag, ti) => (
                      <View key={ti} style={isMinimal ? {
                        backgroundColor: '#f3f4f6',
                        borderRadius: 3,
                        paddingHorizontal: 5,
                        paddingVertical: 1,
                      } : {
                        backgroundColor: accent + (isModern ? '10' : '15'),
                        borderRadius: 3,
                        paddingHorizontal: 5,
                        paddingVertical: 1,
                        borderWidth: 1,
                        borderColor: accent + '30',
                      }}>
                        <Text style={{ fontSize: entrySize - 0.5, color: isMinimal ? '#4b5563' : accent }}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          }}
        />
      ) : (
        // inline or bullet — respects cols setting via RenderColGrid
        <RenderColGrid
          items={visibleItems}
          cols={cols}
          gap={itemGap}
          renderItem={(item) => {
            const iH = item.hiddenFields || [];
            const showCat = item.category && !iH.includes('category');
            const showSk  = item.skills   && !iH.includes('skills');
            const skillStr = Array.isArray(item.skills) ? item.skills.join(', ') : (item.skills || '');
            return (
              <View style={{ flexDirection: 'row', justifyContent: centered ? 'center' : 'flex-start' }} wrap={false}>
                {isBullet && <Text style={{ color: '#6b7280', fontSize: entrySize, marginRight: 4 }}>•</Text>}
                <Text style={{ fontSize: entrySize, lineHeight: lineH, textAlign: centered ? 'center' : 'left' }}>
                  {showCat && item.category
                    ? <Text style={{ fontWeight: 'bold', color: isModern ? accent : textColor }}>{item.category}{showSk ? sep : ''}</Text>
                    : null}
                  {showSk ? <Text style={{ color: '#4b5563' }}>{skillStr}</Text> : null}
                </Text>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

export function EducationSection({ section, settings, marginBottom, itemGap, italicSubs, centered }) {
  const s        = section.settings || {};
  const showDates = s.showDates    !== false;
  const showLoc   = s.showLocation !== false;
  const titleStyle = s.titleStyle || 'stacked';
  const entrySize  = (settings?.fontSizeBase || 11) + (settings?.fontSizeEntryDelta ?? 0);
  const lineH      = settings?.lineHeightValue || 1.5;
  const visibleItems = (section.items || []).filter(i => i.visible !== false);
  const cols       = s.columns || 1;
  const accent     = settings?.accentColor || '#2563eb';
  const isModern   = settings?._template === 'modern';

  return (
    <View style={{ marginBottom }}>
      <SectionTitleOf section={section} settings={settings} centered={centered} />
      <RenderColGrid
        items={visibleItems}
        cols={cols}
        gap={itemGap}
        renderItem={(item) => {
          const sd = item.startDate || '';
          const ed = item.endDate   || '';
          const dateStr = showDates && (sd || ed) ? `${sd}${ed ? ` – ${ed}` : ''}` : '';
          const degree  = [item.degree, item.fieldOfStudy ? item.fieldOfStudy : ''].filter(Boolean).join(', ');
          const gpaPart = item.gpa ? ` · GPA: ${item.gpa}` : '';
          const subLine = degree + gpaPart;
          const loc     = showLoc && item.location ? item.location : '';
          return (
            <View>
              <ItemHeader
                primary={item.institution}
                sub={subLine || undefined}
                loc={loc || undefined}
                dateStr={dateStr}
                settings={settings}
                titleStyle={titleStyle}
                italicSub={italicSubs}
                centered={centered}
              />
              {item.description && item.description.replace(/<[^>]*>/g, '').trim() && (
                <PdfRichText html={item.description} style={{ fontSize: entrySize - 0.5, color: '#333333', lineHeight: lineH, marginTop: 2, textAlign: centered ? 'center' : 'left' }} />
              )}
              <RenderBullets bullets={item.bullets} style={{ fontSize: entrySize - 0.5, color: '#333333', lineHeight: lineH, textAlign: centered ? 'center' : 'left' }} accent={accent} isModern={isModern} template={settings?._template} />
            </View>
          );
        }}
      />
    </View>
  );
}
