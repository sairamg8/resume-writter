/**
 * Markdown Resume Exporter
 * Converts CPWT-CV resume state into clean, formatted GitHub Flavored Markdown (.md).
 */

function stripHtml(html = '') {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<li>/gi, '- ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

export function generateMarkdownResume(resume) {
  if (!resume) return '';
  const p = resume.personal || {};
  const hiddenFields = new Set(p.hiddenFields || []);
  const lines = [];

  // Header
  if (p.name) lines.push(`# ${p.name}`);
  if (p.title) lines.push(`**${p.title}**`);
  lines.push('');

  // Contact details
  const contacts = [];
  if (p.email && !hiddenFields.has('email')) contacts.push(`Email: [${p.email}](mailto:${p.email})`);
  if (p.phone && !hiddenFields.has('phone')) contacts.push(`Phone: ${p.phone}`);
  if (p.location && !hiddenFields.has('location')) contacts.push(`Location: ${p.location}`);
  if (p.website && !hiddenFields.has('website')) {
    const url = p.websiteUrl || (p.website.startsWith('http') ? p.website : `https://${p.website}`);
    contacts.push(`[${p.websiteLabel || p.website}](${url})`);
  }
  if (p.linkedin && !hiddenFields.has('linkedin')) {
    const url = p.linkedinUrl || (p.linkedin.startsWith('http') ? p.linkedin : `https://${p.linkedin}`);
    contacts.push(`[LinkedIn](${url})`);
  }
  if (p.github && !hiddenFields.has('github')) {
    const url = p.githubUrl || (p.github.startsWith('http') ? p.github : `https://${p.github}`);
    contacts.push(`[GitHub](${url})`);
  }

  if (contacts.length > 0) {
    lines.push(contacts.join(' • '));
    lines.push('');
  }

  // Summary
  if (p.summary && !hiddenFields.has('summary')) {
    lines.push('## Professional Summary');
    lines.push(stripHtml(p.summary));
    lines.push('');
  }

  // Sections
  const sections = resume.sections || [];
  for (const s of sections) {
    if (s.visible === false) continue;
    const title = s.title || s.type;
    lines.push(`## ${title}`);

    const items = (s.items || []).filter(i => i.visible !== false);

    if (s.type === 'experience') {
      for (const item of items) {
        const headerParts = [];
        if (item.role) headerParts.push(`**${item.role}**`);
        if (item.company) headerParts.push(`— *${item.company}*`);
        lines.push(`### ${headerParts.join(' ')}`);

        const dateParts = [];
        if (item.startDate || item.endDate || item.current) {
          const end = item.current ? 'Present' : item.endDate || '';
          dateParts.push(`${item.startDate || ''} – ${end}`);
        }
        if (item.location) dateParts.push(item.location);
        if (dateParts.length > 0) lines.push(`*${dateParts.join(' | ')}*`);
        lines.push('');

        if (item.description) {
          lines.push(stripHtml(item.description));
          lines.push('');
        }
      }
    } else if (s.type === 'education') {
      for (const item of items) {
        const headerParts = [];
        if (item.degree) headerParts.push(`**${item.degree}**`);
        if (item.institution) headerParts.push(`— *${item.institution}*`);
        lines.push(`### ${headerParts.join(' ')}`);

        const metaParts = [];
        if (item.startDate || item.endDate) metaParts.push(`${item.startDate || ''} – ${item.endDate || ''}`);
        if (item.location) metaParts.push(item.location);
        if (item.gpa) metaParts.push(`GPA: ${item.gpa}`);
        if (metaParts.length > 0) lines.push(`*${metaParts.join(' | ')}*`);
        lines.push('');

        if (item.description) {
          lines.push(stripHtml(item.description));
          lines.push('');
        }
      }
    } else if (s.type === 'projects') {
      for (const item of items) {
        const titleLine = item.url ? `### [${item.name || 'Project'}](${item.url})` : `### ${item.name || 'Project'}`;
        lines.push(titleLine);
        if (item.technologies) lines.push(`*Technologies: ${item.technologies}*`);
        if (item.startDate || item.endDate) lines.push(`*${item.startDate || ''} – ${item.endDate || ''}*`);
        lines.push('');

        if (item.description) {
          lines.push(stripHtml(item.description));
          lines.push('');
        }
      }
    } else if (s.type === 'skills') {
      const skillsList = items.map(i => i.name).filter(Boolean);
      if (skillsList.length > 0) {
        lines.push(skillsList.map(skill => `- **${skill}**`).join('\n'));
        lines.push('');
      }
    } else {
      // General item list
      for (const item of items) {
        const label = item.title || item.name || item.role || item.organization || '';
        if (label) lines.push(`### ${label}`);
        if (item.description) {
          lines.push(stripHtml(item.description));
          lines.push('');
        }
      }
    }
  }

  return lines.join('\n');
}
