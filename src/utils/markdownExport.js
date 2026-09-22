import { dateRange, formatDate, presentLabel } from './dates.js';

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

const field = (item, key) => ((item.hiddenFields || []).includes(key) ? '' : (item[key] || ''));

export function generateMarkdownResume(resume) {
  if (!resume) return '';
  const p = resume.personal || {};
  const settings = resume.settings || {};
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
    const items = (s.items || []).filter(i => i && i.visible !== false);
    if (!items.length) continue;

    const title = s.title || s.type;
    lines.push(`## ${title}`);

    if (s.type === 'experience') {
      for (const item of items) {
        const role = field(item, 'role');
        const company = field(item, 'company');
        const headerParts = [];
        if (role) headerParts.push(`**${role}**`);
        if (company) headerParts.push(`— *${company}*`);
        if (headerParts.length > 0) lines.push(`### ${headerParts.join(' ')}`);

        const start = field(item, 'startDate');
        const end = (item.hiddenFields || []).includes('endDate') ? '' : (item.current ? presentLabel(settings) : field(item, 'endDate'));
        const dates = dateRange(start, end, settings);
        const location = field(item, 'location');
        const dateParts = [dates, location].filter(Boolean);
        if (dateParts.length > 0) lines.push(`*${dateParts.join(' | ')}*`);
        lines.push('');

        const desc = field(item, 'description');
        if (desc) {
          lines.push(stripHtml(desc));
          lines.push('');
        }
      }
    } else if (s.type === 'education') {
      for (const item of items) {
        const degree = field(item, 'degree');
        const institution = field(item, 'institution');
        const headerParts = [];
        if (degree) headerParts.push(`**${degree}**`);
        if (institution) headerParts.push(`— *${institution}*`);
        if (headerParts.length > 0) lines.push(`### ${headerParts.join(' ')}`);

        const dates = dateRange(field(item, 'startDate'), field(item, 'endDate'), settings);
        const location = field(item, 'location');
        const gpa = field(item, 'gpa') ? `GPA: ${field(item, 'gpa')}` : '';
        const metaParts = [dates, location, gpa].filter(Boolean);
        if (metaParts.length > 0) lines.push(`*${metaParts.join(' | ')}*`);
        lines.push('');

        const desc = field(item, 'description');
        if (desc) {
          lines.push(stripHtml(desc));
          lines.push('');
        }
      }
    } else if (s.type === 'projects') {
      for (const item of items) {
        const name = field(item, 'name') || 'Project';
        const url = field(item, 'url');
        const titleLine = url ? `### [${name}](${url})` : `### ${name}`;
        lines.push(titleLine);

        const tech = field(item, 'technologies');
        if (tech) lines.push(`*Technologies: ${tech}*`);
        const dates = dateRange(field(item, 'startDate'), field(item, 'endDate'), settings);
        if (dates) lines.push(`*${dates}*`);
        lines.push('');

        const desc = field(item, 'description');
        if (desc) {
          lines.push(stripHtml(desc));
          lines.push('');
        }
      }
    } else if (s.type === 'skills') {
      for (const item of items) {
        const cat = field(item, 'category');
        const skl = field(item, 'skills');
        const legacyName = field(item, 'name');
        if (cat && skl) {
          lines.push(`- **${cat}:** ${skl}`);
        } else if (skl) {
          lines.push(`- ${skl}`);
        } else if (cat) {
          lines.push(`- **${cat}**`);
        } else if (legacyName) {
          lines.push(`- **${legacyName}**`);
        }
      }
      lines.push('');
    } else if (s.type === 'languages') {
      for (const item of items) {
        const lang = field(item, 'language');
        const prof = field(item, 'proficiency');
        if (lang && prof) {
          lines.push(`- **${lang}:** ${prof}`);
        } else if (lang) {
          lines.push(`- **${lang}**`);
        }
      }
      lines.push('');
    } else if (s.type === 'volunteering') {
      for (const item of items) {
        const role = field(item, 'role');
        const org = field(item, 'org') || field(item, 'organization');
        const headerParts = [];
        if (role) headerParts.push(`**${role}**`);
        if (org) headerParts.push(`— *${org}*`);
        if (headerParts.length > 0) lines.push(`### ${headerParts.join(' ')}`);

        const start = field(item, 'startDate');
        const end = (item.hiddenFields || []).includes('endDate') ? '' : (item.current ? presentLabel(settings) : field(item, 'endDate'));
        const dates = dateRange(start, end, settings);
        const location = field(item, 'location');
        const dateParts = [dates, location].filter(Boolean);
        if (dateParts.length > 0) lines.push(`*${dateParts.join(' | ')}*`);
        lines.push('');

        const desc = field(item, 'description');
        if (desc) {
          lines.push(stripHtml(desc));
          lines.push('');
        }
      }
    } else if (s.type === 'certifications') {
      for (const item of items) {
        const name = field(item, 'name') || field(item, 'title');
        const issuer = field(item, 'issuer');
        const headerParts = [];
        if (name) headerParts.push(`**${name}**`);
        if (issuer) headerParts.push(`— *${issuer}*`);
        if (headerParts.length > 0) lines.push(`### ${headerParts.join(' ')}`);

        const dates = dateRange(field(item, 'date'), field(item, 'expiry'), settings);
        const cred = field(item, 'credentialId') ? `ID: ${field(item, 'credentialId')}` : '';
        const metaParts = [dates, cred].filter(Boolean);
        if (metaParts.length > 0) lines.push(`*${metaParts.join(' | ')}*`);
        if (field(item, 'url')) lines.push(`[Credential](${field(item, 'url')})`);
        lines.push('');

        const desc = field(item, 'description');
        if (desc) {
          lines.push(stripHtml(desc));
          lines.push('');
        }
      }
    } else {
      // General item list
      for (const item of items) {
        const label = field(item, 'title') || field(item, 'name') || field(item, 'role') || '';
        const org = field(item, 'org') || field(item, 'organization') || field(item, 'company') || field(item, 'issuer');
        const headerParts = [];
        if (label) headerParts.push(`**${label}**`);
        if (org && org !== label) headerParts.push(`— *${org}*`);
        if (headerParts.length > 0) lines.push(`### ${headerParts.join(' ')}`);

        const dates = field(item, 'date')
          ? formatDate(field(item, 'date'), settings)
          : dateRange(field(item, 'startDate'), field(item, 'endDate'), settings);
        if (dates) lines.push(`*${dates}*`);
        lines.push('');

        const desc = field(item, 'description');
        if (desc) {
          lines.push(stripHtml(desc));
          lines.push('');
        }
      }
    }
  }

  return lines.join('\n');
}

