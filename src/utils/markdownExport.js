import { dateRange, formatDate, presentLabel } from './dates.js';
import { parseRichText, safeHref } from './richText.js';
import { contactHref } from './contacts.js';

/**
 * Markdown Resume Exporter (Export → Markdown (.md)): the résumé as GitHub Flavored Markdown.
 * Each section prints the fields its PDF renderer prints (R2-009): Interests used to print a heading
 * over nothing; a reference its name and company alone, a custom entry no subtitle or location and
 * an education entry no field of study, through one generic branch; legacy bullets not at all; a
 * nested list item glued onto its parent; and a project or certificate link typed without a scheme
 * became a relative link. Rich text goes through the parse the PDF and Word use; every link goes
 * through the PDF's safeHref, so a bare "github.com/me" links https:// and a javascript: or data:
 * address prints as text, never as a link. Hidden entries and every field hidden with its eye stay
 * out (AUD-13); dates print in the résumé's Date format, and Section Options → Show dates / Show
 * location and an experience section's Order apply as in the PDF (R2-064).
 */

/** Two trailing spaces: a Markdown hard line break, so a line the PDF breaks stays broken. */
const BREAK = '  ';
/** A nested list's indent per level: enough for every Markdown flavour, and never a code block. */
const NEST = '    ';

/** A run's text; a run the PDF links, as [text](href) — one it would not follow, as its text. */
function runText(run) {
  const href = run.href ? safeHref(run.href) : null;
  return href && run.text.trim() ? `[${run.text}](${href})` : run.text;
}

/** A parsed block's lines (one per line break), whitespace collapsed, empty lines left out. */
const blockLines = (block) => block.runs.map(runText).join('').split('\n')
  .map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);

/**
 * Rich text (a description, the summary), then an entry's legacy bullets, as Markdown lines in the
 * PDF's order: a paragraph as typed, set off by blank lines; a list item on a line of its own, "- "
 * or its number ("3. "), nested ones indented a level each; a paragraph inside a list item (an <li>
 * holding two <p>) on the item's next line; a lettered or Roman item ("a.") as "- a.", as Markdown
 * numbers in digits only.
 */
function markdownBody(html, bullets = []) {
  const out = [];
  let inList = false;
  const cols = []; // cols[depth]: the column the text of the last item at that depth starts at
  const push = (lines, first, rest) => lines.forEach((line, i) => {
    out.push(`${i ? rest : first}${line}${i < lines.length - 1 ? BREAK : ''}`);
  });
  const item = (lines, depth, marker) => {
    if (!inList && out.length) out.push('');
    const pad = NEST.repeat(depth - 1);
    const lead = /^\d+\.$/.test(marker) ? `${marker} ` : (marker.length === 1 ? '- ' : `- ${marker} `);
    const col = pad.length + (/^\d+\.$/.test(marker) ? lead.length : 2);
    push(lines, pad + lead, ' '.repeat(col));
    cols.length = depth;
    cols[depth] = col;
    inList = true;
  };
  for (const block of parseRichText(html)) {
    const lines = blockLines(block);
    if (!lines.length) continue;
    if (block.marker) {
      item(lines, Math.max(1, block.indent), block.marker);
    } else if (inList && block.indent > 0 && cols[Math.min(block.indent, cols.length - 1)] != null) {
      const col = ' '.repeat(cols[Math.min(block.indent, cols.length - 1)]);
      out[out.length - 1] += BREAK;
      push(lines, col, col);
    } else {
      if (out.length) out.push('');
      push(lines, '', '');
      inList = false;
    }
  }
  for (const b of Array.isArray(bullets) ? bullets : []) {
    const text = String(b ?? '').replace(/\s+/g, ' ').trim();
    if (text) item([text], 1, '•');
  }
  return out;
}

/** An entry's heading: "**primary** — *secondary*", either alone when the other is empty. */
function heading(primary, secondary) {
  if (primary && secondary) return `**${primary}** — *${secondary}*`;
  if (primary) return `**${primary}**`;
  return secondary ? `*${secondary}*` : '';
}

const joined = (parts, sep) => parts.filter(Boolean).join(sep);
const italic = (text) => (text ? `*${text}*` : '');

/**
 * One entry: its `### ` heading, each meta line on a line of its own (a hard break between them),
 * a blank line, then its body and a blank line.
 */
function entryLines(title, meta, body) {
  const lines = title ? [`### ${title}`] : [];
  const shown = meta.filter(Boolean);
  shown.forEach((m, i) => lines.push(i < shown.length - 1 ? `${m}${BREAK}` : m));
  lines.push('');
  if (body.length) lines.push(...body, '');
  return lines;
}

/** A link the PDF follows as [label](href); one it would not follow as the address it prints. */
function link(url, label) {
  const href = safeHref(url);
  return href ? `[${label || url}](${href})` : url;
}

/**
 * One entry's lines, by section type. `f(key)` is the field, '' when its eye hides it; `body()` is
 * its description (unless hidden) and legacy bullets. `opts` are the section's options, read as the
 * PDF and Word read them (R2-064): Show dates off prints no date, Show location off no location on
 * the sections that offer it, and an experience entry's Order puts the company or the role first.
 */
