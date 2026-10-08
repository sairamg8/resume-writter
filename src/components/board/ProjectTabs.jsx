import { useEffect, useRef } from 'react';
import { Star } from 'lucide-react';
import { IconButton, NavTabs } from '@/components/ui';
import { PageHeader } from '@/components/shell';
import { PROJECT_VIEWS, projectPath } from '@/components/shell/projectViews';
import { useBoardStore } from '@/hooks/useBoardStore';

/**
 * A project's views as tabs — Summary · Timeline · Backlog · Board · Calendar · List. Below lg the
 * row can be wider than the screen: it pans sideways, its right edge fades out as the cue, and the
 * current tab is scrolled into view when the page opens (at 768px Calendar was half shown and List hidden).
 */
export function ProjectTabs({ boardId }) {
  const box = useRef(null);
  useEffect(() => {
    box.current?.querySelector?.('[aria-current="page"]')?.scrollIntoView?.({ inline: 'nearest', block: 'nearest' });
  }, [boardId]);
  return (
    <div ref={box} className="min-w-0">
      <NavTabs
        aria-label="Project views"
        className="max-lg:[mask-image:linear-gradient(to_right,#000_calc(100%-2rem),transparent)]"
        items={PROJECT_VIEWS.map((v) => ({ to: projectPath(boardId, v.path), label: v.label, icon: v.icon, end: true }))}
      />
    </div>
  );
}

/** A project's avatar: its first letter on its colour. */
export function ProjectAvatar({ board, size = 32 }) {
  const letter = Array.from((board.key || board.title || '?').trim())[0]?.toUpperCase() ?? '?';
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-cv-control font-bold text-white"
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
            className={board.starred ? '[&_svg]:fill-cv-warn [&_svg]:text-cv-warn' : undefined}
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
