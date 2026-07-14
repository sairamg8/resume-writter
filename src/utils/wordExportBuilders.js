import { Paragraph, TextRun } from 'docx';
import { bold, normal, separator, sectionHeading, bulletPoint, descriptionToParagraphs, dateRightPara } from '@/utils/wordExportUtils';

export function buildPersonalSection(personal, settings) {
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

  const contactParts = [];
  if (!hidden.has('email')    && personal.email)    contactParts.push(personal.email);
  if (!hidden.has('phone')    && personal.phone)    contactParts.push(personal.phone);
  if (!hidden.has('location') && personal.location) contactParts.push(personal.location);
  if (!hidden.has('website')  && personal.website)  contactParts.push(personal.website);
  if (!hidden.has('linkedin') && personal.linkedin) contactParts.push(personal.linkedin);
  if (!hidden.has('github')   && personal.github)   contactParts.push(personal.github);

  if (contactParts.length) {
    paragraphs.push(new Paragraph({
      children: [new TextRun({ text: contactParts.join('  |  '), size: 18, color: '64748b' })],
      spacing: { after: 80 },
    }));
  }

  if (personal.summary) {
    paragraphs.push(separator());
    paragraphs.push(new Paragraph({
      children: [new TextRun({ text: personal.summary, size: 20, italics: true, color: '374151' })],
      spacing: { after: 80 },
    }));
  }

  return paragraphs;
}

export function buildExperience(section, accentHex) {
  const paras = [sectionHeading(section.title, accentHex)];
  for (const item of section.items) {
    const dateStr = item.startDate
      ? `${item.startDate} – ${item.current ? 'Present' : (item.endDate || '')}`
      : (item.endDate || '');
    const leftChildren = [
      bold(item.company || '', { size: 20 }),
      ...(item.role ? [normal(` — ${item.role}`, { size: 20 })] : []),
      ...(section.settings?.showLocation !== false && item.location ? [normal(`, ${item.location}`, { size: 20, color: '6b7280' })] : []),
    ];
    paras.push(dateRightPara(leftChildren, section.settings?.showDates !== false ? dateStr : '', accentHex));
    if (item.description) paras.push(...descriptionToParagraphs(item.description));
    for (const b of (item.bullets || [])) { if (b) paras.push(bulletPoint(b)); }
    paras.push(new Paragraph({ children: [], spacing: { after: 60 } }));
  }
  return paras;
}

export function buildEducation(section, accentHex) {
  const paras = [sectionHeading(section.title, accentHex)];
  for (const item of section.items) {
    const dateStr = item.startDate ? `${item.startDate} – ${item.endDate || ''}` : (item.endDate || '');
    const leftChildren = [
      bold(item.degree || '', { size: 20 }),
      ...(item.institution ? [normal(` — ${item.institution}`, { size: 20 })] : []),
      ...(item.gpa ? [normal(` · GPA: ${item.gpa}`, { size: 20, color: '6b7280' })] : []),
    ];
    paras.push(dateRightPara(leftChildren, section.settings?.showDates !== false ? dateStr : '', accentHex));
    if (item.description) paras.push(...descriptionToParagraphs(item.description));
    for (const b of (item.bullets || [])) { if (b) paras.push(bulletPoint(b)); }
    paras.push(new Paragraph({ children: [], spacing: { after: 60 } }));
  }
  return paras;
}

