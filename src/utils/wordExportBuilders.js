import { BorderStyle, Paragraph, ShadingType } from 'docx';
import {
  accent2Hex, bold, normal, linked, sectionHeading, bulletPoint, descriptionToParagraphs, dateRightPara, centredIf, eighths, spacer,
} from '@/utils/wordExportUtils';
import { headingBorderExtraPt, inSidebarColumn, templateId, upperSectionTitles } from '@/constants/templates';
import { solid } from '@/templates/pdf/shared/pdfColors';
import { sectionHeadingLook } from '@/templates/pdf/shared/sectionHeadingLook';
import { resolveTemplateSettings } from '@/templates/pdf/shared/templateSettings';
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
  if (s.headingStyle === 'box') return { color, shading: { type: ShadingType.CLEAR, color: 'auto', fill: hex(look.box) } };
  if (!drawn) return { color };
  if (s.headingStyle === 'ruled') return { color, ...rule('bottom', look.ruled, width, 2) };
  if (s.headingStyle === 'underline') return { color, ...rule('bottom', look.underline, width, 2) };
  if (s.headingStyle === 'line') return { color, ...rule('bottom', look.line, width, 2) };
  if (s.headingStyle === 'leftbar') return { color, ...rule('left', look.bar, width + headingBorderExtraPt('leftbar'), 6) };
  return { color };
}

/** Items the user has not hidden (the eye toggle on an entry). */
const shown = (section) => (section.items || []).filter((item) => item && item.visible !== false);
/** A field of an entry, or '' when its eye toggle hides it. */
const field = (item, key) => ((item.hiddenFields || []).includes(key) ? '' : (item[key] || ''));

/** Description + legacy bullets of an entry, centred in a centred section. */
function body(item, centered) {
  const paras = [];
  const description = field(item, 'description');
  if (hasRichText(description)) paras.push(...descriptionToParagraphs(description, undefined, centered ? 'center' : null));
  for (const b of item.bullets || []) if (b) paras.push(bulletPoint(b, centered));
  return paras;
}

export function buildExperience(section, accentHex, settings, centered) {
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
      primary && bold(primary, { size: 20 }),
      ...(secondary ? [normal(`${primary ? ' — ' : ''}${secondary}`, { size: 20 })] : []),
      ...(location ? [normal(`, ${location}`, { size: 20, color: GREY })] : []),
    ], s.showDates !== false ? dates : '', accentHex, centered));
    paras.push(...body(item, centered), spacer());
  }
  return paras;
}

export function buildEducation(section, accentHex, settings, centered) {
  const s = section.settings || {};
  const paras = [sectionHeading(section.title, accentHex, centered, section.heading)];
  for (const item of shown(section)) {
    const degree = [item.degree, item.fieldOfStudy].filter(Boolean).join(', ');
    const location = s.showLocation !== false ? item.location : '';
    paras.push(dateRightPara([
      (item.institution || degree) && bold(item.institution || degree, { size: 20 }),
      ...(item.institution && degree ? [normal(` — ${degree}`, { size: 20 })] : []),
      ...(item.gpa ? [normal(` · GPA: ${item.gpa}`, { size: 20, color: GREY })] : []),
      ...(location ? [normal(`, ${location}`, { size: 20, color: GREY })] : []),
    ], s.showDates !== false ? dateRange(item.startDate, item.endDate, settings) : '', accentHex, centered));
    paras.push(...body(item, centered), spacer());
  }
  return paras;
}

