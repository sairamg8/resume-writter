import { useParams } from 'react-router-dom';
import { ArrowRight, ListChecks, ListTodo, Settings } from 'lucide-react';
import { Button, EmptyState, NavTabs } from '../ui/index.js';
import { PageHeader } from './PageHeader.jsx';
import { useWorkspace } from './workspaceContext.js';

/**
 * A workspace page that is not built yet: its header, and one calm note saying what will be here
 * and where to go meanwhile. The routes exist now so the sidebar and a project's tabs lead
 * somewhere real; BOARDS-UI-B replaces each with its page (docs/tracking/boards-jobs-plan/01, Routes).
 */
export function PlaceholderPage({ title, icon, heading, description, breadcrumbs, tabs, action }) {
  return (
    <>
      <PageHeader title={title} breadcrumbs={breadcrumbs} tabs={tabs} />
      <div className="flex flex-1 items-start justify-center px-4 py-10 md:px-6 md:py-16">
        <EmptyState
          icon={icon}
          title={heading}
          description={description}
          action={action}
          bordered
          className="w-full max-w-xl"
        />
      </div>
    </>
  );
}

/** /work — every issue across the projects, once BOARDS-UI-B builds it. */
export function YourWorkPlaceholder() {
  return (
    <PlaceholderPage
      title="Your work"
      icon={ListChecks}
      heading="Your work is on its way"
      description="Issues due soon and in progress across every project will gather here. Until then, each project's board shows its own."
      action={<Button to="/boards" variant="primary" rightIcon={ArrowRight}>Open projects</Button>}
    />
  );
}

const VIEWS = {
  backlog: {
    title: 'Backlog',
    icon: ListTodo,
    heading: 'The backlog is on its way',
    description: 'Ranking issues and planning sprints will happen here. Until then, the board holds every issue of this project.',
  },
  settings: {
    title: 'Settings',
    icon: Settings,
    heading: 'Project settings are on their way',
    description: 'Columns, labels, the key and the project’s details will be edited here. Until then, the board keeps its current settings.',
  },
};

/** /boards/:id/backlog and /boards/:id/settings: the project's header and tabs, and a note. */
export function ProjectViewPlaceholder({ view }) {
  const { id = '' } = useParams();
  const project = useWorkspace()?.projects?.find((p) => p.id === id);
  const base = `/boards/${encodeURIComponent(id)}`;
  const page = VIEWS[view] ?? VIEWS.backlog;
  return (
    <PlaceholderPage
      title={page.title}
      icon={page.icon}
      heading={page.heading}
      description={page.description}
      breadcrumbs={[{ label: 'Projects', to: '/boards' }, { label: project?.name ?? 'Project', to: base }, { label: page.title }]}
      tabs={(
        <NavTabs
          aria-label="Project views"
          items={[
            { to: base, label: 'Board', end: true },
            { to: `${base}/backlog`, label: 'Backlog' },
            { to: `${base}/settings`, label: 'Settings' },
          ]}
        />
      )}
      action={<Button to={base} variant="primary" rightIcon={ArrowRight}>Open the board</Button>}
    />
  );
}
