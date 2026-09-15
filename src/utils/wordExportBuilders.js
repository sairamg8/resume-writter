import { Paragraph, TextRun } from 'docx';
import {
  bold, normal, linked, separator, sectionHeading, bulletPoint, descriptionToParagraphs, dateRightPara,
} from '@/utils/wordExportUtils';
import { contactItems } from '@/utils/contacts';
import { hasRichText } from '@/utils/richText';
import { dateRange } from '@/utils/dates';
import { skillGroup, skillSeparator } from '@/utils/skills';

const GREY = '6b7280';
const spacer = (after = 60) => new Paragraph({ children: [], spacing: { after } });

/** Items the user has not hidden (the eye toggle on an entry). */
const shown = (section) => (section.items || []).filter((item) => item && item.visible !== false);
/** A field of an entry, or '' when its eye toggle hides it. */
const field = (item, key) => ((item.hiddenFields || []).includes(key) ? '' : (item[key] || ''));

/** Description + legacy bullets of an entry. */
function body(item) {
  const paras = [];
  const description = field(item, 'description');
  if (hasRichText(description)) paras.push(...descriptionToParagraphs(description));
  for (const b of item.bullets || []) if (b) paras.push(bulletPoint(b));
  return paras;
}

export function buildPersonalSection(personal = {}, settings = {}) {
  const hidden = new Set(personal.hiddenFields || []);
  const accentHex = settings?.accentColor?.replace('#', '') || '2563eb';
  const paragraphs = [];

  paragraphs.push(new Paragraph({
    children: [new TextRun({ text: personal.name || 'Your Name', bold: true, size: 40, color: '0f172a' })],
    spacing: { after: 40 },
  }));

  if (personal.title) {
    paragraphs.push(new Paragraph({
      children: [new TextRun({ text: personal.title, size: 24, color: accentHex })],
      spacing: { after: 60 },
    }));
  }

  const contacts = contactItems(personal);
  if (contacts.length) {
    const style = { size: 18, color: '64748b' };
    paragraphs.push(new Paragraph({
      children: contacts.flatMap((c, i) => [
        ...(i ? [normal('  |  ', style)] : []),
        linked(c.value, c.href, style),
      ]),
      spacing: { after: 80 },
    }));
  }

  if (!hidden.has('summary') && hasRichText(personal.summary)) {
    paragraphs.push(separator());
    paragraphs.push(...descriptionToParagraphs(personal.summary, { size: 20, color: '374151', italics: true }));
    paragraphs.push(spacer(80));
  }

  return paragraphs;
}

export function buildExperience(section, accentHex) {
  const s = section.settings || {};
  const paras = [sectionHeading(section.title, accentHex)];
  for (const item of shown(section)) {
    const company = field(item, 'company');
    const role = field(item, 'role');
    const [primary, secondary] = s.titleOrder === 'role' ? [role, company] : [company, role];
    const location = s.showLocation !== false ? field(item, 'location') : '';
    const end = field(item, 'endDate') && !item.current ? field(item, 'endDate') : '';
    const dates = dateRange(field(item, 'startDate'), item.current && !(item.hiddenFields || []).includes('endDate') ? 'Present' : end);
    paras.push(dateRightPara([
      bold(primary, { size: 20 }),
      ...(secondary ? [normal(`${primary ? ' — ' : ''}${secondary}`, { size: 20 })] : []),
      ...(location ? [normal(`, ${location}`, { size: 20, color: GREY })] : []),
    ], s.showDates !== false ? dates : '', accentHex));
    paras.push(...body(item), spacer());
  }
  return paras;
}

export function buildEducation(section, accentHex) {
  const s = section.settings || {};
  const paras = [sectionHeading(section.title, accentHex)];
  for (const item of shown(section)) {
    const degree = [item.degree, item.fieldOfStudy].filter(Boolean).join(', ');
    const location = s.showLocation !== false ? item.location : '';
    paras.push(dateRightPara([
      bold(item.institution || degree, { size: 20 }),
      ...(item.institution && degree ? [normal(` — ${degree}`, { size: 20 })] : []),
      ...(item.gpa ? [normal(` · GPA: ${item.gpa}`, { size: 20, color: GREY })] : []),
      ...(location ? [normal(`, ${location}`, { size: 20, color: GREY })] : []),
    ], s.showDates !== false ? dateRange(item.startDate, item.endDate) : '', accentHex));
    paras.push(...body(item), spacer());
  }
  return paras;
}

export function buildSkills(section, accentHex) {
  const s = section.settings || {};
  const paras = [sectionHeading(section.title, accentHex)];
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
      }));
    }
  }
  return paras;
}

