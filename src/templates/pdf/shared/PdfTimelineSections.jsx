import { View } from '@react-pdf/renderer';
import { Text } from './PdfText';
import { PdfRichText } from './PdfRichText';
import { ContactValue } from './PdfContact';
import { breakLinks } from './pdfFontLoader';
import { hasRichText, safeHref } from '@/utils/richText';
import { dateRange, endDateOf, formatDate, presentLabel, startDateOf } from '@/utils/dates';
import { SPACER, SectionTitleOf, SectionRouter, RenderBullets, shadesOf } from './PdfSections';
import { TimelineEntries, TimelineHead, timelineHeadPresence } from './PdfTimeline';
import { EmployerHeader, headPresence } from './PdfItemHeader';
import { employerOf, groupPlaces, groupsRoles, roleGroups } from '@/utils/roleGroups';

/**
 * The Timeline template's sections. Every section whose entries have a header — Experience, Education,
 * Volunteering, Projects and custom sections — prints its entries on the rail (PdfTimeline.jsx), date
 * above title; the rest (Skills, Languages, Certifications, Awards, References, Interests) print as the
 * shared renderers print them on every template (SectionRouter).
 *
 * Each FIELDS entry reads an item as its shared renderer does (PdfSectionsOne/Two/Three.jsx) — the
 * same hidden fields, Show dates / Show location, Title order, "Present" label, date format and GPA —
 * so a section's options mean the same thing here; only the header's layout is the Timeline's.
 */

const hid = (item, field) => (item.hiddenFields || []).includes(field);

/** Per section type: the header fields of an item and the size step of its description (pt under the entry size). */
const FIELDS = {
  experience: (item, s, settings) => {
    const company = hid(item, 'company') ? '' : (item.company || '');
    const role    = hid(item, 'role') ? '' : (item.role || '');
    const start   = hid(item, 'startDate') ? '' : item.startDate;
    const end     = hid(item, 'endDate') ? '' : (item.current ? presentLabel(settings) : item.endDate);
    const byRole  = s.titleOrder === 'role';
    return {
      primary: byRole ? role : company,
      sub: byRole ? company : role,
      loc: !hid(item, 'location') && s.showLocation !== false ? (item.location || '') : '',
      dateStr: s.showDates !== false ? dateRange(start, end, settings) : '',
      desc: hid(item, 'description') ? '' : item.description,
      step: 0,
    };
  },
  education: (item, s, settings) => {
    const degree = [item.degree, item.fieldOfStudy || ''].filter(Boolean).join(', ');
    return {
      primary: item.institution,
      sub: degree + (item.gpa ? ` · GPA: ${item.gpa}` : ''),
      loc: s.showLocation !== false ? (item.location || '') : '',
      dateStr: s.showDates !== false ? dateRange(startDateOf(item), endDateOf(item, settings), settings) : '',
      desc: item.description,
      step: 0.5,
    };
  },
  volunteering: (item, s, settings) => ({
    primary: item.role,
    sub: item.org || '',
    loc: s.showLocation !== false ? (item.location || '') : '',
    dateStr: s.showDates !== false ? dateRange(startDateOf(item), endDateOf(item, settings), settings) : '',
    desc: item.description,
    step: 0.5,
  }),
  custom: (item, s, settings) => ({
    primary: item.title || '',
    sub: item.subtitle || '',
    loc: item.location || '',
    dateStr: s.showDates !== false ? formatDate(item.date || '', settings) : '',
    desc: item.description,
    step: 0.5,
  }),
  // A project's technologies and link are its sub line (subLine), as ProjectsSection prints them.
  projects: (item, s, settings) => ({
    primary: item.name,
    subLine: projectLine(item, settings),
    loc: '',
    dateStr: s.showDates !== false ? dateRange(startDateOf(item), endDateOf(item, settings), settings) : '',
    desc: item.description,
    step: 0.5,
    stacked: true,
  }),
};

/** A project's "technologies · link" line, or null. A link that does not fit its line (a 2-column grid) breaks inside it (R2-105). */
function projectLine(item, settings) {
  if (!item.technologies && !item.url) return null;
  const accent = settings?.accentColor || '#2563eb';
  return (
    <Text style={{ fontSize: settings?.fontSizeBase || 11, color: shadesOf(settings).meta }} hyphenationCallback={item.url ? breakLinks : undefined}>
      {item.technologies}
      {item.url ? <Text style={{ color: accent }}>{item.technologies ? ' · ' : ''}<ContactValue value={item.url} href={safeHref(item.url)} style={{ color: accent }} /></Text> : null}
    </Text>
  );
}

/** Section types with a renderer of their own; any other type prints as a custom section (SectionRouter's default). */
const KNOWN = ['experience', 'skills', 'education', 'certifications', 'projects', 'languages', 'awards', 'volunteering', 'references', 'interests'];

/** Does a `type` section print on the Timeline's rail? Its own FIELDS, or a custom section (any unknown type). */
export const onTimelineRail = (type) => Object.hasOwn(FIELDS, type) || !KNOWN.includes(type);

