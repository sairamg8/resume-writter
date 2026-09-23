import { BorderStyle, Paragraph, ShadingType } from 'docx';
import {
  accent2Hex, bold, normal, linked, sectionHeading, bulletPoint, descriptionToParagraphs, dateRightPara, centredIf, eighths, spacer,
} from '@/utils/wordExportUtils';
import { headingBorderExtraPt, inSidebarColumn, templateId, upperSectionTitles } from '@/constants/templates';
import { solid } from '@/templates/pdf/shared/pdfColors';
import { sectionHeadingLook } from '@/templates/pdf/shared/sectionHeadingLook';
import { resolveTemplateSettings } from '@/templates/pdf/shared/templateSettings';
import { getDateColor } from '@/templates/pdf/shared/PdfSections';
import { hasRichText } from '@/utils/richText';
import { dateRange, formatDate, presentLabel } from '@/utils/dates';
import { skillCategory, skillGroup, skillSeparator } from '@/utils/skills';

const GREY = '6b7280';

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
  return sectionHeading(upperSectionTitles(s.sectionTitleCase) ? text.toUpperCase() : text, accent2Hex(settings?.accentColor), false, headingOf(s, template));
}

/** Items the user has not hidden (the eye toggle on an entry). */
const shown = (section) => (section.items || []).filter((item) => item && item.visible !== false);
/** A field of an entry, or '' when its eye toggle hides it. */
const field = (item, key) => ((item.hiddenFields || []).includes(key) ? '' : (item[key] || ''));

/** Description + legacy bullets of an entry, centred in a centred section. */
function body(item, centered, baseSize = 22) {
  const paras = [];
  const description = field(item, 'description');
  if (hasRichText(description)) paras.push(...descriptionToParagraphs(description, { size: baseSize, color: '374151' }, centered ? 'center' : null));
  for (const b of item.bullets || []) if (b) paras.push(bulletPoint(b, centered));
  return paras;
}

export function buildExperience(section, accentHex, settings, centered, dateHex = accentHex, sizes = { base: 22, entry: 20 }) {
  const s = section.settings || {};
  const paras = [sectionHeading(section.title, accentHex, centered, section.heading)];
  for (const item of shown(section)) {
    const company = field(item, 'company');
    const role = field(item, 'role');
    const [primary, secondary] = s.titleOrder === 'role' ? [role, company] : [company, role];
    const location = s.showLocation !== false ? field(item, 'location') : '';
    const end = field(item, 'endDate') && !item.current ? field(item, 'endDate') : '';
    const dates = dateRange(field(item, 'startDate'), item.current && !(item.hiddenFields || []).includes('endDate') ? presentLabel(settings) : end, settings);
    paras.push(dateRightPara([
      primary && bold(primary, { size: sizes.entry }),
      ...(secondary ? [normal(`${primary ? ' — ' : ''}${secondary}`, { size: sizes.entry })] : []),
      ...(location ? [normal(`, ${location}`, { size: sizes.entry, color: GREY })] : []),
    ], s.showDates !== false ? dates : '', dateHex, centered, sizes.base));
    paras.push(...body(item, centered, sizes.base), spacer());
  }
  return paras;
}

export function buildEducation(section, accentHex, settings, centered, dateHex = accentHex, sizes = { base: 22, entry: 20 }) {
  const s = section.settings || {};
  const paras = [sectionHeading(section.title, accentHex, centered, section.heading)];
  for (const item of shown(section)) {
    const degree = [item.degree, item.fieldOfStudy].filter(Boolean).join(', ');
    const location = s.showLocation !== false ? item.location : '';
    paras.push(dateRightPara([
      (item.institution || degree) && bold(item.institution || degree, { size: sizes.entry }),
      ...(item.institution && degree ? [normal(` — ${degree}`, { size: sizes.entry })] : []),
      ...(item.gpa ? [normal(` · GPA: ${item.gpa}`, { size: sizes.entry, color: GREY })] : []),
      ...(location ? [normal(`, ${location}`, { size: sizes.entry, color: GREY })] : []),
    ], s.showDates !== false ? dateRange(item.startDate, item.endDate, settings) : '', dateHex, centered, sizes.base));
    paras.push(...body(item, centered, sizes.base), spacer());
  }
  return paras;
}

