import { Paragraph, TextRun } from 'docx';
import {
  accent2Hex, bold, normal, linked, separator, sectionHeading, bulletPoint, descriptionToParagraphs, dateRightPara, centredIf,
  contactSeparator,
} from '@/utils/wordExportUtils';
import { contactItems } from '@/utils/contacts';
import { hasHeaderControls, inSidebarColumn, templateId } from '@/constants/templates';
import { textShades } from '@/templates/pdf/shared/pdfColors';
import { resolveTemplateSettings } from '@/templates/pdf/shared/templateSettings';
import { hasRichText } from '@/utils/richText';
import { dateRange, formatDate, presentLabel } from '@/utils/dates';
import { skillGroup, skillSeparator } from '@/utils/skills';

const GREY = '6b7280';
const spacer = (after = 60) => new Paragraph({ children: [], spacing: { after } });

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

/**
 * Name, title, contact line and summary. The contact line is the PDF's (PdfContactRow): its values
 * in the Text colour's grey — the template's own Text colour when none is stored — and the marks
 * of Design → Contact Style where the header takes it (`template`: Classic, Minimal, Executive).
 * Modern's banner and the Sidebar column draw icons, and Word prints icons as bars.
 * Header alignment "Center" centres all four where the PDF does — in those same three templates;
 * a summary block aligned in the editor keeps its own alignment, as in the PDF (ONB-3).
 */
export function buildPersonalSection(personal = {}, settings = {}, template = 'classic') {
  const hidden = new Set(personal.hiddenFields || []);
  const accentHex = settings?.accentColor?.replace('#', '') || '2563eb';
  const centered = hasHeaderControls(template) && settings?.headerAlign === 'center';
  const paragraphs = [];

  paragraphs.push(new Paragraph({
    children: [new TextRun({ text: personal.name || 'Your Name', bold: true, size: 40, color: '0f172a' })],
    spacing: { after: 40 },
    ...centredIf(centered),
  }));

  if (personal.title) {
    paragraphs.push(new Paragraph({
      children: [new TextRun({ text: personal.title, size: 24, color: accentHex })],
      spacing: { after: 60 },
      ...centredIf(centered),
    }));
  }

  const contacts = contactItems(personal);
  if (contacts.length) {
    const s = resolveTemplateSettings(settings, templateId(template));
    const style = { size: 18, color: accent2Hex(textShades(s.textColor).sub, '64748b') };
    const contactStyle = hasHeaderControls(template) ? s.contactStyle : 'icon';
    paragraphs.push(new Paragraph({
      children: contacts.flatMap((c, i) => [
        ...(i ? [contactSeparator(contactStyle, style)] : []),
        linked(c.value, c.href, style),
      ]),
      spacing: { after: 80 },
      ...centredIf(centered),
    }));
  }

  if (!hidden.has('summary') && hasRichText(personal.summary)) {
    paragraphs.push(separator());
    paragraphs.push(...descriptionToParagraphs(personal.summary, { size: 20, color: '374151', italics: true }, centered ? 'center' : null));
    paragraphs.push(spacer(80));
  }

  return paragraphs;
}

export function buildExperience(section, accentHex, settings, centered) {
  const s = section.settings || {};
  const paras = [sectionHeading(section.title, accentHex, centered)];
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
  const paras = [sectionHeading(section.title, accentHex, centered)];
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

export function buildSkills(section, accentHex, settings, centered) {
  const s = section.settings || {};
  const paras = [sectionHeading(section.title, accentHex, centered)];
  const sep = skillSeparator(s);
  const bulletStyle = s.skillsStyle === 'bullet';
  for (const item of shown(section)) {
    const { category, skills } = skillGroup(item);
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
  const paras = [sectionHeading(section.title, accentHex, centered)];
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
  const paras = [sectionHeading(section.title, accentHex, centered)];
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
  const paras = [sectionHeading(section.title, accentHex, centered)];
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
  const paras = [sectionHeading(section.title, accentHex, centered)];
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
  const paras = [sectionHeading(section.title, accentHex, centered)];
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
  const paras = [sectionHeading(section.title, accentHex, centered)];
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
    sectionHeading(section.title, accentHex, centered),
    new Paragraph({ children: [normal(allInterests, { size: 20 })], spacing: { after: 60 }, ...centredIf(centered) }),
  ];
}

export function buildCustom(section, accentHex, settings, centered) {
  const s = section.settings || {};
  const paras = [sectionHeading(section.title, accentHex, centered)];
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
 */
export function buildSection(section, accentHex, settings, template) {
  if (section.visible === false || !shown(section).length) return [];
  const centered = section.settings?.alignment === 'center' && !inSidebarColumn(template, section.type);
  const args = [section, accentHex, settings, centered];
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
