// A résumé's sections in the shape every reader of them expects. A hand-written or other-tool .json,
// or an older save, can hold a null section or entry, `items` that is not a list, sections or
// entries with no id or the same id twice, a section with no title, or Grids stored as text. The
// editor, the PDF, Word, Markdown and the JSON Resume export threw on the first ones (R2-031, R2-056);
// the store finds a section or an entry by its id, so entries sharing one were edited and deleted
// together (R2-055); and the grid steps through the entries by `columns`, so "2" crammed a row,
// and a 3 Section Options never offers showed no chip (R2-110). normalizeResume() runs withSectionShapes() wherever résumés come in, whatever their data
// version.
import { SECTION_TYPE_DEFAULTS } from '@/utils/defaultDataSectionTypes';

const isRecord = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

/** An id the store can find a section or an entry by: text, or a number an older file stored. */
const validId = (id) => (typeof id === 'string' && id.trim() !== '') || Number.isFinite(id);

/**
 * The most Grids a section of `type` keeps: what Section Options offers it (SectionEditorCustomizer) —
 * 4 for Skills, 2 for the rest — so the chip that shows active is the one that prints. An imported
 * 3 on Experience showed no chip at all, while the PDF laid it out three to a row.
 */
const maxColumns = (type) => (type === 'skills' ? 4 : 2);

/**
 * `settings` with its Grids a whole number from 1 to its type's most (maxColumns), or none (the
 * default prints) where it stores no number, or 0 — which every reader (`s.columns || 2`) has always
 * printed as none, so Languages and References keep their two. Settings that are not an object read
 * as none. The same object when it is.
 */
function withColumns(settings, type) {
  if (!isRecord(settings)) return settings === undefined ? settings : undefined;
  if (!('columns' in settings)) return settings;
  const v = settings.columns;
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  if (Number.isFinite(n) && n !== 0) {
    const columns = Math.min(maxColumns(type), Math.max(1, Math.round(n)));
    return columns === v ? settings : { ...settings, columns };
  }
  const { columns: _dropped, ...rest } = settings;
  return rest;
}

/**
 * `sections` as a list of section objects, each with an id, a title and a list of entry objects that
 * have ids. Ids are unique across the résumé: the first section or entry holding an id keeps it, as
 * every valid id is kept (the cloud sync keys on them); one with none, or a repeat, gets
 * `<section id>_item<n>` (an entry) or `<type>_<n>` (a section), the same on every load, so two
 * devices loading the same file agree. A section with no title gets its type's. The same array when
 * nothing changes.
 */
export function withSectionShapes(r) {
  const given = Array.isArray(r.sections) ? r.sections : [];
  const kept = given.filter(isRecord).map((s) => (Array.isArray(s.items) && s.items.every(isRecord) ? s : { ...s, items: (Array.isArray(s.items) ? s.items : []).filter(isRecord) }));

  // Which holders keep their ids: the first of each, in the order the résumé lists them.
  const taken = new Set();
  const keeps = (id) => validId(id) && !taken.has(String(id)) && Boolean(taken.add(String(id)));
  const keptIds = kept.map((s) => ({ section: keeps(s.id), items: s.items.map((item) => keeps(item.id)) }));
  const fresh = (base) => {
    let id = base;
    for (let n = 2; taken.has(id); n += 1) id = `${base}_${n}`;
    taken.add(id);
    return id;
  };

  const sections = kept.map((s, i) => {
    // A type is its own only by its own key: one named like an Object member ('toString') is a custom
    // section's, and takes a custom section's title (R2-109).
    const known = Object.hasOwn(SECTION_TYPE_DEFAULTS, s.type);
    const id = keptIds[i].section ? s.id : fresh(`${known ? s.type : 'section'}_${i + 1}`);
    const items = s.items.map((item, j) => (keptIds[i].items[j] ? item : { ...item, id: fresh(`${id}_item${j + 1}`) }));
    const title = s.title == null ? (known ? SECTION_TYPE_DEFAULTS[s.type] : SECTION_TYPE_DEFAULTS.custom)(id).title : s.title;
    const settings = withColumns(s.settings, s.type);
    const same = id === s.id && title === s.title && settings === s.settings && items.every((item, j) => item === s.items[j]);
    if (same) return s;
    const out = { ...s, id, title, items };
    if (settings === undefined) delete out.settings;
    else out.settings = settings;
    return out;
  });
  if (given === r.sections && sections.length === given.length && sections.every((s, i) => s === given[i])) return r;
  return { ...r, sections };
}
