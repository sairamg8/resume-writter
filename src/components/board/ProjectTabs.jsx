import { Star } from 'lucide-react';
import { IconButton, NavTabs } from '@/components/ui';
import { PageHeader } from '@/components/shell';
import { PROJECT_VIEWS, projectPath } from '@/components/shell/projectViews';
import { useBoardStore } from '@/hooks/useBoardStore';

/** A project's views as tabs — Summary · Timeline · Backlog · Board · Calendar · List. */
export function ProjectTabs({ boardId }) {
  return (
    <NavTabs
      aria-label="Project views"
      items={PROJECT_VIEWS.map((v) => ({ to: projectPath(boardId, v.path), label: v.label, icon: v.icon, end: true }))}
    />
  );
}

/** A project's avatar: its first letter on its colour. */
export function ProjectAvatar({ board, size = 32 }) {
  const letter = Array.from((board.key || board.title || '?').trim())[0]?.toUpperCase() ?? '?';
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-md font-bold text-white"
      style={{ width: size, height: size, backgroundColor: board.color || '#94a3b8', fontSize: Math.round(size * 0.45) }}
    >
      {letter}
    </span>
  );
}

/**
 * The header every project page shares: Projects / <project> breadcrumbs, the project's avatar
 * and name (click to rename), its star, the page's own `actions`, and the view tabs under it.
 * `children` sit under the title row (a page's toolbar that should stick with it).
 */
export function ProjectHeader({ board, actions, children }) {
  const store = useBoardStore();
  return (
    <PageHeader
      breadcrumbs={[{ label: 'Projects', to: '/boards' }, { label: board.title || 'Untitled project' }]}
      title={board.title || 'Untitled project'}
      titleLabel="Project name"
      onTitleChange={(title) => store.updateBoard(board.id, { title })}
      icon={<ProjectAvatar board={board} />}
      actions={(
        <>
          <IconButton
            icon={Star}
            label={board.starred ? 'Unstar project' : 'Star project'}
            pressed={board.starred}
            onClick={() => store.toggleStar(board.id)}
            className={board.starred ? '[&_svg]:fill-amber-400 [&_svg]:text-amber-500' : undefined}
          />
          {actions}
        </>
      )}
      tabs={<ProjectTabs boardId={board.id} />}
    >
      {children}
    </PageHeader>
  );
}
