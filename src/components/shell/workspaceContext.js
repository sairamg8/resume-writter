import { createContext, useContext } from 'react';

/**
 * What the workspace shell shares with the pages inside it: the mobile navigation drawer
 * (`openNav`, `closeNav`), the sidebar's `projects` (`[{ id, name, key, color, starred,
 * updatedAt }]` — a page can name a project in its breadcrumbs without reading the store), and
 * `registerHeader()` — a PageHeader announces itself so the shell drops its own fallback top bar
 * (which carries the menu button on a phone until every page has a PageHeader). null outside the
 * shell.
 */
export const WorkspaceContext = createContext(null);

export function useWorkspace() {
  return useContext(WorkspaceContext);
}
