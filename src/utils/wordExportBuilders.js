import { BorderStyle, Paragraph, ShadingType } from 'docx';
import {
  accent2Hex, bold, normal, linked, sectionHeading, bulletPoint, descriptionToParagraphs, dateRightPara, centredIf, eighths,
  gapPara, lineSpacing, twips,
} from '@/utils/wordExportUtils';
import { sectionLook } from '@/utils/wordExportLook';
import { headingBorderExtraPt, inSidebarColumn, templateId, upperSectionTitles } from '@/constants/templates';
import { solid } from '@/templates/pdf/shared/pdfColors';
import { sectionHeadingLook } from '@/templates/pdf/shared/sectionHeadingLook';
import { resolveTemplateSettings } from '@/templates/pdf/shared/templateSettings';
import { getDateColor, getEffectiveSpacing } from '@/templates/pdf/shared/PdfSections';
import { hasRichText } from '@/utils/richText';
import { dateRange, formatDate, presentLabel } from '@/utils/dates';
import { skillCategory, skillGroup, skillSeparator } from '@/utils/skills';

/**
 * Design → Section Headings in Word, as PdfSectionTitle draws them (ONB-12-NB1), from the résumé's
 * resolved settings `s`: the title in the template's colour for the style (sectionHeadingLook), and
 * Ruled, Underline and Line as a bottom border, Left bar as a left border, Boxed as the paragraph's
 * shading — at the stored Thickness (Left bar's the wider bar the PDF prints) and Border colour.
 * Word has no rule beside a title: Line's rules print under it. Plain, and a style the app does not
 * offer (the PDF's plain), print the title alone; so does a Thickness no rule is drawn at.
 */
function headingOf(s, template) {
  const look = sectionHeadingLook({ template: templateId(template), headingStyle: s.headingStyle, accent: s.accentColor || '#2563eb', borderColor: s.sectionBorderColor || '' });
  const hex = (c) => accent2Hex(solid(c), accent2Hex(solid(s.accentColor), '2563eb'));
  const width = Number(s.sectionBorderWidth);
  const drawn = Number.isFinite(width) && width > 0;
  const rule = (side, color, pt, space) => ({ border: { [side]: { style: BorderStyle.SINGLE, size: eighths(pt), color: hex(color), space } } });
  const color = hex(look.text);
  const size = Math.round(((s.fontSizeBase ?? 11) + (s.fontSizeSectionDelta ?? 1)) * 2);
  if (s.headingStyle === 'box') return { color, size, shading: { type: ShadingType.CLEAR, color: 'auto', fill: hex(look.box) } };
  if (!drawn) return { color, size };
  if (s.headingStyle === 'ruled') return { color, size, ...rule('bottom', look.ruled, width, 2) };
  if (s.headingStyle === 'underline') return { color, size, ...rule('bottom', look.underline, width, 2) };
  if (s.headingStyle === 'line') return { color, size, ...rule('bottom', look.line, width, 2) };
  if (s.headingStyle === 'leftbar') return { color, size, ...rule('left', look.bar, width + headingBorderExtraPt('leftbar'), 6) };
  return { color, size };
}

/**
 * A section title as the PDF prints it in the main column: Design → Title case and Section Headings
 * (headingOf). The Sidebar's "About Me" over its summary reads it too (FIDB-51-VF3-NB2-NB1-NB1).
 */
export function buildSectionTitle(title, settings, template) {
  const s = resolveTemplateSettings(settings, templateId(template));
  const text = String(title || '');
  const heading = { ...headingOf(s, template), lineHeight: s.lineHeightValue };
  return sectionHeading(upperSectionTitles(s.sectionTitleCase) ? text.toUpperCase() : text, accent2Hex(settings?.accentColor), false, heading);
}

/** Items the user has not hidden (the eye toggle on an entry). */
const shown = (section) => (section.items || []).filter((item) => item && item.visible !== false);
/** A field of an entry, or '' when its eye toggle hides it. */
const field = (item, key) => ((item.hiddenFields || []).includes(key) ? '' : (item[key] || ''));

/**
 * The entries of `section` the user has not hidden, each as `build` makes it (its paragraphs), with
 * the look's gap between two (Design → Between Items), as the PDF spaces them. An entry that prints
 * nothing takes no gap. `look` is sectionLook's: sizes, spacing and colours.
 */
function entries(section, look, build) {
  const out = [];
  for (const item of shown(section)) {
    const paras = build(item).filter(Boolean);
    if (!paras.length) continue;
    if (out.length) out.push(...gapPara(look.gap));
    out.push(...paras);
  }
  return out;
}

