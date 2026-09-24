// The sidebar's Projects group, read from whatever the board store holds. Pure (no React) so the
// node test feeds it v1 boards ({ id, title, color }), v2 boards (+ key, starred) and junk alike:
// the store is being moved to v2 while the shell ships, and a sidebar must never crash the app.

const textOf = (value) => (typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '');

/** `[{ id, name, key, color, starred, updatedAt }]` from the store's boards; what is not a board is skipped. */
export function sidebarProjects(boards) {
  if (!Array.isArray(boards)) return [];
  return boards
    .filter((b) => b && typeof b === 'object' && b.id != null && b.id !== '')
    .map((b) => ({
      id: String(b.id),
      // v2 boards carry `title`; a `name` (the shell's own word) wins when a store has one.
      name: textOf(b.name) || textOf(b.title) || 'Untitled project',
      key: typeof b.key === 'string' ? b.key.trim() : '',
      color: typeof b.color === 'string' && b.color ? b.color : null,
      starred: !!b.starred,
      updatedAt: Number.isFinite(b.updatedAt) ? b.updatedAt : 0,
    }));
}

const byName = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

/**
 * The projects the sidebar lists: starred ones first (by name, never cut), then the most recently
 * updated, up to `limit` in all. `hidden` counts the rest, for "View all projects".
 */
export function orderProjects(projects, limit = 8) {
  const starred = projects.filter((p) => p.starred).sort(byName);
  const recent = projects.filter((p) => !p.starred).sort((a, b) => b.updatedAt - a.updatedAt || byName(a, b));
  const shown = [...starred, ...recent].slice(0, Math.max(limit, starred.length));
  return { shown, hidden: projects.length - shown.length };
}
