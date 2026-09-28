// The cover letter's letterhead (FIDB-51): the résumé template's frame — Modern's accent band,
// the Sidebar panel's colour to the page edges, or a rule (Classic's accent rule, Minimal's
// hairline, Executive's double rule) — around the letter's own layout of photo, name and
// contacts: its Fields Position and Text Position, or the centre line under a centred résumé
// header. What each template looks like is letterheadLook()'s (./shared/letterhead.js).
import { View } from '@react-pdf/renderer';
import { Text } from './shared/PdfText';
import { contactRowMinWidth, PdfContactRow } from './shared/PdfContact';
import { PdfPhoto } from './shared/PdfPhoto';
import { contentWidthPt, pageMargins } from './shared/PdfPage';
import { getPdfPhotoStyle } from './shared/pdfPhoto';
import { fitFontSize, textWidth, widestWord } from './shared/pdfMeasure';
import { nameFace } from './shared/pdfFaces';
import { DOUBLE_RULE_GAP, LETTER_CONTACTS_GAP } from './shared/letterhead';
import { photoRowDirection, photoTextAlignItems } from '@/constants/templates';
import { setGapPt } from '@/constants/headerSpacing';
import { contactItems } from '@/utils/contacts';
import { letterFieldsPosition, letterResumePhoto } from '@/utils/coverLetter';
import { isDrawableImage } from '@/utils/imageUpload';
import { MM_TO_PT } from './shared/pdfUnits';
import { opacityFor } from './shared/pdfColors';
import { LinkGround } from './shared/PdfLinkStyle';

/** Room added to each measured width, pt: a word's kerning into the next space is not in it. */
const SLACK = 1;