/**
 * An entry's location for dateRightPara: a line of its own under the date, in the size and the
 * colour the PDF prints it in (`place`: the Text colour's muted shade, Compact's meta) — the PDF
 * prints it with the date, never in the title's text (ATS-1).
 */
const place = (text, look) => (text ? { text, color: look.ink.place, size: look.place } : null);

/** An entry's title line (dateRightPara) with its `date` in `dateHex`, at the look's right tab. */
const titleLine = (left, date, dateHex, centered, look, where = null) => dateRightPara(left, date, { color: dateHex, centered, size: look.date, place: where, tab: look.tab });

/**
 * An entry's first field, bold in the Text colour at Entry Header, and its second in the PDF's
 * colour and size for it (the sub line's, `look.sub`: Base, R2-118).
 */
const first = (text, look) => text && bold(text, { size: look.entry, color: look.ink.text });
const second = (text, look, color = look.ink.second, size = look.sub) => normal(text, { size, color });

/**
 * Description + legacy bullets of an entry, centred in a centred section, at Design → Line Height,
 * at the PDF's size for them (`look.body`, R2-118), in the Text colour's body shade (`color`: an
 * award's, which the PDF prints in its sub shade).
 */
function body(item, centered, look, color = look.ink.body) {
  const paras = [];
  const description = field(item, 'description');
  if (hasRichText(description)) paras.push(...descriptionToParagraphs(description, { size: look.body, color, lineHeight: look.line }, centered ? 'center' : null));
  for (const b of item.bullets || []) if (b) paras.push(bulletPoint(b, centered, { size: look.body, color }, look.line));
  return paras;
}

export function buildExperience(section, accentHex, settings, centered, dateHex, look) {
  const s = section.settings || {};
  return [sectionHeading(section.title, accentHex, centered, section.heading), ...entries(section, look, (item) => {
    const company = field(item, 'company');
    const role = field(item, 'role');
    const [primary, secondary] = s.titleOrder === 'role' ? [role, company] : [company, role];
    const location = s.showLocation !== false ? field(item, 'location') : '';
    const end = field(item, 'endDate') && !item.current ? field(item, 'endDate') : '';
    const dates = dateRange(field(item, 'startDate'), item.current && !(item.hiddenFields || []).includes('endDate') ? presentLabel(settings) : end, settings);
    return [titleLine([
      first(primary, look),
      ...(secondary ? [second(`${primary ? ' — ' : ''}${secondary}`, look)] : []),
    ], s.showDates !== false ? dates : '', dateHex, centered, look, place(location, look)), ...body(item, centered, look)];
  })];
}

export function buildEducation(section, accentHex, settings, centered, dateHex, look) {
  const s = section.settings || {};
  return [sectionHeading(section.title, accentHex, centered, section.heading), ...entries(section, look, (item) => {
    const degree = [item.degree, item.fieldOfStudy].filter(Boolean).join(', ');
    const location = s.showLocation !== false ? item.location : '';
    return [titleLine([
      first(item.institution || degree, look),
      ...(item.institution && degree ? [second(` — ${degree}`, look)] : []),
      ...(item.gpa ? [second(` · GPA: ${item.gpa}`, look)] : []),
    ], s.showDates !== false ? dateRange(item.startDate, item.endDate, settings) : '', dateHex, centered, look, place(location, look)), ...body(item, centered, look)];
  })];
}

/**
 * Skill groups, each category cased as the PDF prints it (skillCategory; `look.side`: the Sidebar's),
 * in its colours (R2-063): the category in the Text colour (the accent on Modern, and in Tags and
 * Bars), the skills in its sub shade — Tags in the accent (Minimal's in the sub shade), Bars at 80 %.
 * Both at Entry Header, as the PDF prints them (R2-118): Tags half a point under it, Bars a point.
 */
export function buildSkills(section, accentHex, settings, centered, dateHex, look) {
  const s = section.settings || {};
  const sep = skillSeparator(s);
  const bulletStyle = s.skillsStyle === 'bullet';
  const chips = s.skillsStyle === 'tags' || s.skillsStyle === 'bars';
  const categoryInk = chips || look.template === 'modern' ? accentHex : look.ink.text;
  const skillsInk = { tags: look.template === 'minimal' ? look.ink.sub : accentHex, bars: look.ink.bar }[s.skillsStyle] || look.ink.sub;
  const skillsSize = look.entry - ({ tags: 1, bars: 2 }[s.skillsStyle] || 0);
  return [sectionHeading(section.title, accentHex, centered, section.heading), ...entries(section, look, (item) => {
    const { category: typed, skills } = skillGroup(item);
    const category = skillCategory(typed, { style: s.skillsStyle, sideColumn: look.side });
    const children = [];
    if (category) children.push(bold(`${category}${skills ? sep : ''}`, { size: look.entry, color: categoryInk }));
    if (skills) children.push(normal(skills, { size: skillsSize, color: skillsInk }));
    return children.length ? [new Paragraph({
      children,
      spacing: { after: 0, ...lineSpacing(look.line, look.entry) },
      ...(bulletStyle ? { bullet: { level: 0 }, indent: { left: 360 } } : {}),
      ...centredIf(centered),
    })] : [];
  })];
}

