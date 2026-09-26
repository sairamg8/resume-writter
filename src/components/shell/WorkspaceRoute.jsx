import { useCallback, useMemo } from 'react';
import { WorkspaceLayout, sidebarProjects } from '@/components/shell';
import { CreateIssueDialog } from '@/components/board/CreateIssueDialog';
import { useBoardStore } from '@/hooks/useBoardStore';
import { searchWorkspace } from '@/utils/workspaceSearch';

const renderCreate = (props) => <CreateIssueDialog {...props} />;

/**
 * The workspace shell (top bar, sidebar, scrolling main) as a layout route, its sidebar's projects,
 * its quick search and its Create dialog reading the board store. Only the workspace pages mount
 * it, so the résumé dashboard and editor never load the boards. The mapping reads v1 and v2 boards
 * alike (shell/projects.js). Its own module, loaded with the first workspace page (AppRoutes.jsx): the
 * shell, the Create dialog and its pickers are not on the dashboard's start-up path (R2-142).
 */
export function WorkspaceRoute() {
  const { boards } = useBoardStore();
  const projects = useMemo(() => sidebarProjects(boards), [boards]);
  const search = useCallback((query) => searchWorkspace(boards, query), [boards]);
  return <WorkspaceLayout projects={projects} search={search} renderCreate={renderCreate} />;
}
