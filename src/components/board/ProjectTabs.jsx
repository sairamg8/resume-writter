import { NavTabs } from '@/components/ui';

/** A project's Board | Backlog | Settings tabs, for the header of each of its pages. */
export function ProjectTabs({ boardId }) {
  const base = `/boards/${encodeURIComponent(boardId)}`;
  return (
    <NavTabs
      aria-label="Project views"
      items={[
        { to: base, label: 'Board', end: true },
        { to: `${base}/backlog`, label: 'Backlog' },
        { to: `${base}/settings`, label: 'Settings' },
      ]}
    />
  );
}
