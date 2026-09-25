import { createContext, useContext } from 'react';

/**
 * What the workspace shell shares with the pages inside it: the mobile navigation drawer
 * (`openNav`, `closeNav`), the create-issue dialog (`openCreate({ boardId, columnId, sprintId,
 * type, epicId })`), and the sidebar's `projects` (`[{ id, name, key, color, starred, updatedAt }]`
 * — a page can name a project in its breadcrumbs without reading the store). null outside the shell.
 */
export const WorkspaceContext = createContext(null);

export function useWorkspace() {
  return useContext(WorkspaceContext);
}
