import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FolderKanban, MoreHorizontal, Plus, Star } from 'lucide-react';
import { useBoardStore } from '@/hooks/useBoardStore';
import { Avatar, Button, EmptyState, IconButton, Menu, SearchInput, useConfirmOptional, useToast, useUrlState } from '@/components/ui';
import { PageHeader } from '@/components/shell';
import { withSearchParam } from '@/hooks/useUrlState';
import { BoardStorageNotice } from '@/components/board/BoardStorageNotice';
import { CreateProjectDialog } from '@/components/board/CreateProjectDialog';
import { ProjectAvatar } from '@/components/board/ProjectTabs';
import { issueCounts } from '@/utils/boardQuery';
import { relativeTime } from '@/utils/uiFormat';

/**
 * The columns a phone does without (Key, Type, Lead, Updated), in the header and every row: the
 * table then fits a 375px screen, with each row's menu in view. Key and Updated are back from sm, but go
 * again between md and lg: the sidebar is a column there, and at 768px Name was cut to one letter.
 */
const SIDEBAR_HIDDEN = 'hidden sm:table-cell md:max-lg:hidden';
/** Type and Lead wait for xl, and the 48rem floor with them: at lg (1024px) Name was cut to "Person…" with all six columns. */
const NARROW_HIDDEN = 'hidden xl:table-cell';

/**
 * Projects (/boards): every project as a row — star, name, key, type, lead, open and total
 * issues, last update — searchable, with "Create project" (also `?create=1`, the sidebar's link)
 * and a row menu (open, settings, delete — asked first, then Undo).
 */
