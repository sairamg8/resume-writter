import { View, Link } from '@react-pdf/renderer';
import { Text } from './PdfText';
import { PdfContactIcon } from './PdfContactIcon';
import { pxToPt } from './pdfUnits';
import { contactItems } from '@/utils/contacts';
import { textShades } from './pdfColors';

const NBSP = '\u00a0';
/** A contact value never breaks across lines ("+1 555 0100", "New York, NY"). */
const keepTogether = (s) => String(s).replace(/ /g, NBSP);

/**
 * A contact value as printed: a link (same colour, no underline) when it has a target. Every
 * template's contacts go through here, with `value` and `href` from contactItems().
 * The link's text is our own Text: react-pdf wraps a Link's bare string in a paragraph of its
 * own, which carries none of Text's settings, so a long value on its own (a Display label with
 * a URL in the Sidebar column) could break with a drawn hyphen (VM4-1). A Link holding a Text
 * is not rewrapped; it lays out exactly as before.
 */
export function ContactValue({ value, href, style }) {
  if (!href) return <Text style={style}>{value}</Text>;
  return <Link src={href} style={{ ...style, textDecoration: 'none' }}><Text>{value}</Text></Link>;
}

/**
 * The header's contact line(s). `hidden` overrides the résumé's hidden fields (the cover
 * letter has its own). With a centred header the contacts are centred too.
 */
export function PdfContactRow({ personal, settings, color, hidden }) {
  const contactStyle  = settings?.contactStyle  || 'icon';
  const contactLayout = settings?.contactLayout || 'justify';
  const centered = settings?.headerAlign === 'center';
  const baseSize = settings?.fontSizeBase || 11;
  const iconPt   = Math.max(7, pxToPt(settings?.iconSize ?? 11));
  const c        = color || textShades(settings?.textColor || '#1a1a1a').sub;
  const textSize = Math.max(8, baseSize - 0.5);
  const text = { fontSize: textSize, color: c };

  const items = contactItems(personal, hidden ?? (personal?.hiddenFields || []));
  if (!items.length) return null;

  function renderItem(item) {
    return (
      <View key={item.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 2, maxWidth: '100%' }}>
        {contactStyle === 'icon' && <PdfContactIcon field={item.key} settings={settings} size={iconPt} color={c} />}
        {contactStyle === 'bullet' && <Text style={{ fontSize: textSize, color: '#bbbbbb' }}>•</Text>}
        <ContactValue value={item.value} href={item.href} style={{ ...text, flexShrink: 1 }} />
      </View>
    );
  }

  if (contactLayout === 'single') {
    return (
      <View style={{ marginTop: 3, gap: 2, alignItems: centered ? 'center' : 'flex-start' }}>
        {items.map(renderItem)}
      </View>
    );
  }

  if (contactLayout === '2grid') {
    return (
      <View style={{ marginTop: 3, flexDirection: 'row', flexWrap: 'wrap', columnGap: pxToPt(24), rowGap: pxToPt(2), justifyContent: centered ? 'center' : 'flex-start' }}>
        {items.map((item) => (
          <View key={item.key} style={{ width: '46%', paddingBottom: 1, alignItems: centered ? 'center' : 'flex-start' }}>{renderItem(item)}</View>
        ))}
      </View>
    );
  }

  if (contactStyle === 'icon') {
    return (
      <View style={{ marginTop: 3, flexDirection: 'row', flexWrap: 'wrap', columnGap: pxToPt(16), rowGap: pxToPt(2), justifyContent: centered ? 'center' : 'flex-start' }}>
        {items.map(renderItem)}
      </View>
    );
  }

  // "a | b | c" or "a • b • c" as one line of text. Each value and the separator before the next
  // are glued with no-break spaces, so a wrapped line always starts with a value, never with a
  // dangling separator (FIDA-10).
  const sep = contactStyle === 'bullet' ? '•' : '|';
  const sepColor = contactStyle === 'bullet' ? '#bbbbbb' : '#cccccc';
  return (
    <Text style={{ ...text, marginTop: 3, textAlign: centered ? 'center' : 'left' }}>
      {items.map((item, i) => (
        <Text key={item.key}>
          <ContactValue value={keepTogether(item.value)} href={item.href} style={text} />
          {i < items.length - 1 && <Text style={{ color: sepColor }}>{`${NBSP}${NBSP}${sep} `}</Text>}
        </Text>
      ))}
    </Text>
  );
}