export function buildProjects(section, accentHex, settings, centered, dateHex, look) {
  const s = section.settings || {};
  return [sectionHeading(section.title, accentHex, centered, section.heading), ...entries(section, look, (item) => [
    titleLine([
      first(item.name, look),
      ...(item.technologies ? [second(` · ${item.technologies}`, look, look.ink.tech)] : []),
      ...(item.url ? [second(' · ', look, accentHex, look.link), linked(item.url, item.url, { size: look.link, color: accentHex })] : []),
    ], s.showDates !== false ? dateRange(item.startDate, item.endDate, settings) : '', dateHex, centered, look),
    ...body(item, centered, look),
  ])];
}

export function buildLanguages(section, accentHex, settings, centered, dateHex, look) {
  return [sectionHeading(section.title, accentHex, centered, section.heading), ...entries(section, look, (item) => (!item.language && !item.proficiency ? [] : [
    new Paragraph({
      children: [
        // Both at Base, as the PDF prints them (R2-118).
        ...(item.language ? [bold(item.language, { size: look.base, color: look.ink.text })] : []),
        ...(item.proficiency ? [second(`${item.language ? ' — ' : ''}${item.proficiency}`, look, look.ink.sub, look.base)] : []),
      ],
      spacing: { after: 0 },
      ...centredIf(centered),
    }),
  ]))];
}

export function buildCertifications(section, accentHex, settings, centered, dateHex, look) {
  const s = section.settings || {};
  return [sectionHeading(section.title, accentHex, centered, section.heading), ...entries(section, look, (item) => [
    titleLine([
      first(item.name || item.title, look),
      // The name's line at Entry Header, all of it, as the PDF prints it.
      ...(item.issuer ? [second(` — ${item.issuer}`, look, look.ink.sub, look.entry)] : []),
      ...(item.credentialId ? [second(` · ID: ${item.credentialId}`, look, look.ink.muted, look.entry)] : []),
      ...(item.url ? [second(' · ', look, accentHex, look.entry), linked(item.urlLabel || item.url, item.url, { size: look.entry, color: accentHex })] : []),
    ], s.showDates !== false ? dateRange(item.date, item.expiry, settings) : '', dateHex, centered, look),
  ])];
}

export function buildAwards(section, accentHex, settings, centered, dateHex, look) {
  const s = section.settings || {};
  return [sectionHeading(section.title, accentHex, centered, section.heading), ...entries(section, look, (item) => [
    titleLine([
      first(item.title, look),
      ...(item.issuer ? [second(` — ${item.issuer}`, look, look.ink.sub)] : []),
    ], s.showDates !== false ? formatDate(item.date || '', settings) : '', dateHex, centered, look),
    ...body(item, centered, look, look.ink.sub),
  ])];
}

export function buildVolunteering(section, accentHex, settings, centered, dateHex, look) {
  const s = section.settings || {};
  return [sectionHeading(section.title, accentHex, centered, section.heading), ...entries(section, look, (item) => {
    const location = s.showLocation !== false ? item.location : '';
    return [titleLine([
      first(item.role || item.org, look),
      ...(item.role && item.org ? [second(` — ${item.org}`, look)] : []),
    ], s.showDates !== false ? dateRange(item.startDate, item.endDate, settings) : '', dateHex, centered, look, place(location, look)), ...body(item, centered, look)];
  })];
}