export function Boards() {
  const navigate = useNavigate();
  const store = useBoardStore();
  const confirm = useConfirmOptional();
  const { toast } = useToast();
  const location = useLocation();
  const [creating, setCreating] = useUrlState('create', null);
  // The create step opened from this list is a history entry of its own (marked in the router state), so
  // Back from the new board, which replaces that entry, lands on the list, and Cancel steps back to it.
  // Another page's link (?create=1: the sidebar, the top bar, Your work) has no list entry to keep.
  const createFromList = location.state?.createFromList === true;
  const openCreate = () => {
    if (creating === '1') return;
    navigate({ pathname: location.pathname, search: withSearchParam(location.search, 'create', '1'), hash: location.hash }, { state: { createFromList: true } });
  };
  const closeCreate = () => (createFromList ? navigate(-1) : setCreating(null));
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const rows = store.boards
    .filter((b) => !q || (b.title || '').toLowerCase().includes(q) || (b.key || '').toLowerCase().includes(q))
    .sort((a, b) => Number(b.starred) - Number(a.starred) || (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  const open = (b, view = '') => navigate(`/boards/${encodeURIComponent(b.id)}${view}`);

  async function remove(b) {
    const ok = await confirm({ title: `Delete ${b.title || 'this project'}?`, body: `The project and its ${b.issues.length} issue${b.issues.length === 1 ? '' : 's'} will be deleted. You can undo this for a few seconds.`, confirmLabel: 'Delete project', tone: 'danger' });
    if (!ok) return;
    const removed = store.deleteBoard(b.id);
    if (removed) toast({ title: `${b.title || 'Project'} deleted`, action: { label: 'Undo', onClick: () => store.restoreBoard(removed) } });
  }

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title="Projects" actions={<Button variant="primary" leftIcon={Plus} onClick={openCreate}>Create project</Button>} />
      <BoardStorageNotice persistError={store.persistError} recovery={store.recovery} onDismissRecovery={store.dismissRecovery} className="px-4 pt-3 md:px-8" />
      <div className="flex flex-col gap-4 px-4 py-4 md:px-8">
        {store.boards.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title="Plan your work and your life in projects"
            description="A project holds issues on a board, in a backlog, on a timeline and a calendar. Start from Kanban, Scrum, Personal or a blank one."
            action={<Button variant="primary" leftIcon={Plus} onClick={openCreate}>Create project</Button>}
          />
        ) : (
          <>
            <SearchInput value={query} onChange={setQuery} placeholder="Search projects" size="sm" className="w-full sm:w-64" />
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-0 text-sm xl:min-w-[48rem]">
                <caption className="sr-only">Projects</caption>
                <thead>
                  <tr className="text-left text-[12px] font-semibold text-cv-muted">
                    <th scope="col" className="w-10 border-b-2 border-cv-hairline px-2 py-2"><span className="sr-only">Starred</span><Star size={14} aria-hidden="true" /></th>
                    <th scope="col" className="border-b-2 border-cv-hairline px-2 py-2">Name</th>
                    <th scope="col" className={`w-24 border-b-2 border-cv-hairline px-2 py-2 ${SIDEBAR_HIDDEN}`}>Key</th>
                    <th scope="col" className={`w-28 border-b-2 border-cv-hairline px-2 py-2 ${NARROW_HIDDEN}`}>Type</th>
                    <th scope="col" className={`w-28 border-b-2 border-cv-hairline px-2 py-2 ${NARROW_HIDDEN}`}>Lead</th>
                    <th scope="col" className="w-32 border-b-2 border-cv-hairline px-2 py-2">Issues</th>
                    <th scope="col" className={`w-28 border-b-2 border-cv-hairline px-2 py-2 ${SIDEBAR_HIDDEN}`}>Updated</th>
                    <th scope="col" className="w-12 border-b-2 border-cv-hairline px-2 py-2"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((b) => {
                    const counts = issueCounts(b);
                    return (
                      <tr key={b.id} className="group h-12 hover:bg-cv-stage">
                        <td className="border-b border-cv-hairline px-2">
                          <IconButton icon={Star} size="sm" label={b.starred ? `Unstar ${b.title}` : `Star ${b.title}`} pressed={b.starred} onClick={() => store.toggleStar(b.id)} className={b.starred ? '[&_svg]:fill-cv-warn [&_svg]:text-cv-warn' : 'opacity-60 group-hover:opacity-100'} />
                        </td>
                        <td className="border-b border-cv-hairline px-2">
                          {/* A long name is cut short in the cell at every width (inline-size containment: it
                              no longer sets the column's width), so it cannot push the menu off screen —
                              from sm up it widened the table past its container too (R5-JOB-04). */}
                          <button type="button" onClick={() => open(b)} className="flex w-full min-w-0 items-center gap-2.5 text-left font-medium text-cv-brand-text hover:underline contain-inline-size">
                            <ProjectAvatar board={b} size={24} />
                            <span className="truncate">{b.title || 'Untitled project'}</span>
                          </button>
                        </td>
                        <td className={`border-b border-cv-hairline px-2 text-cv-muted ${SIDEBAR_HIDDEN}`}>{b.key}</td>
                        <td className={`border-b border-cv-hairline px-2 text-cv-muted ${NARROW_HIDDEN}`}>{b.mode === 'scrum' ? 'Scrum' : 'Kanban'}</td>
                        <td className={`border-b border-cv-hairline px-2 ${NARROW_HIDDEN}`}><span className="flex items-center gap-2 text-cv-muted"><Avatar name="You" size="xs" decorative />You</span></td>
                        <td className="whitespace-nowrap border-b border-cv-hairline px-2 text-cv-muted">{counts.open} open · {counts.total} total</td>
                        <td className={`border-b border-cv-hairline px-2 text-cv-muted ${SIDEBAR_HIDDEN}`}>{relativeTime(b.updatedAt)}</td>
                        <td className="border-b border-cv-hairline px-2">
                          <Menu
                            label={`${b.title} actions`}
                            items={[
                              { id: 'open', label: 'Open board', onSelect: () => open(b) },
                              { id: 'summary', label: 'Summary', onSelect: () => open(b, '/summary') },
                              { id: 'settings', label: 'Project settings', onSelect: () => open(b, '/settings') },
                              { type: 'separator' },
                              { id: 'delete', label: 'Delete project', danger: true, onSelect: () => remove(b) },
                            ]}
                            trigger={<IconButton icon={MoreHorizontal} label={`${b.title} actions`} size="sm" />}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {rows.length === 0 && <p className="py-8 text-center text-sm break-words text-cv-faint">No projects match “{query.trim()}”.</p>}
            </div>
          </>
        )}
      </div>
      <CreateProjectDialog open={creating === '1'} onClose={closeCreate} onCreated={(b) => navigate(`/boards/${encodeURIComponent(b.id)}`, { replace: true })} />
    </div>
  );
}
