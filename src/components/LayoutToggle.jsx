import { PanelLeft, Columns2, Eye } from 'lucide-react';

const MODES = [
  { mode: 'editor',  Icon: PanelLeft, title: 'Editor only' },
  { mode: 'split',   Icon: Columns2,  title: 'Split view' },
  { mode: 'preview', Icon: Eye,       title: 'Preview only' },
];

export function LayoutToggle({ layoutMode, setLayoutMode }) {
  return (
    <div data-testid="layout-toggle" className="inline-flex gap-0.5 bg-cv-surface border border-cv-hairline rounded-cv-control p-0.5 shrink-0">
      {MODES.map(({ mode, Icon, title }) => (
        <button
          key={mode}
          title={title}
          data-testid={`layout-${mode}`}
          data-active={layoutMode === mode}
          onClick={() => setLayoutMode(mode)}
          className={`p-1.5 rounded-[7px] transition-colors ${layoutMode === mode ? 'bg-cv-sunken text-cv-ink' : 'text-cv-faint hover:text-cv-ink'}`}
        >
          <Icon size={13} />
        </button>
      ))}
    </div>
  );
}
