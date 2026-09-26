import { BorderStyle, Paragraph, ShadingType } from 'docx';
import {
  accent2Hex, bold, normal, linked, sectionHeading, bulletPoint, descriptionToParagraphs, dateRightPara, centredIf, eighths,
  gapPara, gridTable, inlineGap, lineSpacing, twips,
} from '@/utils/wordExportUtils';
import { sectionLook } from '@/utils/wordExportLook';
import { wordHeadingFont } from '@/utils/wordFonts';
import { headingBorderExtraPt, inSidebarColumn, templateId, upperSectionTitles } from '@/constants/templates';
import { solid } from '@/templates/pdf/shared/pdfColors';
import { sectionHeadingLook, titleTracking } from '@/templates/pdf/shared/sectionHeadingLook';
import { resolveTemplateSettings } from '@/templates/pdf/shared/templateSettings';
import { getDateColor, getEffectiveSpacing } from '@/templates/pdf/shared/PdfSections';
import { fieldGap } from '@/templates/pdf/shared/PdfItemHeader';
import { hasRichText } from '@/utils/richText';
import { contactHref } from '@/utils/contacts';
import { dateRange, endDateOf, formatDate, presentLabel, startDateOf } from '@/utils/dates';
import { skillCategory, skillGroup, skillSeparator } from '@/utils/skills';
import { employerOf, groupPlaces, groupsRoles, roleGroups } from '@/utils/roleGroups';

/**
 * Design → Section Headings in Word, as PdfSectionTitle draws them (ONB-12-NB1), from the résumé's
 * resolved settings `s`: the title in the template's colour for the style (sectionHeadingLook), and
 * Ruled, Underline and Line as a bottom border, Left bar as a left border, Boxed as the paragraph's
 * shading — at the stored Thickness (Left bar's the wider bar the PDF prints) and Border colour.
 * Word has no rule beside a title: Line's rules print under it. Plain, and a style the app does not
 * offer (the PDF's plain), print the title alone; so does a Thickness no rule is drawn at. Lectern's titles
 * are centred whatever the section's Alignment, as its PDF centres them (sectionHeadingLook's `center`, R2-138 B2).
 */
function headingOf(s, template) {
  const own = headingFrame(s, template);
  return sectionHeadingLook({ template: templateId(template), headingStyle: s.headingStyle }).center ? { ...own, ...centredIf(true) } : own;
}

