// The cover letter's letterhead (FIDB-51): the résumé template's frame — Modern's accent band,
// the Sidebar panel's colour to the page edges, or a rule (Classic's accent rule, Minimal's
// hairline, Executive's double rule) — around the letter's own layout of photo, name and
// contacts: its Fields Position and Text Position, or the centre line under a centred résumé
// header. What each template looks like is letterheadLook()'s (./shared/letterhead.js).
import { View } from '@react-pdf/renderer';
import { Text } from './shared/PdfText';
import { PdfContactRow } from './shared/PdfContact';
import { PdfPhoto } from './shared/PdfPhoto';
import { getPdfPhotoStyle } from './shared/pdfPhoto';
import { DOUBLE_RULE_GAP, LETTERHEAD_GAP, LETTERHEAD_PAD } from './shared/letterhead';
import { photoTextAlignItems } from '@/constants/templates';
import { contactItems } from '@/utils/contacts';
import { A4_WIDTH_PT, MM_TO_PT } from './shared/pdfUnits';

/** The band, the rule or rules, around the letterhead's content. */
function Frame({ look, settings, children }) {
  const { band, rules: [rule, second] } = look;
  if (band?.bleed) {
    // The fill runs from the paper's top and side edges; the content keeps the page margins, so
    // it sits where every other letterhead's does.
    const top = (settings.marginV ?? 14) * MM_TO_PT;
    const side = (settings.marginH ?? 18) * MM_TO_PT;
    return (
      <View style={{ paddingBottom: band.padY, marginBottom: LETTERHEAD_GAP }}>
        <View style={{ position: 'absolute', top: -top, left: -side, right: -side, bottom: 0, backgroundColor: band.color }} />
        {children}
      </View>
    );
  }
  if (band) {
    return (
      <View style={{
        backgroundColor: band.color, borderRadius: band.radius,
        paddingVertical: band.padY, paddingHorizontal: band.padX, marginBottom: LETTERHEAD_GAP,
      }}>
        {children}
      </View>
    );
  }
  const ruled = rule
    ? { borderBottomWidth: rule.width, borderBottomColor: rule.color, paddingBottom: LETTERHEAD_PAD }
    : { paddingBottom: LETTERHEAD_PAD };
  if (!second) return <View style={{ ...ruled, marginBottom: LETTERHEAD_GAP }}>{children}</View>;
  return (
    <View style={{ marginBottom: LETTERHEAD_GAP }}>
      <View style={ruled}>{children}</View>
      <View style={{ marginTop: DOUBLE_RULE_GAP, borderTopWidth: second.width, borderTopColor: second.color }} />
    </View>
  );
}

/**
 * The letterhead: `look` from letterheadLook(), `settings` the résumé's resolved settings, `cl`
 * the letter, `hidden` its hidden contact fields, `contacts` its contact style and layout
 * (letterContactFormat).
 */
export function CoverLetterHeader({ look, personal, settings, cl, hidden, contacts }) {
  const baseSize  = settings.fontSizeBase || 11;
  const nameSize  = baseSize + (settings.fontSizeNameDelta ?? 8);
  const fieldsPos = cl.fieldsPosition || 'right';
  const { centered } = look;

  const photoSrc = cl.showPhoto !== false ? (cl.clPhoto || personal?.photo) : null;
  // The panel's "Text Position (relative to photo)": the name block's place beside the photo.
  const photoAlign = photoTextAlignItems(cl); // the letter's own Text Position

  const contactEl = (
    <PdfContactRow
      personal={personal}
      hidden={hidden}
      // Centred with the letterhead, never because a centred Classic header was left in the
      // settings of a Modern or Sidebar résumé (their headers take no alignment).
      settings={{ ...settings, headerAlign: centered ? 'center' : 'left', contactStyle: contacts.style, contactLayout: contacts.layout }}
      color={look.contacts}
    />
  );

  const [ring, ringOpts] = look.photo;
  const photoStyle = {
    ...getPdfPhotoStyle(settings, ring, 'cover', ringOpts),
    ...(centered ? { marginBottom: 6 } : { marginRight: 10 }),
  };
  const photoEl = photoSrc ? <PdfPhoto src={photoSrc} style={photoStyle} /> : null;

  // Beside the contacts ('right', the default) the name and photo take at most 60 % of the
  // header, so a long title wraps there instead of pushing the contacts past the margin (and,
  // at a column of no width, making react-pdf throw on an icon). In points, on the name block:
  // react-pdf lays text out once, at the first width it is measured with, so a cap on the row
  // or a box that shrinks later does not re-wrap it. Modern's band pads the header on both sides.
  const bandPad = look.band && !look.band.bleed ? look.band.padX : 0;
  const headerWidth = A4_WIDTH_PT - 2 * (settings.marginH ?? 18) * MM_TO_PT - 2 * bandPad;
  const nameCap = !centered && fieldsPos === 'right' && contactItems(personal, hidden).length
    ? 0.6 * headerWidth - (photoEl ? photoStyle.width + photoStyle.marginRight : 0)
    : undefined;

  const align = centered ? { textAlign: 'center' } : {};
  const nameBlock = (
    <View style={{ minWidth: 0, maxWidth: nameCap, ...(centered ? { alignSelf: 'stretch' } : {}) }}>
      <Text style={{
        fontSize: nameSize, fontWeight: look.name.weight, color: look.name.color, lineHeight: 1.2,
        ...(look.name.letterSpacing ? { letterSpacing: look.name.letterSpacing } : {}), ...align,
      }}>
        {personal?.name || 'Your Name'}
      </Text>
      {personal?.title ? (
        <Text style={{
          fontSize: baseSize, color: look.title.color, marginTop: 1,
          ...(look.title.opacity ? { opacity: look.title.opacity } : {}), ...align,
        }}>
          {personal.title}
        </Text>
      ) : null}
    </View>
  );

  function content() {
    if (centered) {
      // A centred résumé header's stack: photo above the name, contacts under it.
      return (
        <View style={{ alignItems: 'center' }}>
          {photoEl}
          {nameBlock}
          <View style={{ marginTop: 4, alignSelf: 'stretch' }}>{contactEl}</View>
        </View>
      );
    }
    if (fieldsPos === 'below-name') {
      return (
        <View style={{ flexDirection: 'row', alignItems: photoAlign }}>
          {photoEl}
          <View style={{ flex: 1, minWidth: 0 }}>
            {nameBlock}
            {contactEl ? <View style={{ marginTop: 4 }}>{contactEl}</View> : null}
          </View>
        </View>
      );
    }
    if (fieldsPos === 'below-all') {
      // The name block takes the row's width left of the photo, so a long title wraps there
      // instead of running past the margin (it kept its one-line width).
      return (
        <View>
          <View style={{ flexDirection: 'row', alignItems: photoAlign }}>
            {photoEl}
            <View style={{ flex: 1, minWidth: 0 }}>{nameBlock}</View>
          </View>
          {contactEl ? <View style={{ marginTop: 5 }}>{contactEl}</View> : null}
        </View>
      );
    }
    // 'right' — default: name+photo on left (at most 60 %: nameCap), contact on right
    return (
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: photoAlign }}>
          {photoEl}
          {nameBlock}
        </View>
        {contactEl ? <View style={{ flex: 1, alignItems: 'flex-end', marginLeft: 12 }}>{contactEl}</View> : null}
      </View>
    );
  }

  return <Frame look={look} settings={settings}>{content()}</Frame>;
}