/** A section whose entries print on the rail. */
function TimelineSection({ section, settings, marginBottom, spaceBefore, itemGap, italicSubs, centered }) {
  const s = section.settings || {};
  // By its own key only: a type named like an Object member ('constructor') is a custom section's (R2-109).
  const fields = Object.hasOwn(FIELDS, section.type) ? FIELDS[section.type] : FIELDS.custom;
  const items = (section.items || []).filter((i) => i.visible !== false);
  const entrySize = (settings?.fontSizeBase || 11) + (settings?.fontSizeEntryDelta ?? 0);
  const lineH = settings?.lineHeightValue || 1.5;
  const body = shadesOf(settings).body;
  const textAlign = centered ? 'center' : 'left';

  const head = (item) => {
    const f = fields(item, s, settings);
    return { primary: f.primary, sub: f.sub || undefined, subLine: f.subLine, loc: f.loc || undefined, dateStr: f.dateStr, titleStyle: f.stacked ? 'stacked' : (s.titleStyle || 'stacked') };
  };

  // Experience's "Group roles by company" (R2-147, roleGroups): a group is one entry on the rail — the
  // employer (and the first role's location) once, then each role with its dot, its date above it, a
  // location only where it differs and its description. The employer leads whatever Order says: that
  // is what it groups by. A job alone at its company prints as it always has.
  const groups = section.type === 'experience' && groupsRoles(s) ? roleGroups(items) : null;
  const groupKeep = Math.round((settings?.fontSizeBase || 11) * lineH * 4);

  // The heading keeps with as much as its first entry's unbreakable header and what that keeps take,
  // measured from the header's own layout (timelineHeadPresence), as every other template measures
  // its first ItemHeader (R2-047): a fixed 5 lines fell short of a centred Stacked head with a sub and
  // a location, or a title that wraps, and left the heading alone at a page foot (R4-DOUT-07). A group
  // leads with its employer line (and, centred, its location under it) and the lines it keeps.
  const firstGroup = groups?.[0]?.length > 1 ? groups[0] : null;
  const groupLoc = firstGroup && centered ? groupPlaces(firstGroup, (item) => fields(item, s, settings).loc).header : '';
  const presence = !items.length ? 0
    : firstGroup ? headPresence({ lines: groupLoc ? 2 : 1, styles: [{ fontFamily: settings?._pdfFontFamily, fontSize: entrySize, fontWeight: 'bold' }], keep: groupKeep, extra: 2 + (groupLoc ? 1 : 0) })
    : timelineHeadPresence({ ...head(items[0]), settings, centered });
  // Through SectionTitleOf, which never keeps less than its own three lines.
  const title = SectionTitleOf({ section, settings, centered, presence });

  const one = (item) => {
    const f = fields(item, s, settings);
    const text = { fontSize: entrySize - f.step, color: body, lineHeight: lineH, textAlign };
    return (
      <View>
        <TimelineHead
          primary={f.primary}
          sub={f.sub || undefined}
          subLine={f.subLine}
          loc={f.loc || undefined}
          dateStr={f.dateStr}
          settings={settings}
          titleStyle={f.stacked ? 'stacked' : (s.titleStyle || 'stacked')}
          italicSub={italicSubs}
          centered={centered}
        />
        {hasRichText(f.desc) && <PdfRichText html={f.desc} style={{ ...text, marginTop: 2 }} />}
        <RenderBullets bullets={item.bullets} style={text} />
      </View>
    );
  };

  const group = (g) => {
    const places = groupPlaces(g, (item) => fields(item, s, settings).loc);
    return (
      <View>
        <EmployerHeader
          company={employerOf(g[0])} loc={places.header || undefined} settings={settings} italicSub={italicSubs} centered={centered}
          keep={groupKeep}
        />
        {g.map((item, k) => {
          const f = fields(item, s, settings);
          const text = { fontSize: entrySize - f.step, color: body, lineHeight: lineH, textAlign };
          return (
            <View key={k} style={k ? { marginTop: itemGap / 2 } : null}>
              {SPACER}
              <TimelineHead
                primary={hid(item, 'role') ? '' : (item.role || '')}
                loc={places.roles[k] || undefined}
                dateStr={f.dateStr}
                settings={settings}
                titleStyle={s.titleStyle || 'stacked'}
                centered={centered}
              />
              {hasRichText(f.desc) && <PdfRichText html={f.desc} style={{ ...text, marginTop: 2 }} />}
              <RenderBullets bullets={item.bullets} style={text} />
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <View style={{ marginBottom, marginTop: spaceBefore }}>
      {SPACER}
      <TimelineEntries
        title={title}
        items={groups || items}
        cols={s.columns || 1}
        gap={itemGap}
        settings={settings}
        renderItem={groups ? (g) => (g.length > 1 ? group(g) : one(g[0])) : one}
      />
    </View>
  );
}

/** SectionRouter for the Timeline: sections with entry headers on the rail, the rest as every template prints them. */
export function TimelineSectionRouter(props) {
  const { section } = props;
  if (section.visible === false) return null;
  if (!onTimelineRail(section.type)) return <SectionRouter {...props} />;
  const centered = section.settings?.alignment === 'center';
  return <TimelineSection {...props} centered={centered} />;
}