/** Skill groups, each category cased as the PDF prints it (skillCategory; `sideColumn`: the Sidebar's). */
export function buildSkills(section, accentHex, settings, centered, sideColumn = false) {
  const s = section.settings || {};
  const paras = [sectionHeading(section.title, accentHex, centered, section.heading)];
  const sep = skillSeparator(s);
  const bulletStyle = s.skillsStyle === 'bullet';
  for (const item of shown(section)) {
    const { category: typed, skills } = skillGroup(item);
    const category = skillCategory(typed, { style: s.skillsStyle, sideColumn });
    const children = [];
    if (category) children.push(bold(`${category}${skills ? sep : ''}`, { size: 20, color: accentHex }));
    if (skills) children.push(normal(skills, { size: 20 }));
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

export function buildProjects(section, accentHex, settings, centered) {
  const s = section.settings || {};
  const paras = [sectionHeading(section.title, accentHex, centered, section.heading)];
  for (const item of shown(section)) {
    paras.push(dateRightPara([
      item.name && bold(item.name, { size: 20 }),
      ...(item.technologies ? [normal(` · ${item.technologies}`, { size: 20, color: GREY })] : []),
      ...(item.url ? [normal(' · ', { size: 20, color: GREY }), linked(item.url, item.url, { size: 20, color: accentHex })] : []),
    ], s.showDates !== false ? dateRange(item.startDate, item.endDate, settings) : '', accentHex, centered));
    paras.push(...body(item, centered), spacer());
  }
  return paras;
}

export function buildLanguages(section, accentHex, settings, centered) {
  const paras = [sectionHeading(section.title, accentHex, centered, section.heading)];
  for (const item of shown(section)) {
    if (!item.language && !item.proficiency) continue;
    paras.push(new Paragraph({
      children: [
        bold(item.language, { size: 20 }),
        ...(item.proficiency ? [normal(`${item.language ? ' — ' : ''}${item.proficiency}`, { size: 20, color: GREY })] : []),
      ],
      spacing: { after: 40 },
      ...centredIf(centered),
    }));
  }
  return paras;
}

export function buildCertifications(section, accentHex, settings, centered) {
  const s = section.settings || {};
  const paras = [sectionHeading(section.title, accentHex, centered, section.heading)];
  for (const item of shown(section)) {
    paras.push(dateRightPara([
      (item.name || item.title) && bold(item.name || item.title, { size: 20 }),
      ...(item.issuer ? [normal(` — ${item.issuer}`, { size: 20 })] : []),
      ...(item.credentialId ? [normal(` · ID: ${item.credentialId}`, { size: 20, color: GREY })] : []),
      ...(item.url ? [normal(' · ', { size: 20, color: GREY }), linked(item.urlLabel || item.url, item.url, { size: 20, color: accentHex })] : []),
    ], s.showDates !== false ? dateRange(item.date, item.expiry, settings) : '', accentHex, centered));
    paras.push(spacer(40));
  }
  return paras;
}

export function buildAwards(section, accentHex, settings, centered) {
  const s = section.settings || {};
  const paras = [sectionHeading(section.title, accentHex, centered, section.heading)];
  for (const item of shown(section)) {
    paras.push(dateRightPara([
      item.title && bold(item.title, { size: 20 }),
      ...(item.issuer ? [normal(` — ${item.issuer}`, { size: 20 })] : []),
    ], s.showDates !== false ? formatDate(item.date || '', settings) : '', accentHex, centered));
    paras.push(...body(item, centered), spacer(40));
  }
  return paras;
}

export function buildVolunteering(section, accentHex, settings, centered) {
  const s = section.settings || {};
  const paras = [sectionHeading(section.title, accentHex, centered, section.heading)];
  for (const item of shown(section)) {
    const location = s.showLocation !== false ? item.location : '';
    paras.push(dateRightPara([
      (item.role || item.org) && bold(item.role || item.org, { size: 20 }),
      ...(item.role && item.org ? [normal(` — ${item.org}`, { size: 20 })] : []),
      ...(location ? [normal(`, ${location}`, { size: 20, color: GREY })] : []),
    ], s.showDates !== false ? dateRange(item.startDate, item.endDate, settings) : '', accentHex, centered));
    paras.push(...body(item, centered), spacer());
  }
  return paras;
}

export function buildReferences(section, accentHex, settings, centered) {
  const paras = [sectionHeading(section.title, accentHex, centered, section.heading)];
  const line = (children, after = 20) => new Paragraph({ children, spacing: { after }, ...centredIf(centered) });
  for (const item of shown(section)) {
    paras.push(line([bold(item.name, { size: 20 })]));
    const role = [item.jobTitle, item.company].filter(Boolean).join(', ');
    if (role) paras.push(line([normal(role, { size: 20, color: GREY })]));
    if (item.relationship) paras.push(line([normal(item.relationship, { size: 20, color: GREY, italics: true })]));
    const reach = [
      item.email && linked(item.email, `mailto:${item.email}`, { size: 20, color: accentHex }),
      item.phone && linked(item.phone, `tel:${item.phone.replace(/[^\d+]/g, '')}`, { size: 20, color: GREY }),
    ].filter(Boolean);
    if (reach.length) paras.push(line(reach.flatMap((r, i) => (i ? [normal('  |  ', { size: 20, color: GREY }), r] : [r]))));
    paras.push(spacer());
  }
  return paras;
}

export function buildInterests(section, accentHex, settings, centered) {
  const allInterests = shown(section).map((i) => i.interests).filter(Boolean).join(', ');
  if (!allInterests) return [];
  return [
    sectionHeading(section.title, accentHex, centered, section.heading),
    new Paragraph({ children: [normal(allInterests, { size: 20 })], spacing: { after: 60 }, ...centredIf(centered) }),
  ];
}

export function buildCustom(section, accentHex, settings, centered) {
  const s = section.settings || {};
  const paras = [sectionHeading(section.title, accentHex, centered, section.heading)];
  for (const item of shown(section)) {
    paras.push(dateRightPara([
      ...(item.title ? [bold(item.title, { size: 20 })] : []),
      ...(item.subtitle ? [normal(`${item.title ? ' — ' : ''}${item.subtitle}`, { size: 20 })] : []),
      ...(item.location ? [normal(`, ${item.location}`, { size: 20, color: GREY })] : []),
    ], s.showDates !== false ? formatDate(item.date || '', settings) : '', accentHex, centered));
    paras.push(...body(item, centered), spacer());
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
  const heading = side ? null : headingOf(s, template);
  const args = [{ ...section, title: upperSectionTitles(s.sectionTitleCase) ? title.toUpperCase() : title, heading }, accentHex, settings, centered];
  switch (section.type) {
    case 'experience':     return buildExperience(...args);
    case 'education':      return buildEducation(...args);
    case 'skills':         return buildSkills(...args, inSidebarColumn(template, section.type));
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