export function buildSkills(section, accentHex) {
  const paras = [sectionHeading(section.title, accentHex)];
  const sep = section.settings?.separator === 'dash' ? ' – ' : ': ';
  const bulletStyle = section.settings?.skillsStyle === 'bullet';
  for (const item of section.items) {
    const children = [];
    if (item.category) children.push(bold(`${item.category}${item.skills ? sep : ''}`, { size: 20, color: accentHex }));
    if (item.skills) children.push(normal(item.skills, { size: 20 }));
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
  const paras = [sectionHeading(section.title, accentHex)];
  for (const item of section.items) {
    const dateStr = item.startDate ? `${item.startDate} – ${item.endDate || ''}` : (item.endDate || '');
    const leftChildren = [
      bold(item.name || '', { size: 20 }),
      ...(item.technologies ? [normal(` · ${item.technologies}`, { size: 20, color: '6b7280' })] : []),
      ...(item.url ? [normal(` · ${item.url}`, { size: 20, color: accentHex })] : []),
    ];
    paras.push(dateRightPara(leftChildren, section.settings?.showDates !== false ? dateStr : '', accentHex));
    if (item.description) paras.push(...descriptionToParagraphs(item.description));
    for (const b of (item.bullets || [])) { if (b) paras.push(bulletPoint(b)); }
    paras.push(new Paragraph({ children: [], spacing: { after: 60 } }));
  }
  return paras;
}

export function buildLanguages(section, accentHex) {
  const paras = [sectionHeading(section.title, accentHex)];
  for (const item of section.items) {
    paras.push(new Paragraph({
      children: [bold(item.language, { size: 20 }), normal(` — ${item.proficiency}`, { size: 20, color: '6b7280' })],
      spacing: { after: 40 },
    }));
  }
  return paras;
}

export function buildCertifications(section, accentHex) {
  const paras = [sectionHeading(section.title, accentHex)];
  for (const item of section.items) {
    const leftChildren = [
      bold(item.name || '', { size: 20 }),
      ...(item.issuer ? [normal(` — ${item.issuer}`, { size: 20 })] : []),
    ];
    paras.push(dateRightPara(leftChildren, section.settings?.showDates !== false ? item.date : '', accentHex));
    paras.push(new Paragraph({ children: [], spacing: { after: 40 } }));
  }
  return paras;
}

export function buildAwards(section, accentHex) {
  const paras = [sectionHeading(section.title, accentHex)];
  for (const item of section.items) {
    const leftChildren = [
      bold(item.title || '', { size: 20 }),
      ...(item.issuer ? [normal(` — ${item.issuer}`, { size: 20 })] : []),
    ];
    paras.push(dateRightPara(leftChildren, section.settings?.showDates !== false ? item.date : '', accentHex));
    if (item.description) paras.push(...descriptionToParagraphs(item.description));
    paras.push(new Paragraph({ children: [], spacing: { after: 40 } }));
  }
  return paras;
}

export function buildVolunteering(section, accentHex) {
  const paras = [sectionHeading(section.title, accentHex)];
  for (const item of section.items) {
    const dateStr = item.startDate ? `${item.startDate} – ${item.endDate || ''}` : '';
    const leftChildren = [
      bold(item.role || '', { size: 20 }),
      ...(item.org ? [normal(` — ${item.org}`, { size: 20 })] : []),
    ];
    paras.push(dateRightPara(leftChildren, section.settings?.showDates !== false ? dateStr : '', accentHex));
    if (item.description) paras.push(...descriptionToParagraphs(item.description));
    for (const b of (item.bullets || [])) { if (b) paras.push(bulletPoint(b)); }
    paras.push(new Paragraph({ children: [], spacing: { after: 60 } }));
  }
  return paras;
}

export function buildReferences(section, accentHex) {
  const paras = [sectionHeading(section.title, accentHex)];
  for (const item of section.items) {
    paras.push(new Paragraph({ children: [bold(item.name, { size: 20 })], spacing: { after: 20 } }));
    if (item.jobTitle) paras.push(new Paragraph({ children: [normal(item.jobTitle, { size: 20, color: '6b7280' })], spacing: { after: 20 } }));
    if (item.company)  paras.push(new Paragraph({ children: [normal(item.company,  { size: 20, color: '6b7280' })], spacing: { after: 20 } }));
    if (item.email)    paras.push(new Paragraph({ children: [normal(item.email,    { size: 20, color: accentHex })], spacing: { after: 20 } }));
    paras.push(new Paragraph({ children: [], spacing: { after: 60 } }));
  }
  return paras;
}

export function buildInterests(section, accentHex) {
  const allInterests = section.items.map(i => i.interests).filter(Boolean).join(', ');
  return [
    sectionHeading(section.title, accentHex),
    new Paragraph({ children: [normal(allInterests, { size: 20 })], spacing: { after: 60 } }),
  ];
}

export function buildCustom(section, accentHex) {
  const paras = [sectionHeading(section.title, accentHex)];
  for (const item of section.items) {
    const leftChildren = [
      ...(item.title    ? [bold(item.title,              { size: 20 })] : []),
      ...(item.subtitle ? [normal(` — ${item.subtitle}`, { size: 20 })] : []),
    ];
    paras.push(dateRightPara(leftChildren, item.date || '', accentHex));
    if (item.description) paras.push(...descriptionToParagraphs(item.description));
    for (const b of (item.bullets || [])) { if (b) paras.push(bulletPoint(b)); }
    paras.push(new Paragraph({ children: [], spacing: { after: 60 } }));
  }
  return paras;
}

export function buildSection(section, accentHex) {
  if (!section.items?.length) return [];
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
