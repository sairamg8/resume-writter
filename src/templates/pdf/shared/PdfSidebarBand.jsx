import { View } from '@react-pdf/renderer';
import { Text } from './PdfText';
import { PdfPhoto } from './PdfPhoto';
import { PdfContactIcon } from './PdfContactIcon';
import { ContactValue } from './PdfContact';
import { contentWidthPt, pageMargins } from './PdfPage';
import { CSS_PX_TO_PT, MM_TO_PT } from './pdfUnits';
import { fitFontSize } from './pdfMeasure';
import { nameFace, nameFamily } from './pdfFaces';
import { SIDE_CONTACT_PT } from './contactSize';
import { headerTitleSize } from './letterhead';
import { contactItems } from '@/utils/contacts';

/** The band's padding under its text, pt, and the gap between two contacts on a line. */
const BAND_PAD_Y = 14;
const CONTACT_GAP_X = 14;

/**
 * The Sidebar's details — photo, name, job title and contacts — on a band across the top of the page
 * (Design → Layout → Details Top, and Mixed, layoutOptions.js), in the side column's colours: the
 * fill is the Sidebar Background, bleeding to the paper's top edge and, `bleedPt` (the page's own side
 * padding, pt) each way, its sides; the text keeps the page margins. The photo sits left of the name,
 * the contacts run on under them, an icon and its value each, on lines of the band's width. The
 * band never splits, but sits in a plain breakable View, as every template's header does: react-pdf
 * leaves the fixed elements after a page's own child that cannot break and is taller than a page off
 * that page (R2-147-pn). `photo`: the Sidebar's photo style (SidebarTemplatePDF's sidePhoto);
 * `shades`: sidebarShades(background). The name and title colours are settings' (resolved for the column).
 */
export function SidebarBand({ personal, settings, shades, background, photo, bleedPt = 0 }) {
  const { v, h } = pageMargins(settings);
  const g = settings.headerGaps;
  const hidden = personal?.hiddenFields || [];
  const showPhoto = Boolean(photo && personal?.photo && !hidden.includes('photo'));
  const nameSize = settings.fontSizeBase + (settings.fontSizeNameDelta ?? 8);
  const entrySize = headerTitleSize(settings);
  const contacts = contactItems(personal);
  const iconPt = Math.max(6, (settings?.iconSize ?? 8) * CSS_PX_TO_PT);
  // The name's and the title's room: the page's text less the photo beside them — a word wider than that
  // has nowhere to break, so each prints at the largest size that holds it, as in the column.
  const room = contentWidthPt(settings) - (showPhoto ? photo.width + g.photoTextGap : 0);
  const name = personal?.name || 'Your Name';
  const nameFit = fitFontSize(name, { fontFamily: nameFamily(settings), fontSize: nameSize, fontWeight: 'bold' }, room);
  const titleFit = fitFontSize(personal?.title, { fontFamily: settings._pdfFontFamily, fontSize: entrySize }, room);

  return (
    <View>
      <View
        style={{ paddingBottom: BAND_PAD_Y, paddingLeft: bleedPt ? 0 : `${h}mm`, paddingRight: bleedPt ? 0 : `${h}mm` }}
        wrap={false}
      >
        <View style={{ position: 'absolute', top: -v * MM_TO_PT, left: -bleedPt, right: -bleedPt, bottom: 0, backgroundColor: background }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: g.photoTextGap }}>
          {showPhoto && <PdfPhoto src={personal.photo} style={{ ...photo, marginBottom: 0 }} />}
          <View style={{ flex: 1 }}>
            <Text style={{
              ...nameFace(settings), fontSize: nameFit, fontWeight: 'bold', color: settings.nameColor,
              marginBottom: personal?.title ? g.nameTitleGap : 2, lineHeight: 1.2,
            }}>
              {name}
            </Text>
            {personal?.title && (
              <Text style={{ fontSize: titleFit, color: settings.jobTitleColor, lineHeight: 1.2 }}>{personal.title}</Text>
            )}
          </View>
        </View>
        {contacts.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: CONTACT_GAP_X, rowGap: g.contactGapY, marginTop: 8 }}>
            {contacts.map((item) => (
              <View key={item.key} style={{ flexDirection: 'row', alignItems: 'center', gap: g.iconTextGap }}>
                <PdfContactIcon field={item.key} settings={settings} size={iconPt} color={shades.label} />
                <ContactValue value={item.value} href={item.href} style={{ fontSize: SIDE_CONTACT_PT, color: shades.value, lineHeight: 1.2 }} />
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}