/** The band, the rule or rules, around the letterhead's content; `gapBelow` under them (letterheadLook). */
function Frame({ look, settings, children }) {
  const { band, rules: [rule, second], ruleGap, gapBelow } = look;
  if (band?.bleed) {
    // The fill runs from the paper's top and side edges; the content keeps the page margins, so
    // it sits where every other letterhead's does. A rule (Banner's header rule) is drawn on the
    // band, its Text ↔ Border gap under the text, as the résumé's band draws it.
    const { v, h } = pageMargins(settings);
    const top = v * MM_TO_PT;
    const side = h * MM_TO_PT;
    return (
      <View style={{ paddingBottom: band.padY, marginBottom: gapBelow }}>
        <View style={{ position: 'absolute', top: -top, left: -side, right: -side, bottom: 0, backgroundColor: band.color }} />
        {rule ? <View style={{ borderBottomWidth: rule.width, borderBottomColor: rule.color, paddingBottom: ruleGap }}>{children}</View> : children}
      </View>
    );
  }
  if (band) {
    return (
      <View style={{
        backgroundColor: band.color, borderRadius: band.radius,
        paddingVertical: band.padY, paddingHorizontal: band.padX, marginBottom: gapBelow,
      }}>
        {children}
      </View>
    );
  }
  // The rule sits the résumé header's Text ↔ Border gap under the text, as the résumé's (ruleGap).
  const ruled = rule
    ? { borderBottomWidth: rule.width, borderBottomColor: rule.color, paddingBottom: ruleGap }
    : { paddingBottom: ruleGap };
  if (!second) return <View style={{ ...ruled, marginBottom: gapBelow }}>{children}</View>;
  return (
    <View style={{ marginBottom: gapBelow }}>
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
  // One of the three the panel offers: content()'s layouts and the cap below are keyed on the
  // exact string, so a stored value the panel never wrote prints as 'right' (letterFieldsPosition).
  const fieldsPos = letterFieldsPosition(cl);
  const { centered } = look;

  // The letter's own photo, else the résumé's — the first the PDF can draw. One it cannot draw
  // (PdfPhoto prints nothing for it) takes no room (VM3-7), and an own photo saved in a format no
  // copy could be made of (withPrintablePhotos) no longer hides a résumé photo that prints (R7-7).
  // A résumé photo hidden under Personal Info → Photo is none (letterResumePhoto, R2-092).
  const photoSrc = cl.showPhoto === false ? null : [cl.clPhoto, letterResumePhoto(personal)].find(isDrawableImage) ?? null;
  // The panel's "Text Position (relative to photo)": the name block's place beside the photo.
  const photoAlign = photoTextAlignItems(cl); // the letter's own Text Position

  // Centred with the letterhead, never because a centred Classic header was left in the
  // settings of a Modern or Sidebar résumé (their headers take no alignment).
  const contactSettings = { ...settings, headerAlign: centered ? 'center' : 'left', contactStyle: contacts.style, contactLayout: contacts.layout };
  // The contact row's own spacing: the résumé's set Icon ↔ Text, Between contacts and Between contact
  // rows (Personal Info → Header spacing), else PdfContactRow's (spec D5) — measured with the same gaps
  // it prints with. Between contacts is Justify's (a 2 Grid's column gap is its own, as on the résumé).
  const rowGaps = {};
  if (setGapPt(settings, 'iconTextGap') != null) rowGaps.iconTextGap = setGapPt(settings, 'iconTextGap');
  if (setGapPt(settings, 'contactGapX') != null && !['single', '2grid'].includes(contacts.layout)) rowGaps.contactGapX = setGapPt(settings, 'contactGapX');
  if (setGapPt(settings, 'contactGapY') != null) rowGaps.contactGapY = setGapPt(settings, 'contactGapY');

  const [ring, ringOpts] = look.photo;
  // Photo ↔ Text: the résumé's set value (Personal Info → Header spacing), else the letterhead's
  // own — 6 pt above a centred name, 10 pt beside one (spec D5).
  const photoGap = setGapPt(settings, 'photoTextGap');
  // Photo → Position (R2-147), the résumé's as its Shape, Size, Border and Tone are: Right puts the photo
  // right of the name, its gap on its left.
  const photoDir = centered ? 'row' : photoRowDirection(settings);
  const photoSideGap = photoGap ?? 10;
  const photoStyle = {
    ...getPdfPhotoStyle(settings, ring, 'cover', ringOpts),
    ...(centered ? { marginBottom: photoGap ?? 6 } : photoDir === 'row-reverse' ? { marginLeft: photoSideGap } : { marginRight: photoSideGap }),
  };
  const photoEl = photoSrc ? <PdfPhoto src={photoSrc} style={photoStyle} /> : null;
  // Right of Name: the space between the name side and the contacts — the letter's Name ↔ Contacts
  // (Cover Letter → Header Layout, contactsSideGap), else its own 12 pt (R2-137).
  const sideGap = setGapPt(settings, 'contactsSideGap') ?? LETTER_CONTACTS_GAP;

  const align = centered ? { textAlign: 'center' } : {};
  const name = personal?.name || 'Your Name';
  const nameStyle = {
    ...nameFace(settings), // Typography → Name Font (R2-146); measured in it below, over `font`
    fontSize: nameSize, fontWeight: look.name.weight, color: look.name.color, lineHeight: 1.2,
    ...(look.name.letterSpacing ? { letterSpacing: look.name.letterSpacing } : {}), ...align,
  };
  // Name & Title Layout "Inline" (look.inline, V2FIDB-51-3): the title on the name's line, baselines
  // aligned; else under the name. In the weight the résumé's header prints it in, stacked or Inline
  // (look.title.weight): Banner's medium title printed regular on its letter (R4-DOUT-09).
  const titleSize = look.title?.size || (baseSize + (settings.fontSizeEntryDelta ?? 0));
  const titleStyle = {
    fontSize: titleSize, color: look.title.color, fontWeight: look.title.weight ?? 400,
    // Stacked: Personal Info → Header spacing → Name ↔ Title when the résumé sets it, else the letterhead's 1 pt.
    ...(look.inline ? { lineHeight: 1.2 } : { marginTop: setGapPt(settings, 'nameTitleGap') ?? 1 }),
    ...(look.title.opacity ? { opacity: opacityFor(look.title.color, look.title.opacity) } : {}), ...align,
    ...(look.title.italic ? { fontStyle: 'italic' } : {}), // Academic's position line
  };

  // Beside the contacts ('right', the default) the name side takes the room the contacts' widest
  // item leaves (contactRowMinWidth), so a long title wraps there instead of pushing a contact
  // past the margin (VM3-1) — and, at a column of no width, making react-pdf throw on an icon.
  // A name or title word wider than that room cannot wrap, and ran over the contacts (VM3-0):
  // then the contacts go under the name, as Below Name prints them. With no contacts it has the
  // row beside the photo (uncapped, a long title ran past the margin by the photo's width). In
  // points, on the name block: react-pdf lays text out once, at the first width it is measured
  // with, so a cap on the row or a box that shrinks later does not re-wrap it. Modern's band
  // pads the header on both sides. A 2 Grid beside the name gets its two columns, cells as wide as
  // its widest item (contactRowMinWidth) — but not at the cost of wrapping a name and title that
  // fit on their lines (beside two short contacts the title wrapped, and with a large photo the
  // name, VM3-2): then it goes under the name, as Below Name prints it, still in two columns.
  // Folded to one column beside them, the layout the user picked printed as Single (W2a-4.1-NB2).
  const hasContacts = contactItems(personal, hidden).length > 0;
  const bandPad = look.band && !look.band.bleed ? look.band.padX : 0;
  const headerWidth = contentWidthPt(settings) - 2 * bandPad;
  // The row beside the photo — where one sits and the letterhead is not centred (then it is above).
  const beside = headerWidth - (photoEl && !centered ? photoStyle.width + photoSideGap : 0);
  const font = { fontFamily: settings._pdfFontFamily };
  let nameCap;
  // The width the contacts are laid out in (2 Grid sizes its cells with it): the whole header
  // under a centred letterhead and under Below All, what the photo leaves under Below Name.
  let contactsWidth = !centered && fieldsPos === 'below-name' ? beside : headerWidth;
  let layout = centered ? 'centered' : fieldsPos;
  if (layout === 'right') {
    if (!hasContacts) {
      nameCap = beside;
    } else {
      const room = beside - sideGap;
      const contactsNeed = contactRowMinWidth(personal, contactSettings, hidden, rowGaps) + SLACK;
      const nameNeed = Math.max(widestWord(name, { ...font, ...nameStyle }), widestWord(personal?.title, { ...font, ...titleStyle })) + SLACK;
      // Beside the name the contacts get at least what their widest item needs; under it, the row.
      // Each on one line: a line's last glyph has no space after it to kern into.
      const nameLine = Math.max(textWidth(name, { ...font, ...nameStyle }), textWidth(personal?.title, { ...font, ...titleStyle }));
      const twoCells = contacts.layout === '2grid' && contactItems(personal, hidden).length > 1;
      // A lone grid contact beside a name and title on their lines takes only what prints it whole.
      const folded = twoCells ? contactsNeed : contactRowMinWidth(personal, contactSettings, hidden, rowGaps, { folded: true }) + SLACK;
      const need = nameLine + contactsNeed > room && nameLine + folded <= room ? folded : contactsNeed;
      if (nameNeed + contactsNeed <= room && !(twoCells && nameLine + need > room)) {
        nameCap = room - need;
        contactsWidth = need;
      } else { layout = 'below-name'; contactsWidth = beside; }
    }
  }
  // Title ↔ Contacts (Name ↔ Contacts without a title) under the name: the résumé's set value, else
  // the letterhead's own 4 pt (5 under Below All) — its contact row keeps its own 3 pt above that (D5).
  const toContacts = setGapPt(settings, 'titleContactsGap');
  const contactEl = <PdfContactRow personal={personal} hidden={hidden} settings={contactSettings} gaps={rowGaps} color={look.contacts} markColor={look.marks} width={contactsWidth} />;
  // A name word wider even than the room the name ends up with (a 35-letter surname at 28 pt) has
  // nowhere to break, and react-pdf drew it past the margin, off the paper: it prints at the
  // largest size that holds it. Beside the contacts it always fits (nameNeed).
  const nameFit = { ...nameStyle, fontSize: fitFontSize(name, { ...font, ...nameStyle }, nameCap ?? beside) };

  // Inline, as Classic's, Minimal's and Executive's headers: a row the title wraps onto the next
  // line of when the room left beside the name cannot hold it, centred with the letterhead.
  const row = look.inline
    ? { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: look.inline.gap, justifyContent: centered ? 'center' : 'flex-start' }
    : {};
  const nameBlock = (
    <View style={{ minWidth: 0, maxWidth: nameCap, ...(centered ? { alignSelf: 'stretch' } : {}), ...row }}>
      <Text style={nameFit}>{name}</Text>
      {personal?.title ? <Text style={titleStyle}>{personal.title}</Text> : null}
    </View>
  );

  function content() {
    if (layout === 'centered') {
      // A centred résumé header's stack: photo above the name, contacts under it.
      return (
        <View style={{ alignItems: 'center' }}>
          {photoEl}
          {nameBlock}
          <View style={{ marginTop: toContacts ?? 4, alignSelf: 'stretch' }}>{contactEl}</View>
        </View>
      );
    }
    if (layout === 'below-name') {
      return (
        <View style={{ flexDirection: photoDir, alignItems: photoAlign }}>
          {photoEl}
          <View style={{ flex: 1, minWidth: 0 }}>
            {nameBlock}
            {contactEl ? <View style={{ marginTop: toContacts ?? 4 }}>{contactEl}</View> : null}
          </View>
        </View>
      );
    }
    if (layout === 'below-all') {
      // The name block takes the row's width left of the photo, so a long title wraps there
      // instead of running past the margin (it kept its one-line width).
      return (
        <View>
          <View style={{ flexDirection: photoDir, alignItems: photoAlign }}>
            {photoEl}
            <View style={{ flex: 1, minWidth: 0 }}>{nameBlock}</View>
          </View>
          {contactEl ? <View style={{ marginTop: toContacts ?? 5 }}>{contactEl}</View> : null}
        </View>
      );
    }
    // 'right' — default: name+photo on left (at most nameCap), contact on right
    return (
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: photoDir, alignItems: photoAlign }}>
          {photoEl}
          {nameBlock}
        </View>
        {hasContacts ? <View style={{ flex: 1, alignItems: 'flex-end', marginLeft: sideGap }}>{contactEl}</View> : null}
      </View>
    );
  }

  // On a band a link's Accent is the tint of it that reads there (Design → Links, R2-147).
  return <Frame look={look} settings={settings}><LinkGround.Provider value={look.band?.color || null}>{content()}</LinkGround.Provider></Frame>;
}