/** Skill groups, each category cased as the PDF prints it (skillCategory; `sideColumn`: the Sidebar's). */
export function buildSkills(section, accentHex, settings, centered, sideColumn = false, dateHex = accentHex, sizes = { base: 22, entry: 20 }) {
  const s = section.settings || {};
  const paras = [sectionHeading(section.title, accentHex, centered, section.heading)];
  const sep = skillSeparator(s);
  const bulletStyle = s.skillsStyle === 'bullet';
  for (const item of shown(section)) {
    const { category: typed, skills } = skillGroup(item);
    const category = skillCategory(typed, { style: s.skillsStyle, sideColumn });
    const children = [];
    if (category) children.push(bold(`${category}${skills ? sep : ''}`, { size: sizes.entry, color: accentHex }));
    if (skills) children.push(normal(skills, { size: sizes.base }));
    if (children.length) {
      paras.push(new Paragraph({
        children,
        spacing: { after: 40 },
        ...(bulletStyle ? { bullet: { level: 0 }, indent: { left: 360 } } : {}),
        ...centredIf(centered),
      }));
    }
  }
  return paras;
}

export function buildProjects(section, accentHex, settings, centered, dateHex = accentHex, sizes = { base: 22, entry: 20 }) {
  const s = section.settings || {};
  const paras = [sectionHeading(section.title, accentHex, centered, section.heading)];
  for (const item of shown(section)) {
    paras.push(dateRightPara([
      item.name && bold(item.name, { size: sizes.entry }),
      ...(item.technologies ? [normal(` · ${item.technologies}`, { size: sizes.entry, color: GREY })] : []),
      ...(item.url ? [normal(' · ', { size: sizes.entry, color: GREY }), linked(item.url, item.url, { size: sizes.entry, color: accentHex })] : []),
    ], s.showDates !== false ? dateRange(item.startDate, item.endDate, settings) : '', dateHex, centered, sizes.base));
    paras.push(...body(item, centered, sizes.base), spacer());
  }
  return paras;
}

export function buildLanguages(section, accentHex, settings, centered, dateHex = accentHex, sizes = { base: 22, entry: 20 }) {
  const paras = [sectionHeading(section.title, accentHex, centered, section.heading)];
  for (const item of shown(section)) {
    if (!item.language && !item.proficiency) continue;
    paras.push(new Paragraph({
      children: [
        bold(item.language, { size: sizes.entry }),
        ...(item.proficiency ? [normal(`${item.language ? ' — ' : ''}${item.proficiency}`, { size: sizes.entry, color: GREY })] : []),
      ],
      spacing: { after: 40 },
      ...centredIf(centered),
    }));
  }
  return paras;
}

export function buildCertifications(section, accentHex, settings, centered, dateHex = accentHex, sizes = { base: 22, entry: 20 }) {
  const s = section.settings || {};
  const paras = [sectionHeading(section.title, accentHex, centered, section.heading)];
  for (const item of shown(section)) {
    paras.push(dateRightPara([
      (item.name || item.title) && bold(item.name || item.title, { size: sizes.entry }),
      ...(item.issuer ? [normal(` — ${item.issuer}`, { size: sizes.entry })] : []),
      ...(item.credentialId ? [normal(` · ID: ${item.credentialId}`, { size: sizes.entry, color: GREY })] : []),
      ...(item.url ? [normal(' · ', { size: sizes.entry, color: GREY }), linked(item.urlLabel || item.url, item.url, { size: sizes.entry, color: accentHex })] : []),
    ], s.showDates !== false ? dateRange(item.date, item.expiry, settings) : '', dateHex, centered, sizes.base));
    paras.push(spacer(40));
  }
  return paras;
}

export function buildAwards(section, accentHex, settings, centered, dateHex = accentHex, sizes = { base: 22, entry: 20 }) {
  const s = section.settings || {};
  const paras = [sectionHeading(section.title, accentHex, centered, section.heading)];
  for (const item of shown(section)) {
    paras.push(dateRightPara([
      item.title && bold(item.title, { size: sizes.entry }),
      ...(item.issuer ? [normal(` — ${item.issuer}`, { size: sizes.entry })] : []),
    ], s.showDates !== false ? formatDate(item.date || '', settings) : '', dateHex, centered, sizes.base));
    paras.push(...body(item, centered, sizes.base), spacer(40));
  }
  return paras;
}

export function buildVolunteering(section, accentHex, settings, centered, dateHex = accentHex, sizes = { base: 22, entry: 20 }) {
  const s = section.settings || {};
  const paras = [sectionHeading(section.title, accentHex, centered, section.heading)];
  for (const item of shown(section)) {
    const location = s.showLocation !== false ? item.location : '';
    paras.push(dateRightPara([
      (item.role || item.org) && bold(item.role || item.org, { size: sizes.entry }),
      ...(item.role && item.org ? [normal(` — ${item.org}`, { size: sizes.entry })] : []),
      ...(location ? [normal(`, ${location}`, { size: sizes.entry, color: GREY })] : []),
    ], s.showDates !== false ? dateRange(item.startDate, item.endDate, settings) : '', dateHex, centered, sizes.base));
    paras.push(...body(item, centered, sizes.base), spacer());
  }
  return paras;
}

