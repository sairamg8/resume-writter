import { View, Text } from '@react-pdf/renderer';
import { PdfContactIcon } from './PdfContactIcon';
import { pxToPt } from './pdfUnits';

function buildItems(personal) {
  const hidden = personal?.hiddenFields || [];
  return [
    { key: 'email',    val: personal?.email,    display: personal?.email },
    { key: 'phone',    val: personal?.phone,    display: personal?.phone },
    { key: 'location', val: personal?.location, display: personal?.location },
    { key: 'website',  val: personal?.website,  display: personal?.websiteLabel || personal?.website },
    { key: 'linkedin', val: personal?.linkedin, display: personal?.linkedinLabel || personal?.linkedin },
    { key: 'github',   val: personal?.github,   display: personal?.githubLabel  || personal?.github },
  ].filter(({ key, val }) => !hidden.includes(key) && val);
}

export function PdfContactRow({ personal, settings, color }) {
  const contactStyle  = settings?.contactStyle  || 'icon';
  const contactLayout = settings?.contactLayout || 'justify';
  const baseSize = settings?.fontSizeBase || 11;
  const iconPt   = Math.max(7, pxToPt(settings?.iconSize ?? 11));
  const c        = color || '#555555';
  const textSize = Math.max(8, baseSize - 0.5);

  const items = buildItems(personal);
  if (!items.length) return null;

  function renderItem({ key, display }) {
    if (contactStyle === 'icon') {
      return (
        <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <PdfContactIcon field={key} settings={settings} size={iconPt} color={c} />
          <Text style={{ fontSize: textSize, color: c }}>{display}</Text>
        </View>
      );
    }
    if (contactStyle === 'bullet') {
      return (
        <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <Text style={{ fontSize: textSize, color: '#bbbbbb' }}>•</Text>
          <Text style={{ fontSize: textSize, color: c }}>{display}</Text>
        </View>
      );
    }
    return <Text key={key} style={{ fontSize: textSize, color: c }}>{display}</Text>;
  }

  if (contactLayout === 'single') {
    return (
      <View style={{ marginTop: 3, gap: 2 }}>
        {items.map(item => <View key={item.key}>{renderItem(item)}</View>)}
      </View>
    );
  }

  if (contactLayout === '2grid') {
    return (
      <View style={{ marginTop: 3, flexDirection: 'row', flexWrap: 'wrap', columnGap: pxToPt(24), rowGap: pxToPt(2) }}>
        {items.map(item => (
          <View key={item.key} style={{ width: '46%', paddingBottom: 1 }}>{renderItem(item)}</View>
        ))}
      </View>
    );
  }

  if (contactStyle === 'icon') {
    return (
      <View style={{ marginTop: 3, flexDirection: 'row', flexWrap: 'wrap', columnGap: pxToPt(16), rowGap: pxToPt(2) }}>
        {items.map(renderItem)}
      </View>
    );
  }
  if (contactStyle === 'bullet') {
    return (
      <View style={{ marginTop: 3, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
        {items.map((item, i) => (
          <View key={item.key} style={{ flexDirection: 'row', alignItems: 'center' }}>
            {i > 0 && <Text style={{ color: '#bbbbbb', marginHorizontal: 5, fontSize: textSize }}>•</Text>}
            <Text style={{ fontSize: textSize, color: c }}>{item.display}</Text>
          </View>
        ))}
      </View>
    );
  }
  return (
    <View style={{ marginTop: 3, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
      {items.map((item, i) => (
        <View key={item.key} style={{ flexDirection: 'row', alignItems: 'center' }}>
          {i > 0 && <Text style={{ color: '#cccccc', marginHorizontal: 5, fontSize: textSize }}>|</Text>}
          <Text style={{ fontSize: textSize, color: c }}>{item.display}</Text>
        </View>
      ))}
    </View>
  );
}

export function PdfSidebarContact({ personal, settings, iconPt = 8 }) {
  const items = buildItems(personal);
  if (!items.length) return null;
  const textSize = 9;
  const muted = '#94a3b8';
  const value = '#cbd5e1';
  return (
    <View style={{ gap: 4 }}>
      {items.map(({ key, display }) => (
        <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <PdfContactIcon field={key} settings={settings} size={iconPt} color={muted} />
          <Text style={{ fontSize: textSize, color: value, flex: 1 }}>{display}</Text>
        </View>
      ))}
    </View>
  );
}