export function buildProjects(section, accentHex) {
  const s = section.settings || {};
  const paras = [sectionHeading(section.title, accentHex)];
  for (const item of shown(section)) {
    paras.push(dateRightPara([
      bold(item.name || '', { size: 20 }),
      ...(item.technologies ? [normal(` · ${item.technologies}`, { size: 20, color: GREY })] : []),
      ...(item.url ? [normal(' · ', { size: 20, color: GREY }), linked(item.url, item.url, { size: 20, color: accentHex })] : []),
    ], s.showDates !== false ? dateRange(item.startDate, item.endDate) : '', accentHex));
    paras.push(...body(item), spacer());
  }
  return paras;
}

export function buildLanguages(section, accentHex) {
  const paras = [sectionHeading(section.title, accentHex)];
  for (const item of shown(section)) {
    if (!item.language && !item.proficiency) continue;
    paras.push(new Paragraph({
      children: [
        bold(item.language, { size: 20 }),
        ...(item.proficiency ? [normal(`${item.language ? ' — ' : ''}${item.proficiency}`, { size: 20, color: GREY })] : []),
      ],
      spacing: { after: 40 },
    }));
  }
  return paras;
}

export function buildCertifications(section, accentHex) {
  const s = section.settings || {};
  const paras = [sectionHeading(section.title, accentHex)];
  for (const item of shown(section)) {
    paras.push(dateRightPara([
      bold(item.name || item.title || '', { size: 20 }),
      ...(item.issuer ? [normal(` — ${item.issuer}`, { size: 20 })] : []),
      ...(item.credentialId ? [normal(` · ID: ${item.credentialId}`, { size: 20, color: GREY })] : []),
      ...(item.url ? [normal(' · ', { size: 20, color: GREY }), linked(item.urlLabel || item.url, item.url, { size: 20, color: accentHex })] : []),
    ], s.showDates !== false ? dateRange(item.date, item.expiry) : '', accentHex));
    paras.push(spacer(40));
  }
  return paras;
}

export function buildAwards(section, accentHex) {
  const s = section.settings || {};
  const paras = [sectionHeading(section.title, accentHex)];
  for (const item of shown(section)) {
    paras.push(dateRightPara([
      bold(item.title || '', { size: 20 }),
      ...(item.issuer ? [normal(` — ${item.issuer}`, { size: 20 })] : []),
    ], s.showDates !== false ? item.date : '', accentHex));
    paras.push(...body(item), spacer(40));
  }
  return paras;
}

export function buildVolunteering(section, accentHex) {
  const s = section.settings || {};
  const paras = [sectionHeading(section.title, accentHex)];
  for (const item of shown(section)) {
    const location = s.showLocation !== false ? item.location : '';
    paras.push(dateRightPara([
      bold(item.role || item.org || '', { size: 20 }),
      ...(item.role && item.org ? [normal(` — ${item.org}`, { size: 20 })] : []),
      ...(location ? [normal(`, ${location}`, { size: 20, color: GREY })] : []),
    ], s.showDates !== false ? dateRange(item.startDate, item.endDate) : '', accentHex));
    paras.push(...body(item), spacer());
  }
  return paras;
}

export function buildReferences(section, accentHex) {
  const paras = [sectionHeading(section.title, accentHex)];
  const line = (children, after = 20) => new Paragraph({ children, spacing: { after } });
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

export function buildInterests(section, accentHex) {
  const allInterests = shown(section).map((i) => i.interests).filter(Boolean).join(', ');
  if (!allInterests) return [];
  return [
    sectionHeading(section.title, accentHex),
    new Paragraph({ children: [normal(allInterests, { size: 20 })], spacing: { after: 60 } }),
  ];
}

export function buildCustom(section, accentHex) {
  const s = section.settings || {};
  const paras = [sectionHeading(section.title, accentHex)];
  for (const item of shown(section)) {
    paras.push(dateRightPara([
      ...(item.title ? [bold(item.title, { size: 20 })] : []),
      ...(item.subtitle ? [normal(`${item.title ? ' — ' : ''}${item.subtitle}`, { size: 20 })] : []),
      ...(item.location ? [normal(`, ${item.location}`, { size: 20, color: GREY })] : []),
    ], s.showDates !== false ? item.date || '' : '', accentHex));
    paras.push(...body(item), spacer());
  }
  return paras;
}

export function buildSection(section, accentHex) {
  if (section.visible === false || !shown(section).length) return [];
  switch (section.type) {
    case 'experience':     return buildExperience(section, accentHex);
    case 'education':      return buildEducation(section, accentHex);
    case 'skills':         return buildSkills(section, accentHex);
    case 'projects':       return buildProjects(section, accentHex);
    case 'languages':      return buildLanguages(section, accentHex);
    case 'certifications': return buildCertifications(section, accentHex);
    case 'awards':         return buildAwards(section, accentHex);
    case 'volunteering':   return buildVolunteering(section, accentHex);
    case 'references':     return buildReferences(section, accentHex);
    case 'interests':      return buildInterests(section, accentHex);
    default:               return buildCustom(section, accentHex);
  }
}
