/**
 * Section Options → "Group roles by company" (settings.groupRoles, R2-147): several roles at one
 * employer under one employer header — the company (and its location) once, then each role with its
 * own dates and description, in the order they were entered. The PDF's renderers (every template),
 * Word and Markdown read the groups from here, so they group alike; the ATS text does not (each role
 * keeps its company there: the form a résumé parser reads a job in).
 *
 * Plain code with no imports: tests/unit loads it as it is.
 *
 * - Consecutive entries whose company matches — trimmed, any case, not empty — form a group; a job
 *   between two at one company splits them, as the reader would read them apart.
 * - A company hidden with its eye matches nothing: that entry prints as it always has.
 * - Unset or off, every entry is a group of its own, and prints exactly as before.
 * - Grids: a group is one entry of the grid — one cell, its roles stacked in it — as a single entry
 *   is, so the option means the same in one column and in two.
 */

const hidden = (item, key) => (item?.hiddenFields || []).includes(key);

/** An entry's employer as it prints, trimmed; '' when there is none or its eye hides it. */
export const employerOf = (item) => (hidden(item, 'company') ? '' : String(item?.company ?? '').trim());

const same = (a, b) => a.toLowerCase() === b.toLowerCase();

/** Does the section group its roles? Its Section Options' "Group roles by company" (off when unset). */
export const groupsRoles = (settings) => settings?.groupRoles === true;

/**
 * `items` (the shown entries, in order) as groups: arrays of consecutive entries at one employer. With
 * `on` false every entry is a group of one.
 */
export function roleGroups(items, on = true) {
  const groups = [];
  for (const item of items || []) {
    const last = groups[groups.length - 1];
    const employer = employerOf(item);
    if (on && last && employer && same(employerOf(last[0]), employer)) last.push(item);
    else groups.push([item]);
  }
  return groups;
}

/**
 * Where a group's locations print, `placeOf(item)` giving an entry's location as it prints ('' when
 * hidden or Show location is off): the first role's on the employer header (when every role shares it,
 * that is theirs), and under a later role only one that differs from it — so no location is lost.
 * { header, roles: [one per role, '' where the header holds it] }.
 */
export function groupPlaces(group, placeOf) {
  const header = String(placeOf(group[0]) || '').trim();
  const roles = group.map((item, i) => {
    const own = String(placeOf(item) || '').trim();
    return i === 0 || same(own, header) ? '' : own;
  });
  return { header, roles };
}