export function buildReferences(section, accentHex, settings, centered, dateHex = accentHex, sizes = { base: 22, entry: 20 }) {
  const paras = [sectionHeading(section.title, accentHex, centered, section.heading)];
  const line = (children, after = 20) => new Paragraph({ children, spacing: { after }, ...centredIf(centered) });
  for (const item of shown(section)) {
    paras.push(line([bold(item.name, { size: sizes.entry })]));
    const role = [item.jobTitle, item.company].filter(Boolean).join(', ');
    if (role) paras.push(line([normal(role, { size: sizes.base, color: GREY })]));
    if (item.relationship) paras.push(line([normal(item.relationship, { size: sizes.base, color: GREY, italics: true })]));
    const reach = [
      item.email && linked(item.email, `mailto:${item.email}`, { size: sizes.base, color: accentHex }),
      item.phone && linked(item.phone, `tel:${item.phone.replace(/[^\d+]/g, '')}`, { size: sizes.base, color: GREY }),
    ].filter(Boolean);
    if (reach.length) paras.push(line(reach.flatMap((r, i) => (i ? [normal('  |  ', { size: sizes.base, color: GREY }), r] : [r]))));
    paras.push(spacer());
  }
  return paras;
}

export function buildInterests(section, accentHex, settings, centered, dateHex = accentHex, sizes = { base: 22, entry: 20 }) {
  const allInterests = shown(section).map((i) => i.interests).filter(Boolean).join(', ');
  if (!allInterests) return [];
  return [
    sectionHeading(section.title, accentHex, centered, section.heading),
    new Paragraph({ children: [normal(allInterests, { size: sizes.base })], spacing: { after: 60 }, ...centredIf(centered) }),
  ];
}

export function buildCustom(section, accentHex, settings, centered, dateHex = accentHex, sizes = { base: 22, entry: 20 }) {
  const s = section.settings || {};
  const paras = [sectionHeading(section.title, accentHex, centered, section.heading)];
  for (const item of shown(section)) {
    paras.push(dateRightPara([
      ...(item.title ? [bold(item.title, { size: sizes.entry })] : []),
      ...(item.subtitle ? [normal(`${item.title ? ' — ' : ''}${item.subtitle}`, { size: sizes.entry })] : []),
      ...(item.location ? [normal(`, ${item.location}`, { size: sizes.entry, color: GREY })] : []),
    ], s.showDates !== false ? formatDate(item.date || '', settings) : '', dateHex, centered, sizes.base));
    paras.push(...body(item, centered, sizes.base), spacer());
  }
  return paras;
}

/**
 * A section's paragraphs; `settings` are the résumé's (its dates print in its Date format).
 * Section Options → Alignment "Center" centres it as the PDF does: everywhere but the Sidebar's
 * side column (`template`), which prints one left-aligned column whatever the section stores.
 * Its title prints in Design → Title case as the PDF prints it, in both of the Sidebar's columns:
 * in capitals for "ABC", as typed for "Abc" — the template's own when none is stored (Executive's
 * is "Abc").
 */
export function buildSection(section, accentHex, settings, template) {
  if (section.visible === false || !shown(section).length) return [];
  const side = inSidebarColumn(template, section.type);
  const centered = section.settings?.alignment === 'center' && !side;
  const s = resolveTemplateSettings(settings, templateId(template));
  const title = String(section.title || '');
  const sectionTitleSize = Math.round(((s.fontSizeBase ?? 11) + (s.fontSizeSectionDelta ?? 1)) * 2);
  const heading = side ? { size: sectionTitleSize } : headingOf(s, template);
  const dateColor = getDateColor({ ...settings, _template: templateId(template) });
  const dateHex = accent2Hex(solid(dateColor), '6b7280');
  const baseSize = Math.round((s.fontSizeBase ?? 11) * 2);
  const entrySize = Math.round(((s.fontSizeBase ?? 11) + (s.fontSizeEntryDelta ?? 0)) * 2);
  const sizes = { base: baseSize, entry: entrySize };
  const args = [{ ...section, title: upperSectionTitles(s.sectionTitleCase) ? title.toUpperCase() : title, heading }, accentHex, settings, centered, dateHex, sizes];
  switch (section.type) {
    case 'experience':     return buildExperience(...args);
    case 'education':      return buildEducation(...args);
    case 'skills':         return buildSkills(args[0], args[1], args[2], args[3], side, dateHex, sizes);
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
