import { View, Text } from '@react-pdf/renderer';
import { MailIcon, PhoneIcon, MapPinIcon, GlobeIcon, LinkedinPdfIcon, GithubPdfIcon } from './PdfIcons';

function buildItems(personal) {
  const hidden = personal?.hiddenFields || [];
  return [
    { key: 'email',    Icon: MailIcon,        val: personal?.email,    display: personal?.email },
    { key: 'phone',    Icon: PhoneIcon,       val: personal?.phone,    display: personal?.phone },
    { key: 'location', Icon: MapPinIcon,      val: personal?.location, display: personal?.location },
    { key: 'website',  Icon: GlobeIcon,       val: personal?.website,  display: personal?.websiteLabel || personal?.website },
    { key: 'linkedin', Icon: LinkedinPdfIcon, val: personal?.linkedin, display: personal?.linkedinLabel || personal?.linkedin },
    { key: 'github',   Icon: GithubPdfIcon,   val: personal?.github,   display: personal?.githubLabel  || personal?.github },
  ].filter(({ key, val }) => !hidden.includes(key) && val);
}

export function PdfContactRow({ personal, settings, color }) {
  const contactStyle  = settings?.contactStyle  || 'icon';
  const contactLayout = settings?.contactLayout || 'justify';
  const baseSize = settings?.fontSizeBase || 11;
  const iconPt   = Math.max(7, Math.round((settings?.iconSize ?? 11) * 0.72));
  const c        = color || '#555555';
  const textSize = baseSize - 1.5;

  const items = buildItems(personal);
  if (!items.length) return null;

  function renderItem({ key, Icon, display }) {
    if (contactStyle === 'icon') {
      return (
        <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <Icon size={iconPt} color={c} />
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
      <View style={{ marginTop: 3, flexDirection: 'row', flexWrap: 'wrap' }}>
        {items.map(item => (
          <View key={item.key} style={{ width: '50%', paddingBottom: 1 }}>{renderItem(item)}</View>
        ))}
      </View>
    );
  }

  // justify (default) - wrap row
  // HTML canvas: gap: '2px 16px' — 2px row gap, 16px column gap
  if (contactStyle === 'icon') {
    return (
      <View style={{ marginTop: 3, flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 2 }}>
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
  // bar (plain) | separator — HTML canvas: mx-1.5 = 6px
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

// Compact stacked contact list for the sidebar template (light text on dark bg)
export function PdfSidebarContact({ personal, accent, iconPt = 8 }) {
  const items = buildItems(personal);
  if (!items.length) return null;
  const textSize = 9;
  const c = '#cbd5e1';
  return (
    <View style={{ gap: 4 }}>
      {items.map(({ key, Icon, display }) => (
        <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Icon size={iconPt} color={accent || '#94a3b8'} />
          <Text style={{ fontSize: textSize, color: c, flex: 1 }}>{display}</Text>
        </View>
      ))}
    </View>
  );
}
