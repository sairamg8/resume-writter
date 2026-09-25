import { parseRichText } from './richText.js';
import { formatDate, presentLabel } from './dates.js';
import { resolveSection } from '../templates/pdf/shared/templateSectionDefaults.js';
import { templateId } from '../constants/templates.js';
import { languageWords, sectionTitle } from './resumeLanguage.js';

/**
 * The ATS plain-text export (Export → ATS Text, and the ATS tab's Copy / Download): the résumé as
 * plain text for pasting into Workday / Taleo forms. Each section prints the fields its PDF renderer
 * and the Word export print (R2-001): Interests used to print a heading over nothing, an award, a
 * reference and a custom entry their title alone, a certificate no expiry, ID or link, a project
 * no dates — and a description holding a list printed the list alone, as a one-line description
 * next to legacy bullets was dropped for them. Hidden entries and every field hidden with its eye
 * stay out (AUD-10). Dates print in Design → Date format, and Section Options → Show dates / Show
 * location and an experience section's Order apply as in the PDF (R2-064), an unset one as the
 * résumé's template prints it (resolveSection): it printed every date as stored and every date and
 * location the options hid.
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
 * field, '' when its eye hides it. `settings` are the résumé's (its Date format); `opts` the
 * section's options, read as the PDF and Word read them: Show dates off prints no date, Show
 * location off no location where the section offers it, Order the company or the role first.
 */
function entryLines(type, item, f, hidden, settings, opts) {
  const body = () => bodyLines(item, hidden);
  const date = (key) => (opts.showDates !== false ? formatDate(f(key), settings) : '');
  const place = () => (opts.showLocation !== false ? f('location') : '');
  // "Present" for a current job, education, project or volunteering role (R2-150).
  const end = hidden.has('endDate') || opts.showDates === false ? '' : (item.current ? presentLabel(settings) : date('endDate'));
  const range = () => joined([date('startDate'), end], ' - ');
  switch (type) {
    case 'experience':
    case 'volunteering': {
      const org = f('company') || f('org');
      return [
        type === 'experience' && opts.titleOrder !== 'role' ? joined([org, f('role')], ' - ') : joined([f('role'), org], ' - '),
        joined([range(), place()], ' | '),
        ...body(), '',
      ];
    }
    case 'education':
      return [
        joined([f('degree'), f('fieldOfStudy') ? `in ${f('fieldOfStudy')}` : '', f('institution')], ' - '),
        joined([range(), place(), f('gpa') ? `GPA: ${f('gpa')}` : ''], ' | '),
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
        range(),
        f('url') ? `Link: ${f('url')}` : '',
        ...body(), '',
      ];
    case 'certifications':
      return [
        joined([f('name') || f('title'), f('issuer'), date('date')], ' - '),
        joined([date('expiry') ? `Expires: ${date('expiry')}` : '', f('credentialId') ? `ID: ${f('credentialId')}` : ''], ' | '),
        f('url') ? `Link: ${f('url')}` : '',
        '',
      ];
    case 'awards':
      return [joined([f('title'), f('issuer')], ' - '), date('date'), ...body(), ''];
    case 'references':
      return [
        f('name'),
        joined([f('jobTitle'), f('company')], ', '),
        f('relationship'),
        joined([f('email'), f('phone')], ' | '),
        '',
      ];
    default: // custom, and any type this build does not know; the PDF prints its location whatever the options
      return [
        joined([f('title') || f('name'), f('subtitle')], ' - '),
        joined([date('date'), f('location')], ' | '),
        ...body(), '',
      ];
  }
}

/**
 * A section's lines under its heading: each shown entry's, the empty ones left out. Interests print
 * as one list, as the PDF prints every entry's interests as one row of chips.
 */
function sectionLines(section, items, settings, template) {
  const lines = [];
  for (const item of items) {
    const hidden = new Set(item.hiddenFields || []);
    const f = (k) => (hidden.has(k) ? '' : (item[k] || ''));
    const own = entryLines(section.type, item, f, hidden, settings, resolveSection(section, templateId(template)).settings);
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
  const contacts = [];
  if (p.email && !hiddenPersonal.has('email')) contacts.push(p.email);
  if (p.phone && !hiddenPersonal.has('phone')) contacts.push(p.phone);
  if (p.location && !hiddenPersonal.has('location')) contacts.push(p.location);
  if (p.linkedin && !hiddenPersonal.has('linkedin')) contacts.push(p.linkedin);
  if (p.website && !hiddenPersonal.has('website')) contacts.push(p.website);
  if (p.github && !hiddenPersonal.has('github')) contacts.push(p.github);
  if (contacts.length) lines.push(contacts.join(' | '));
  lines.push('');

  // Summary
  const summary = hiddenPersonal.has('summary') ? [] : richTextLines(p.summary);
  if (summary.length) lines.push(languageWords(resume.settings).summary.toUpperCase(), RULE, ...summary, '');

  // Sections: a heading only over something printed under it.
  const sections = Array.isArray(resume.sections) ? resume.sections : [];
  for (const s of sections) {
    if (!s || s.visible === false) continue;
    const items = (Array.isArray(s.items) ? s.items : []).filter((item) => item && item.visible !== false);
    const body = sectionLines(s, items, resume.settings || {}, resume.template);
    if (!body.some(Boolean)) continue;
    lines.push(String(sectionTitle(s, resume.settings) || s.type).toUpperCase(), RULE, ...body, '');
  }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