function headingFrame(s, template) {
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
 * Design → Title Spacing on a title's run, twips, when one is set: what the PDF prints (titleTracking).
 * Unset, Word's titles keep no letter-spacing, as they always had (R2-146).
 */
function trackingOf(s) {
  if (typeof s.sectionLetterSpacing !== 'number') return {};
  return { tracking: Math.round(titleTracking((s.fontSizeBase ?? 11) + (s.fontSizeSectionDelta ?? 1), s.sectionLetterSpacing) * 20) };
}

/**
 * A section title as the PDF prints it in the main column: Design → Title case and Section Headings
 * (headingOf). The Sidebar's "About Me" over its summary reads it too (FIDB-51-VF3-NB2-NB1-NB1).
 */
export function buildSectionTitle(title, settings, template) {
  const s = resolveTemplateSettings(settings, templateId(template));
  const text = String(title || '');
  const heading = { ...headingOf(s, template), lineHeight: s.lineHeightValue, ...trackingOf(s), ...wordHeadingFont(s) };
  return sectionHeading(upperSectionTitles(s.sectionTitleCase) ? text.toUpperCase() : text, accent2Hex(settings?.accentColor), false, heading);
}

/** Items the user has not hidden (the eye toggle on an entry). */
const shown = (section) => (section.items || []).filter((item) => item && item.visible !== false);
/** A field of an entry, or '' when its eye toggle hides it. */
const field = (item, key) => ((item.hiddenFields || []).includes(key) ? '' : (item[key] || ''));

/**
 * The entries of `section` the user has not hidden, each as `build` makes it (its paragraphs), with
 * the look's gap between two (Design → Between Items), as the PDF spaces them — or, in Grids of two
 * or more, a table of them (gridTable, R2-070). An entry that prints nothing takes no gap and no
 * cell. `look` is sectionLook's: sizes, spacing, grid and colours.
 */
function entries(section, look, build, items = shown(section)) {
  const cells = items.map((item) => build(item).filter(Boolean)).filter((paras) => paras.length);
  if (look.grid && cells.length) return [gridTable(cells, look.grid, look.gap)];
  return cells.flatMap((paras, i) => (i ? [...gapPara(look.gap), ...paras] : paras));
}

/**
 * An entry's location for dateRightPara: a line of its own under the date, in the size and the
 * colour the PDF prints it in (`place`: the Text colour's muted shade, Compact's meta) — the PDF
 * prints it with the date, never in the title's text (ATS-1).
 */
const place = (text, look) => (text ? { text, color: look.ink.place, size: look.place } : null);

/** An entry's title line (dateRightPara) with its `date` in `dateHex`, at the look's right tab; `under` the line under it. */
const titleLine = (left, date, dateHex, centered, look, where = null, under = []) => dateRightPara(left, date, { color: dateHex, centered, size: look.date, place: where, tab: look.tab, under });

/**
 * An entry's first field, bold in the Text colour at Entry Header, and its second in the PDF's
 * colour and size for it (the sub line's, `look.sub`: Base, R2-118).
 */
const first = (text, look) => text && bold(text, { size: look.entry, color: look.ink.text });
const second = (text, look, color = look.ink.second, size = look.sub) => normal(text, { size, color });

/**
 * The header of an entry with a Title (Section Options → Title, `look.title`; R2-070) — a job, a
 * school, a volunteer role, a custom entry — laid out as the PDF's ItemHeader lays it out: "Stacked"
 * the first field with the date and the second on the line under it, with the location; "Inline"
 * "first — second" with the date; "Side by side" both with the date, a field's gap apart (centred,
 * joined as Inline, as the PDF centres them). Under a one-line title the location has a line of its
 * own (ATS-1). Word printed every entry Inline.
 */
function header(primary, secondary, date, dateHex, centered, look, where) {
  const lead = [first(primary, look)];
  if (secondary && look.title === 'stacked') return titleLine(lead, date, dateHex, centered, look, where, [second(secondary, look)]);
  // Side by side: ItemHeader's 6 pt between the two, the Timeline's field gap.
  const apart = primary && look.title === 'sidebyside' && !centered;
  const gap = apart ? [inlineGap(look.template === 'timeline' ? fieldGap(look.base / 2) : 6, look.sub)] : [];
  const rest = secondary ? [...gap, second(`${primary && !apart ? ' — ' : ''}${secondary}`, look)] : [];
  return titleLine([...lead, ...rest], date, dateHex, centered, look, where);
}

/**
 * Description + legacy bullets of an entry, centred in a centred section, at Design → Line Height,
 * at the PDF's size for them (`look.body`, R2-118), in the Text colour's body shade (`color`: an
 * award's, which the PDF prints in its sub shade), behind Design → Lists' glyph (`look.bullet`, R2-147).
 */
function body(item, centered, look, color = look.ink.body) {
  const paras = [];
  const description = field(item, 'description');
  if (hasRichText(description)) paras.push(...descriptionToParagraphs(description, { size: look.body, color, lineHeight: look.line, bullet: look.bullet, links: look.links }, centered ? 'center' : null));
  for (const b of item.bullets || []) if (b) paras.push(bulletPoint(b, centered, { size: look.body, color }, look.line, look.bullet));
  return paras;
}

export function buildExperience(section, accentHex, settings, centered, dateHex, look) {
  const s = section.settings || {};
  const locationOf = (item) => (s.showLocation !== false ? field(item, 'location') : '');
  const datesOf = (item) => {
    const end = field(item, 'endDate') && !item.current ? field(item, 'endDate') : '';
    const dates = dateRange(field(item, 'startDate'), item.current && !(item.hiddenFields || []).includes('endDate') ? presentLabel(settings) : end, settings);
    return s.showDates !== false ? dates : '';
  };
  const job = (item) => {
    const company = field(item, 'company');
    const role = field(item, 'role');
    // An empty leading field: the next one leads, bold, as the PDF prints it (R2-111).
    const [lead, next] = s.titleOrder === 'role' ? [role, company] : [company, role];
    const [primary, secondary] = lead ? [lead, next] : [next, ''];
    return [header(primary, secondary, datesOf(item), dateHex, centered, look, place(locationOf(item), look)), ...body(item, centered, look)];
  };
  // Section Options → "Group roles by company" (R2-147), as the PDF groups them (roleGroups): the
  // employer and the first role's location once, then each role bold with its dates, a location only
  // where it differs and its description, half the item gap apart. A group is one entry (a grid's cell).
  if (!groupsRoles(s)) return [sectionHeading(section.title, accentHex, centered, section.heading), ...entries(section, look, job)];
  const group = (g) => {
    if (g.length === 1) return job(g[0]);
    const places = groupPlaces(g, locationOf);
    return [
      titleLine([first(employerOf(g[0]), look)], '', dateHex, centered, look, place(places.header, look)),
      ...g.flatMap((item, k) => [
        ...(k ? gapPara(look.gap / 2) : []),
        header(field(item, 'role'), '', datesOf(item), dateHex, centered, look, place(places.roles[k], look)),
        ...body(item, centered, look),
      ]),
    ];
  };
  return [sectionHeading(section.title, accentHex, centered, section.heading), ...entries(section, look, group, roleGroups(shown(section)))];
}

export function buildEducation(section, accentHex, settings, centered, dateHex, look) {
  const s = section.settings || {};
  return [sectionHeading(section.title, accentHex, centered, section.heading), ...entries(section, look, (item) => {
    const degree = [item.degree, item.fieldOfStudy].filter(Boolean).join(', ');
    const location = s.showLocation !== false ? item.location : '';
    // The degree and GPA are the second field, the PDF's sub line; without a school the degree leads.
    const sub = [item.institution ? degree : '', item.gpa ? `GPA: ${item.gpa}` : ''].filter(Boolean).join(' · ');
    return [header(item.institution || degree, sub, s.showDates !== false ? dateRange(startDateOf(item), endDateOf(item, settings), settings) : '', dateHex, centered, look, place(location, look)), ...body(item, centered, look)];
  })];
}

/**
 * Skill groups, each category cased as the PDF prints it (skillCategory; `look.side`: the Sidebar's),
 * in its colours (R2-063): the category in the Text colour (the accent on Modern, and in Tags and
 * Bars), the skills in its sub shade — Tags in the accent (Minimal's in the sub shade), Bars at 80 %.
 * Both at Entry Header, as the PDF prints them (R2-118): Tags half a point under it, Bars a point.
 */
export function buildSkills(section, accentHex, settings, centered, dateHex, look) {
  const s = section.settings || {};
  const sep = skillSeparator(s);
  const bulletStyle = s.skillsStyle === 'bullet';
  const chips = s.skillsStyle === 'tags' || s.skillsStyle === 'bars';
  const categoryInk = chips || look.template === 'modern' ? accentHex : look.ink.text;
  const skillsInk = { tags: look.template === 'minimal' ? look.ink.sub : accentHex, bars: look.ink.bar }[s.skillsStyle] || look.ink.sub;
  const skillsSize = look.entry - ({ tags: 1, bars: 2 }[s.skillsStyle] || 0);
  return [sectionHeading(section.title, accentHex, centered, section.heading), ...entries(section, look, (item) => {
    const { category: typed, skills, list } = skillGroup(item);
    const category = skillCategory(typed, { style: s.skillsStyle, sideColumn: look.side });
    if (s.skillsStyle === 'stacked') return stackedSkills(category, skills, list, categoryInk, centered, look);
    const children = [];
    if (category) children.push(bold(`${category}${skills ? sep : ''}`, { size: look.entry, color: categoryInk }));
    if (skills) children.push(normal(skills, { size: skillsSize, color: skillsInk }));
    return children.length ? [new Paragraph({
      children,
      spacing: { after: 0, ...lineSpacing(look.line, look.entry) },
      ...(bulletStyle ? { bullet: { level: 0 }, indent: { left: 360 } } : {}),
      ...centredIf(centered),
    })] : [];
  })];
}

/**
 * A skill group in Skills style "Stacked" (R2-070), as the PDF prints it: the category on a line of
 * its own over a thin rule, its skills in the paragraph under it — in the Sidebar's side column, which
 * draws no rule, one skill to a paragraph behind a "• ". Word printed it as Inline.
 */
function stackedSkills(category, skills, list, categoryInk, centered, look) {
  const paras = [];
  if (category) {
    paras.push(new Paragraph({
      children: [bold(category, { size: look.entry, color: categoryInk })],
      spacing: { after: 40 },
      ...(look.side ? {} : { border: { bottom: { style: BorderStyle.SINGLE, size: eighths(0.5), color: 'e5e7eb', space: 1 } } }),
      ...centredIf(centered),
    }));
  }
  const line = (text) => new Paragraph({
    children: [normal(text, { size: look.entry, color: look.ink.sub })],
    spacing: { after: 0, ...lineSpacing(look.line, look.entry) },
    ...centredIf(centered),
  });
  if (look.side) paras.push(...list.map((skill) => line(`• ${skill}`)));
  else if (skills) paras.push(line(skills));
  return paras;
}

export function buildProjects(section, accentHex, settings, centered, dateHex, look) {
  const s = section.settings || {};
  return [sectionHeading(section.title, accentHex, centered, section.heading), ...entries(section, look, (item) => [
    titleLine([
      first(item.name, look),
      ...(item.technologies ? [second(` · ${item.technologies}`, look, look.ink.tech)] : []),
      ...(item.url ? [second(' · ', look, accentHex, look.link), linked(item.url, item.url, { size: look.link, color: accentHex }, look.links)] : []),
    ], s.showDates !== false ? dateRange(startDateOf(item), endDateOf(item, settings), settings) : '', dateHex, centered, look),
    ...body(item, centered, look),
  ])];
}

export function buildLanguages(section, accentHex, settings, centered, dateHex, look) {
  return [sectionHeading(section.title, accentHex, centered, section.heading), ...entries(section, look, (item) => (!item.language && !item.proficiency ? [] : [
    new Paragraph({
      children: [
        // Both at Base, as the PDF prints them (R2-118).
        ...(item.language ? [bold(item.language, { size: look.base, color: look.ink.text })] : []),
        ...(item.proficiency ? [second(`${item.language ? ' — ' : ''}${item.proficiency}`, look, look.ink.sub, look.base)] : []),
      ],
      spacing: { after: 0 },
      ...centredIf(centered),
    }),
  ]))];
}

export function buildCertifications(section, accentHex, settings, centered, dateHex, look) {
  const s = section.settings || {};
  return [sectionHeading(section.title, accentHex, centered, section.heading), ...entries(section, look, (item) => [
    titleLine([
      first(item.name || item.title, look),
      // The name's line at Entry Header, all of it, as the PDF prints it.
      ...(item.issuer ? [second(` — ${item.issuer}`, look, look.ink.sub, look.entry)] : []),
      ...(item.credentialId ? [second(` · ID: ${item.credentialId}`, look, look.ink.muted, look.entry)] : []),
      ...(item.url ? [second(' · ', look, accentHex, look.entry), linked(item.urlLabel || item.url, item.url, { size: look.entry, color: accentHex }, look.links)] : []),
    ], s.showDates !== false ? dateRange(item.date, item.expiry, settings) : '', dateHex, centered, look),
  ])];
}

export function buildAwards(section, accentHex, settings, centered, dateHex, look) {
  const s = section.settings || {};
  return [sectionHeading(section.title, accentHex, centered, section.heading), ...entries(section, look, (item) => [
    titleLine([
      first(item.title, look),
      ...(item.issuer ? [second(` — ${item.issuer}`, look, look.ink.sub)] : []),
    ], s.showDates !== false ? formatDate(item.date || '', settings) : '', dateHex, centered, look),
    ...body(item, centered, look, look.ink.sub),
  ])];
}

export function buildVolunteering(section, accentHex, settings, centered, dateHex, look) {
  const s = section.settings || {};
  return [sectionHeading(section.title, accentHex, centered, section.heading), ...entries(section, look, (item) => {
    const location = s.showLocation !== false ? item.location : '';
    return [header(item.role || item.org, item.role ? item.org : '', s.showDates !== false ? dateRange(startDateOf(item), endDateOf(item, settings), settings) : '', dateHex, centered, look, place(location, look)), ...body(item, centered, look)];
  })];
}

export function buildReferences(section, accentHex, settings, centered, dateHex, look) {
  const line = (children, after = 20) => new Paragraph({ children, spacing: { after }, ...centredIf(centered) });
  const { ink } = look;
  return [sectionHeading(section.title, accentHex, centered, section.heading), ...entries(section, look, (item) => {
    // A card of Base-size lines, the name's too, as the PDF prints it (R2-118).
    const paras = [line([bold(item.name, { size: look.base, color: ink.text })])];
    const role = [item.jobTitle, item.company].filter(Boolean).join(', ');
    if (role) paras.push(line([normal(role, { size: look.base, color: ink.sub })]));
    if (item.relationship) paras.push(line([normal(item.relationship, { size: look.base, color: ink.meta, italics: true })]));
    // Linked through contactHref, as the PDF links them: a phone with under three digits ("On request")
    // prints as text, not as an empty tel: link.
    const reach = [
      item.email && linked(item.email, contactHref('email', item), { size: look.base, color: accentHex }, look.links),
      item.phone && linked(item.phone, contactHref('phone', item), { size: look.base, color: ink.meta }, look.links),
    ].filter(Boolean);
    if (reach.length) paras.push(line(reach.flatMap((r, i) => (i ? [normal('  |  ', { size: look.base, color: ink.muted }), r] : [r]))));
    return paras;
  })];
}

/**
 * The interests on one line, in the accent the PDF prints its interest chips in: each entry split at
 * its commas and trimmed, blank parts left out, as the PDF's chips, the ATS text and the Markdown read
 * them ("Chess,Hiking," → "Chess, Hiking").
 */
export function buildInterests(section, accentHex, settings, centered, dateHex, look) {
  const allInterests = shown(section)
    .flatMap((i) => String(i.interests || '').split(',').map((s) => s.trim()).filter(Boolean)).join(', ');
  if (!allInterests) return [];
  return [
    sectionHeading(section.title, accentHex, centered, section.heading),
    new Paragraph({ children: [normal(allInterests, { size: look.base, color: accentHex })], spacing: { after: 60 }, ...centredIf(centered) }),
  ];
}

export function buildCustom(section, accentHex, settings, centered, dateHex, look) {
  const s = section.settings || {};
  return [sectionHeading(section.title, accentHex, centered, section.heading), ...entries(section, look, (item) => [
    // An empty title: the subtitle leads, bold, as the PDF prints it (R2-111).
    header(item.title || item.subtitle, item.title ? item.subtitle : '', s.showDates !== false ? formatDate(item.date || '', settings) : '', dateHex, centered, look, place(item.location, look)),
    ...body(item, centered, look),
  ])];
}

/**
 * A section's paragraphs; `settings` are the résumé's (its dates print in its Date format), and
 * `template` the résumé's own, whose entry colours the PDF prints in every Layout (R2-121).
 * Section Options → Alignment "Center" centres it as the PDF does: everywhere but the Sidebar's
 * side column (two columns only), which prints one left-aligned column whatever the section stores.
 * Its title prints in Design → Title case as the PDF prints it, in both of the Sidebar's columns:
 * in capitals for "ABC", as typed for "Abc" — the template's own when none is stored (Executive's
 * is "Abc"). Design → Spacing spaces it as the PDF does (R2-062): Line Height, Between Items, and
 * the section's own Spacing Override Before above its title; the space under it is
 * sectionSpaceAfter's. Its entries print in the PDF's colours (sectionLook's ink, R2-063).
 */
export function buildSection(section, accentHex, settings, template) {
  if (section.visible === false || !shown(section).length) return [];
  const side = inSidebarColumn(template, section.type, settings);
  const centered = section.settings?.alignment === 'center' && !side;
  const s = resolveTemplateSettings(settings, templateId(template));
  const title = String(section.title || '');
  const sectionTitleSize = Math.round(((s.fontSizeBase ?? 11) + (s.fontSizeSectionDelta ?? 1)) * 2);
  const heading = {
    ...(side ? { size: sectionTitleSize } : headingOf(s, template)),
    before: twips(getEffectiveSpacing(section, s).spaceBefore ?? 0),
    lineHeight: s.lineHeightValue,
    ...trackingOf(s), // the Sidebar's column titles too, as in the PDF (R2-146)
    ...wordHeadingFont(s), // Heading Font, as the PDF's titles (R2-146)
  };
  // The date in the PDF's colour for the template, from the Text colour it prints (its own when none is stored).
  const dateHex = accent2Hex(solid(getDateColor({ ...s, _template: templateId(template) })), '6b7280');
  const look = sectionLook(section, settings, s, template, side);
  const args = [{ ...section, title: upperSectionTitles(s.sectionTitleCase) ? title.toUpperCase() : title, heading }, accentHex, settings, centered, dateHex, look];
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

/**
 * The space under a printed section, before the next one: Design → Between Sections, or the
 * section's own Spacing Override After — the PDF's marginBottom (getEffectiveSpacing). The résumé
 * puts it under every section but the last (renderResumeDocx, R2-062).
 */
export function sectionSpaceAfter(section, settings, template) {
  return gapPara(getEffectiveSpacing(section, resolveTemplateSettings(settings, templateId(template))).marginBottom);
}
