import { View, Text } from '@react-pdf/renderer';
import { hexAlpha } from './PdfSections';
import { SideSectionTitle } from './PdfSidebarColumn';

export function SideSkills({ section, sectionGap, itemGap, accent }) {
  const s     = section.settings || {};
  const style = s.skillsStyle || 'inline';
  const visibleItems = (section.items || []).filter(i => i.visible !== false);

  if (style === 'bars') {
    return (
      <View style={{ marginBottom: sectionGap }}>
        <SideSectionTitle title={section.title} />
        <View style={{ gap: itemGap }}>
          {visibleItems.map((item, i) => {
            const iH = item.hiddenFields || [];
            const skills = item.skills && !iH.includes('skills')
              ? item.skills.split(',').map(sk => sk.trim()).filter(Boolean)
              : [];
            return (
              <View key={i}>
                {item.category && !iH.includes('category') && (
                  <Text style={{ fontSize: 8.5, fontWeight: 'bold', color: '#64748b', letterSpacing: 0.5, marginBottom: 2, lineHeight: 1.2 }}>
                    {item.category.toUpperCase()}
                  </Text>
                )}
                {skills.map((sk, index) => (
                  <View key={index} style={{ marginBottom: 4 }}>
                    <Text style={{ fontSize: 8.5, color: '#cbd5e1', marginBottom: 1, lineHeight: 1.2 }}>{sk}</Text>
                    <View style={{ height: 3, borderRadius: 2, backgroundColor: '#334155' }}>
                      <View style={{ width: '80%', height: 3, borderRadius: 2, backgroundColor: hexAlpha(accent, 0.5) }} />
                    </View>
                  </View>
                ))}
              </View>
            );
          })}
        </View>
      </View>
    );
  }

  if (style === 'tags') {
    return (
      <View style={{ marginBottom: sectionGap }}>
        <SideSectionTitle title={section.title} />
        <View style={{ gap: itemGap }}>
          {visibleItems.map((item, i) => {
            const iH = item.hiddenFields || [];
            const tags = item.skills ? item.skills.split(',').map(sk => sk.trim()).filter(Boolean) : [];
            return (
              <View key={i}>
                {item.category && !iH.includes('category') && (
                  <Text style={{ fontSize: 8.5, fontWeight: 'bold', color: '#64748b', letterSpacing: 0.5, marginBottom: 2, lineHeight: 1.2 }}>
                    {item.category.toUpperCase()}
                  </Text>
                )}
                {tags.length > 0 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2.5 }}>
                    {tags.map((tag, ti) => (
                      <View key={ti} style={{ backgroundColor: '#334155', borderRadius: 2, paddingHorizontal: 5, paddingVertical: 1.5 }}>
                        <Text style={{ fontSize: 8.5, color: '#cbd5e1', lineHeight: 1.2 }}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </View>
    );
  }

  if (style === 'stacked') {
    return (
      <View style={{ marginBottom: sectionGap }}>
        <SideSectionTitle title={section.title} />
        <View style={{ gap: itemGap }}>
          {visibleItems.map((item, i) => {
            const iH = item.hiddenFields || [];
            const skills = item.skills && !iH.includes('skills')
              ? item.skills.split(',').map(sk => sk.trim()).filter(Boolean)
              : [];
            return (
              <View key={i}>
                {item.category && !iH.includes('category') && (
                  <Text style={{ fontSize: 8.5, fontWeight: 'bold', color: '#64748b', marginBottom: 2, lineHeight: 1.2 }}>{item.category.toUpperCase()}</Text>
                )}
                {skills.map((sk, index) => (
                  <Text key={index} style={{ fontSize: 8.5, color: '#cbd5e1', lineHeight: 1.4, marginBottom: 1 }}>{'• '}{sk}</Text>
                ))}
              </View>
            );
          })}
        </View>
      </View>
    );
  }

  return (
    <View style={{ marginBottom: sectionGap }}>
      <SideSectionTitle title={section.title} />
      <View style={{ gap: itemGap }}>
        {visibleItems.map((item, i) => {
          const iH = item.hiddenFields || [];
          return (
            <View key={i}>
              <Text style={{ fontSize: 9, lineHeight: 1.2 }}>
                {item.category && !iH.includes('category') && (
                  <Text style={{ fontSize: 8.5, fontWeight: 'bold', color: '#64748b' }}>{item.category.toUpperCase()}: </Text>
                )}
                {item.skills && !iH.includes('skills') && (
                  <Text style={{ color: '#cbd5e1' }}>{item.skills}</Text>
                )}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
