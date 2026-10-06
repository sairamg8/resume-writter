import { Link, useLocation } from 'react-router-dom';
import { FileText, Briefcase, LayoutGrid } from 'lucide-react';

export const TABS = [
  ['documents', '/', 'Documents', FileText],
  ['applications', '/jobs', 'Applications', Briefcase],
  ['projects', '/boards', 'Projects', LayoutGrid],
];

/** Which of the three areas an address belongs to; Terms, Privacy and the public page belong to none. */
export const activeTab = (path) => {
  if (path === '/' || path === '/new' || path.startsWith('/resume/')) return 'documents';
  if (path === '/jobs' || path.startsWith('/jobs/')) return 'applications';
  if (path === '/work' || path === '/boards' || path.startsWith('/boards/')) return 'projects';
  return null;
};

/** The top bar: brand, the three areas, an optional search slot and the account; `children` make a second row. */
export default function AppBar({ account, search, active, children }) {
  const { pathname } = useLocation();
  const now = active === undefined ? activeTab(pathname) : active;
  return (
    <header data-testid="app-bar" className="bg-cv-surface border-b border-cv-hairline text-cv-ink">
      <div className="h-14 md:h-16 px-4 md:px-8 flex items-center gap-4 md:gap-8">
        <Link to="/" className="flex items-center gap-2.5 shrink-0">
          <span className="flex size-[30px] md:size-8 items-center justify-center rounded-cv-control bg-cv-brand text-xs md:text-[13px] font-bold text-white">CV</span>
          <span className="text-base md:text-[17px] font-bold tracking-tight">CPWT-CV</span>
        </Link>
        <nav className="hidden md:flex gap-1">
          {TABS.map(([id, to, label]) => (
            <Link key={id} to={to} data-testid={`app-bar-nav-${id}`} className="cv-pill-nav text-sm" aria-current={now === id ? 'page' : undefined}>{label}</Link>
          ))}
        </nav>
        <div className="flex-1 min-w-0" />
        {search}
        <div className="flex items-center gap-2 shrink-0">{account}</div>
      </div>
      {children}
    </header>
  );
}
