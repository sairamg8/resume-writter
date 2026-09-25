// The top bar's search: projects by name or key, and issues by key ("LIFE-12", "life 12") or by
// words of their title, across every project — what a tracker's quick search finds. Pure: the
// shell hands it the board store's list (tests/unit/workspace-search.unit.mjs).
import { issueKey } from './boardModel.js';

const norm = (s) => String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Up to `limit` results for `query` in `boards`: `[{ kind: 'project' | 'issue', id, title,
 * subtitle, key, type, color, to }]` — projects first, then issues whose key starts with the
 * query, then those whose title holds every word of it, open issues before done ones. An empty
 * query finds nothing.
 */
export function searchWorkspace(boards, query, { limit = 8 } = {}) {
  const q = norm(query);
  if (!q || !Array.isArray(boards)) return [];
  const keyQuery = q.replace(/[\s_]+/g, '-');
  const words = q.split(' ');
  const projects = [];
  const byKey = [];
  const byTitle = [];
  for (const b of boards) {
    if (!b || !Array.isArray(b.issues)) continue;
    const base = `/boards/${encodeURIComponent(b.id)}`;
    if (norm(b.title).includes(q) || norm(b.key).startsWith(q)) {
      projects.push({ kind: 'project', id: b.id, title: b.title || 'Untitled project', subtitle: b.key, key: b.key, color: b.color, to: base });
    }
    const done = new Set((b.columns ?? []).filter((c) => c.category === 'done').map((c) => c.id));
    for (const issue of b.issues) {
      const key = issueKey(b, issue);
      const hit = {
        kind: 'issue', id: issue.id, title: issue.title, subtitle: b.title, key, type: issue.type,
        done: done.has(issue.columnId), to: `${base}?issue=${encodeURIComponent(key)}`,
      };
      if (key.toLowerCase().startsWith(keyQuery)) byKey.push(hit);
      else if (words.every((w) => norm(issue.title).includes(w))) byTitle.push(hit);
    }
  }
  const openFirst = (a, b) => Number(a.done) - Number(b.done);
  return [...projects, ...byKey.sort(openFirst), ...byTitle.sort(openFirst)].slice(0, limit);
}
