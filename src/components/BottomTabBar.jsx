import { Link, useLocation } from 'react-router-dom';
import { TABS, activeTab } from '@/components/AppBar';

/** The phone's three areas, fixed to the bottom (the top bar's nav shows from md). */
export default function BottomTabBar() {
  const now = activeTab(useLocation().pathname);
  return (
    <nav data-testid="bottom-tab-bar" className="md:hidden fixed inset-x-0 bottom-0 z-30 flex h-[72px] px-6 pb-2 bg-cv-surface border-t border-cv-hairline">
      {TABS.map(([id, to, label, Icon]) => (
        <Link key={id} to={to} data-testid={`bottom-tab-${id}`} className="cv-tab" aria-current={now === id ? 'page' : undefined}>
          <Icon size={22} />{label}
        </Link>
      ))}
    </nav>
  );
}
