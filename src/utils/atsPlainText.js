import { parseRichText } from './richText.js';

/**
 * The ATS plain-text export (Export → ATS Text, and the ATS tab's Copy / Download): the résumé as
 * plain text for pasting into Workday / Taleo forms. Each section prints the fields its PDF renderer
 * and the Word export print (R2-001): Interests used to print a heading over nothing, an award, a
 * reference and a custom entry their title alone, a certificate no expiry, ID or link, a project
 * no dates — and a description holding a list printed the list alone, as a one-line description
 * next to legacy bullets was dropped for them. Hidden entries and every field hidden with its eye
 * stay out (AUD-10). Dates print as stored.
 */

const RULE = '----------------------------------------';

/** A paragraph typed as a bullet ("• …", "- …"), not "-5%": printed as the list item it reads as. */
const TYPED_BULLET = /^[•\-*–—◦▪▸‣⁃]\s+/;

/**
 * Rich text (a description, the summary) as the lines the PDF prints, in its order, through the
 * parse the PDF and Word use: a paragraph as typed (one line per line break), a list item as
 * "* …" — nested ones indented, a numbered one with its number ("3. …") — and every entity decoded.
 */
function richTextLines(html) {
  const out = [];
  for (const block of parseRichText(html)) {
    const lines = block.runs.map((r) => r.text).join('').split('\n')
      .map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
    lines.forEach((line, i) => {
      if (block.marker) {
        const pad = '  '.repeat(Math.max(0, block.indent - 1));
        out.push(i ? `${pad}  ${line}` : `${pad}${block.marker.length === 1 ? '*' : block.marker} ${line}`);
      } else if (TYPED_BULLET.test(line)) {
        out.push(`* ${line.replace(TYPED_BULLET, '')}`);
      } else {
        out.push(line);
      }
    });
  }
  return out;
}

/** An entry's description (unless hidden), then its legacy bullets, as the PDF prints them. */
function bodyLines(item, hidden) {
  const lines = hidden.has('description') ? [] : richTextLines(item.description);
  for (const b of Array.isArray(item.bullets) ? item.bullets : []) {
    const text = String(b ?? '').replace(/\s+/g, ' ').trim();
    if (text) lines.push(`* ${text}`);
  }
  return lines;
}

const joined = (parts, sep) => parts.filter(Boolean).join(sep);

/**
 * One entry's lines, by section type; a multi-line entry ends with a blank line. `f(key)` is the
 * field, '' when its eye hides it.
 */
function entryLines(type, item, f, hidden) {
  const body = () => bodyLines(item, hidden);
  switch (type) {
    case 'experience':
    case 'volunteering': {
      const end = hidden.has('endDate') ? '' : (item.current ? 'Present' : item.endDate);
      return [
        joined([f('role'), f('company') || f('org')], ' - '),
        joined([joined([f('startDate'), end], ' - '), f('location')], ' | '),
        ...body(), '',
      ];
    }
    case 'education':
      return [
        joined([f('degree'), f('fieldOfStudy') ? `in ${f('fieldOfStudy')}` : '', f('institution')], ' - '),
        joined([joined([f('startDate'), f('endDate')], ' - '), f('location'), f('gpa') ? `GPA: ${f('gpa')}` : ''], ' | '),
        ...body(), '',
      ];
    case 'skills':
      return [f('category') && f('skills') ? `${f('category')}: ${f('skills')}` : (f('skills') || f('category'))];
    case 'languages':
      return [f('language') && f('proficiency') ? `${f('language')}: ${f('proficiency')}` : f('language')];
    case 'interests':
      return [String(f('interests')).split(',').map((s) => s.trim()).filter(Boolean).join(', ')];
    case 'projects':
      return [
        joined([f('name'), f('technologies') ? `(${f('technologies')})` : ''], ' '),
        joined([f('startDate'), f('endDate')], ' - '),
        f('url') ? `Link: ${f('url')}` : '',
        ...body(), '',
      ];
    case 'certifications':
      return [
        joined([f('name') || f('title'), f('issuer'), f('date')], ' - '),
        joined([f('expiry') ? `Expires: ${f('expiry')}` : '', f('credentialId') ? `ID: ${f('credentialId')}` : ''], ' | '),
        f('url') ? `Link: ${f('url')}` : '',
        '',
      ];
    case 'awards':
      return [joined([f('title'), f('issuer')], ' - '), f('date'), ...body(), ''];
    case 'references':
      return [
        f('name'),
        joined([f('jobTitle'), f('company')], ', '),
        f('relationship'),
        joined([f('email'), f('phone')], ' | '),
        '',
      ];
    default: // custom, and any type this build does not know
      return [
        joined([f('title') || f('name'), f('subtitle')], ' - '),
        joined([f('date'), f('location')], ' | '),
        ...body(), '',
      ];
  }
}

/**
 * A section's lines under its heading: each shown entry's, the empty ones left out. Interests print
 * as one list, as the PDF prints every entry's interests as one row of chips.
 */
function sectionLines(section, items) {
  const lines = [];
  for (const item of items) {
    const hidden = new Set(item.hiddenFields || []);
    const f = (k) => (hidden.has(k) ? '' : (item[k] || ''));
    const own = entryLines(section.type, item, f, hidden);
    lines.push(...own.filter((line, i) => line || (i === own.length - 1 && own.some(Boolean))));
  }
  if (section.type === 'interests') return [lines.filter(Boolean).join(', ')].filter(Boolean);
  return lines;
}

/**
 * Generates ATS-optimized Plain Text (perfect for pasting into Workday / Taleo forms)
 */
export function generateAtsPlainText(resume) {
  if (!resume) return '';
  const lines = [];
  const p = resume.personal || {};
  const hiddenPersonal = new Set(p.hiddenFields || []);

  // Header
  if (p.name) lines.push(p.name.toUpperCase());
  if (p.title) lines.push(p.title);

  // Contacts line
  const contacts = ['email', 'phone', 'location', 'linkedin', 'website', 'github']
    .filter((k) => p[k] && !hiddenPersonal.has(k)).map((k) => p[k]);
  if (contacts.length) lines.push(contacts.join(' | '));
  lines.push('');

  // Summary
  const summary = hiddenPersonal.has('summary') ? [] : richTextLines(p.summary);
  if (summary.length) lines.push('PROFESSIONAL SUMMARY', RULE, ...summary, '');

  // Sections: a heading only over something printed under it.
  const sections = Array.isArray(resume.sections) ? resume.sections : [];
  for (const s of sections) {
    if (!s || s.visible === false) continue;
    const items = (Array.isArray(s.items) ? s.items : []).filter((item) => item && item.visible !== false);
    const body = sectionLines(s, items);
    if (!body.some(Boolean)) continue;
    lines.push(String(s.title || s.type).toUpperCase(), RULE, ...body, '');
  }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