export function buildReferences(section, accentHex, settings, centered, dateHex, look) {
  const line = (children, after = 20) => new Paragraph({ children, spacing: { after }, ...centredIf(centered) });
  const { ink } = look;
  return [sectionHeading(section.title, accentHex, centered, section.heading), ...entries(section, look, (item) => {
    // A card of Base-size lines, the name's too, as the PDF prints it (R2-118).
    const paras = [line([bold(item.name, { size: look.base, color: ink.text })])];
    const role = [item.jobTitle, item.company].filter(Boolean).join(', ');
    if (role) paras.push(line([normal(role, { size: look.base, color: ink.sub })]));
    if (item.relationship) paras.push(line([normal(item.relationship, { size: look.base, color: ink.meta, italics: true })]));
    const reach = [
      item.email && linked(item.email, `mailto:${item.email}`, { size: look.base, color: accentHex }),
      item.phone && linked(item.phone, `tel:${item.phone.replace(/[^\d+]/g, '')}`, { size: look.base, color: ink.meta }),
    ].filter(Boolean);
    if (reach.length) paras.push(line(reach.flatMap((r, i) => (i ? [normal('  |  ', { size: look.base, color: ink.muted }), r] : [r]))));
    return paras;
  })];
}

/** The interests on one line, in the accent the PDF prints its interest chips in. */
export function buildInterests(section, accentHex, settings, centered, dateHex, look) {
  const allInterests = shown(section).map((i) => i.interests).filter(Boolean).join(', ');
  if (!allInterests) return [];
  return [
    sectionHeading(section.title, accentHex, centered, section.heading),
    new Paragraph({ children: [normal(allInterests, { size: look.base, color: accentHex })], spacing: { after: 60 }, ...centredIf(centered) }),
  ];
}

export function buildCustom(section, accentHex, settings, centered, dateHex, look) {
  const s = section.settings || {};
  return [sectionHeading(section.title, accentHex, centered, section.heading), ...entries(section, look, (item) => [
    titleLine([
      first(item.title, look),
      ...(item.subtitle ? [second(`${item.title ? ' — ' : ''}${item.subtitle}`, look)] : []),
    ], s.showDates !== false ? formatDate(item.date || '', settings) : '', dateHex, centered, look, place(item.location, look)),
    ...body(item, centered, look),
  ])];
}

/**
 * A section's paragraphs; `settings` are the résumé's (its dates print in its Date format).
 * Section Options → Alignment "Center" centres it as the PDF does: everywhere but the Sidebar's
 * side column (`template`), which prints one left-aligned column whatever the section stores.
 * Its title prints in Design → Title case as the PDF prints it, in both of the Sidebar's columns:
 * in capitals for "ABC", as typed for "Abc" — the template's own when none is stored (Executive's
 * is "Abc"). Design → Spacing spaces it as the PDF does (R2-062): Line Height, Between Items, and
 * the section's own Spacing Override Before above its title; the space under it is
 * sectionSpaceAfter's. Its entries print in the PDF's colours (sectionLook's ink, R2-063).
 */
export function buildSection(section, accentHex, settings, template) {
  if (section.visible === false || !shown(section).length) return [];
  const side = inSidebarColumn(template, section.type);
  const centered = section.settings?.alignment === 'center' && !side;
  const s = resolveTemplateSettings(settings, templateId(template));
  const title = String(section.title || '');
  const sectionTitleSize = Math.round(((s.fontSizeBase ?? 11) + (s.fontSizeSectionDelta ?? 1)) * 2);
  const heading = {
    ...(side ? { size: sectionTitleSize } : headingOf(s, template)),
    before: twips(getEffectiveSpacing(section, s).spaceBefore ?? 0),
    lineHeight: s.lineHeightValue,
  };
  // The date in the PDF's colour for the template, from the Text colour it prints (its own when none is stored).
  const dateHex = accent2Hex(solid(getDateColor({ ...s, _template: templateId(template) })), '6b7280');
  const look = sectionLook(section, settings, s, template, side);
  const args = [{ ...section, title: upperSectionTitles(s.sectionTitleCase) ? title.toUpperCase() : title, heading }, accentHex, settings, centered, dateHex, look];
  switch (section.type) {
    case 'experience':     return buildExperience(...args);
    case 'education':      return buildEducation(...args);
    case 'skills':         return buildSkills(...args);
    case 'projects':       return buildProjects(...args);
    case 'languages':      return buildLanguages(...args);
    case 'certifications': return buildCertifications(...args);
    case 'awards':         return buildAwards(...args);
    case 'volunteering':   return buildVolunteering(...args);
    case 'references':     return buildReferences(...args);
    case 'interests':      return buildInterests(...args);
    default:               return buildCustom(...args);
  }
}

/**
 * The space under a printed section, before the next one: Design → Between Sections, or the
 * section's own Spacing Override After — the PDF's marginBottom (getEffectiveSpacing). The résumé
 * puts it under every section but the last (renderResumeDocx, R2-062).
 */
export function sectionSpaceAfter(section, settings, template) {
  return gapPara(getEffectiveSpacing(section, resolveTemplateSettings(settings, templateId(template))).marginBottom);
}