function itemLines(type, item, f, body, settings, opts = {}) {
  const shown = (text) => (opts.showDates !== false ? text : '');
  const place = () => (opts.showLocation !== false ? f('location') : '');
  switch (type) {
    case 'experience':
    case 'volunteering': {
      const org = type === 'volunteering' ? (f('org') || f('organization')) : f('company');
      const end = (item.hiddenFields || []).includes('endDate') ? '' : (item.current ? presentLabel(settings) : f('endDate'));
      const title = type === 'experience' && opts.titleOrder !== 'role' ? heading(org, f('role')) : heading(f('role'), org);
      return entryLines(title, [italic(joined([shown(dateRange(f('startDate'), end, settings)), place()], ' | '))], body());
    }
    case 'education': {
      const gpa = f('gpa') ? `GPA: ${f('gpa')}` : '';
      const dates = shown(dateRange(f('startDate'), f('endDate'), settings));
      return entryLines(heading(joined([f('degree'), f('fieldOfStudy')], ', '), f('institution')),
        [italic(joined([dates, place(), gpa], ' | '))], body());
    }
    case 'projects': {
      const url = f('url');
      const href = safeHref(url);
      const name = f('name');
      const title = href ? `[${name || url}](${href})` : name;
      const meta = [f('technologies') ? `Technologies: ${f('technologies')}` : '', shown(dateRange(f('startDate'), f('endDate'), settings)), href ? '' : url];
      return entryLines(title, [italic(joined(meta, ' | '))], body());
    }
    case 'certifications': {
      const id = f('credentialId') ? `ID: ${f('credentialId')}` : '';
      const url = f('url');
      return entryLines(heading(f('name') || f('title'), f('issuer')),
        [italic(joined([shown(dateRange(f('date'), f('expiry'), settings)), id], ' | ')), url ? link(url, f('urlLabel')) : ''], body());
    }
    case 'awards':
      return entryLines(heading(f('title') || f('name'), f('issuer')), [italic(shown(formatDate(f('date'), settings)))], body());
    case 'references': {
      const mailto = f('email') ? contactHref('email', item) : null;
      const email = mailto ? `[${f('email')}](${mailto})` : f('email');
      return entryLines(heading(f('name'), joined([f('jobTitle'), f('company')], ', ')),
        [italic(f('relationship')), joined([email, f('phone')], ' | ')], []);
    }
    default: { // custom, and any type this build does not know; the PDF prints its location whatever the options
      const dates = f('date') ? formatDate(f('date'), settings) : dateRange(f('startDate'), f('endDate'), settings);
      const sub = f('subtitle') || f('org') || f('organization') || f('company') || f('issuer');
      return entryLines(heading(f('title') || f('name') || f('role'), sub), [italic(joined([shown(dates), f('location')], ' | '))], body());
    }
  }
}

/** A list section's lines: skills and languages one bullet per entry, interests one line for all. */
function listLines(type, items, fieldOf) {
  if (type === 'interests') {
    const all = items.flatMap((item) => String(fieldOf(item)('interests')).split(',').map((s) => s.trim()).filter(Boolean));
    return all.length ? [all.join(', '), ''] : [];
  }
  const lines = [];
  for (const item of items) {
    const f = fieldOf(item);
    if (type === 'skills') {
      const cat = f('category');
      const skl = f('skills');
      if (cat && skl) lines.push(`- **${cat}:** ${skl}`);
      else if (skl) lines.push(`- ${skl}`);
      else if (cat || f('name')) lines.push(`- **${cat || f('name')}**`);
    } else {
      const lang = f('language');
      const prof = f('proficiency');
      if (lang) lines.push(prof ? `- **${lang}:** ${prof}` : `- **${lang}**`);
    }
  }
  return lines.length ? [...lines, ''] : [];
}

const LIST_TYPES = new Set(['skills', 'languages', 'interests']);

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
  const summary = hiddenFields.has('summary') ? [] : markdownBody(p.summary);
  if (summary.length) lines.push('## Professional Summary', ...summary, '');

  // Sections: a heading only over something printed under it.
  const fieldOf = (item) => {
    const hidden = new Set(item.hiddenFields || []);
    return (key) => (hidden.has(key) ? '' : (item[key] || ''));
  };
  for (const s of Array.isArray(resume.sections) ? resume.sections : []) {
    if (!s || s.visible === false) continue;
    const items = (Array.isArray(s.items) ? s.items : []).filter((i) => i && i.visible !== false);
    const body = LIST_TYPES.has(s.type)
      ? listLines(s.type, items, fieldOf)
      : items.flatMap((item) => {
        const f = fieldOf(item);
        return itemLines(s.type, item, f, () => markdownBody(f('description'), item.bullets), settings, s.settings || {});
      });
    if (!body.some((l) => l.trim())) continue;
    lines.push(`## ${s.title || s.type}`, ...body);
  }

  return lines.join('\n');
}
