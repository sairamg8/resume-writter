import { CalendarDays, GanttChart, LayoutDashboard, List, ListTodo, Settings, SquareKanban } from 'lucide-react';

// A project's views, in the order its tabs and its sidebar tree show them. `path` follows the
// project's own address (/boards/:id); the Board is the project's home, so it matches exactly.

export const PROJECT_VIEWS = [
  { id: 'summary', label: 'Summary', path: '/summary', icon: LayoutDashboard },
  { id: 'timeline', label: 'Timeline', path: '/timeline', icon: GanttChart },
  { id: 'backlog', label: 'Backlog', path: '/backlog', icon: ListTodo },
  { id: 'board', label: 'Board', path: '', icon: SquareKanban, end: true },
  { id: 'calendar', label: 'Calendar', path: '/calendar', icon: CalendarDays },
  { id: 'list', label: 'List', path: '/list', icon: List },
];

export const PROJECT_SETTINGS = { id: 'settings', label: 'Project settings', path: '/settings', icon: Settings };

/** A project's address, and one of its views'. */
export const projectPath = (id, view = '') => `/boards/${encodeURIComponent(id)}${view}`;

/** Whether `pathname` is inside project `id` (any of its views). */
export const inProject = (pathname, id) => pathname === projectPath(id) || pathname.startsWith(`${projectPath(id)}/`);
