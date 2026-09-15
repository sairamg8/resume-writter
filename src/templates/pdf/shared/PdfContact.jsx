import { View, Link } from '@react-pdf/renderer';
import { Text } from './PdfText';
import { PdfContactIcon } from './PdfContactIcon';
import { pxToPt } from './pdfUnits';
import { textWidth } from './pdfMeasure';
import { contactItems } from '@/utils/contacts';
import { textShades } from './pdfColors';

const NBSP = '\u00a0';
/** A contact value never breaks across lines ("+1 555 0100", "New York, NY"). */
const keepTogether = (s) => String(s).replace(/ /g, NBSP);

/** Space between an item's icon or bullet and its value, pt. */
const ITEM_GAP = 2;
/** A 2 Grid cell's share of the row. */
const GRID_CELL = 0.46;

/** The contacts' type: the values' size (half a point under the body's) and the icons'. */
function rowSizes(settings) {
  const baseSize = settings?.fontSizeBase || 11;
  return { textSize: Math.max(8, baseSize - 0.5), iconPt: Math.max(7, pxToPt(settings?.iconSize ?? 11)) };
}

/** The separator glued to each value but the last, when the contacts print as one line of text. */
const separator = (contactStyle) => `${NBSP}${NBSP}${contactStyle === 'bullet' ? '•' : '|'}`;

/**
 * The narrowest width PdfContactRow prints the contacts in with every value whole on its line:
 * its widest item — the icon or bullet and the value — or, printed as one line of text (Bar and
 * Bullet, Justify), its widest value with the separator glued to it and the space after that:
 * textkit's best-fit pass counts that space before it breaks there, and in a line too short for
 * it breaks between the value and its separator instead, with a drawn hyphen. A 2 Grid cell is
 * 46 % of the row. In the page's font (settings._pdfFontFamily); 0 with no contacts. `gaps` as
 * PdfContactRow's.
 */
export function contactRowMinWidth(personal, settings, hidden, gaps = {}) {
  const items = contactItems(personal, hidden ?? (personal?.hiddenFields || []));
  const contactStyle  = settings?.contactStyle  || 'icon';
  const contactLayout = settings?.contactLayout || 'justify';
  const { textSize, iconPt } = rowSizes(settings);
  const width = (s) => textWidth(s, { fontFamily: settings?._pdfFontFamily, fontSize: textSize });
  if (contactLayout === 'justify' && contactStyle !== 'icon') {
    const sep = width(`${separator(contactStyle)} `);
    return Math.max(0, ...items.map((item, i) => width(keepTogether(item.value)) + (i < items.length - 1 ? sep : 0)));
  }
  const gap = gaps.iconTextGap ?? ITEM_GAP;
  const mark = contactStyle === 'icon' ? iconPt + gap : contactStyle === 'bullet' ? width('•') + gap : 0;
  const widest = Math.max(0, ...items.map((item) => mark + width(item.value)));
  return contactLayout === '2grid' ? widest / GRID_CELL : widest;
}

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
 * letter has its own). With a centred header the contacts are centred too. `gaps`: the
 * header's spacing in pt (resolved settings' `headerGaps`); a gap it does not give prints as it
 * always has — the cover letter passes none, its letterhead keeps its own spacing.
 */
export function PdfContactRow({ personal, settings, color, hidden, gaps = {} }) {
  const contactStyle  = settings?.contactStyle  || 'icon';
  const contactLayout = settings?.contactLayout || 'justify';
  const centered = settings?.headerAlign === 'center';
  const { textSize, iconPt } = rowSizes(settings);
  const c        = color || textShades(settings?.textColor || '#1a1a1a').sub;
  const text = { fontSize: textSize, color: c };
  const top     = gaps.titleContactsGap ?? 3;   // title (or name) ↔ the contacts
  const iconGap = gaps.iconTextGap ?? ITEM_GAP; // icon (or bullet) ↔ value
  const colGap  = gaps.contactGapX ?? pxToPt(16);
  const rowGap  = gaps.contactGapY ?? (contactLayout === 'single' ? 2 : pxToPt(2));

  const items = contactItems(personal, hidden ?? (personal?.hiddenFields || []));
  if (!items.length) return null;

  function renderItem(item) {
    return (
      <View key={item.key} style={{ flexDirection: 'row', alignItems: 'center', gap: iconGap, maxWidth: '100%' }}>
        {contactStyle === 'icon' && <PdfContactIcon field={item.key} settings={settings} size={iconPt} color={c} />}
        {contactStyle === 'bullet' && <Text style={{ fontSize: textSize, color: '#bbbbbb' }}>•</Text>}
        <ContactValue value={item.value} href={item.href} style={{ ...text, flexShrink: 1 }} />
      </View>
    );
  }

  if (contactLayout === 'single') {
    return (
      <View style={{ marginTop: top, gap: rowGap, alignItems: centered ? 'center' : 'flex-start' }}>
        {items.map(renderItem)}
      </View>
    );
  }

  if (contactLayout === '2grid') {
    return (
      <View style={{ marginTop: top, flexDirection: 'row', flexWrap: 'wrap', columnGap: pxToPt(24), rowGap, justifyContent: centered ? 'center' : 'flex-start' }}>
        {items.map((item) => (
          <View key={item.key} style={{ width: `${GRID_CELL * 100}%`, paddingBottom: 1, alignItems: centered ? 'center' : 'flex-start' }}>{renderItem(item)}</View>
        ))}
      </View>
    );
  }

  if (contactStyle === 'icon') {
    return (
      <View style={{ marginTop: top, flexDirection: 'row', flexWrap: 'wrap', columnGap: colGap, rowGap, justifyContent: centered ? 'center' : 'flex-start' }}>
        {items.map(renderItem)}
      </View>
    );
  }

  // "a | b | c" or "a • b • c" as one line of text. Each value and the separator before the next
  // are glued with no-break spaces, so a wrapped line always starts with a value, never with a
  // dangling separator (FIDA-10).
  const sepColor = contactStyle === 'bullet' ? '#bbbbbb' : '#cccccc';
  return (
    <Text style={{ ...text, marginTop: top, textAlign: centered ? 'center' : 'left' }}>
      {items.map((item, i) => (
        <Text key={item.key}>
          <ContactValue value={keepTogether(item.value)} href={item.href} style={text} />
          {i < items.length - 1 && <Text style={{ color: sepColor }}>{`${separator(contactStyle)} `}</Text>}
        </Text>
      ))}
    </Text>
  );
}
