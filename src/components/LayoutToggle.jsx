import { PanelLeft, Columns2, Eye } from 'lucide-react';

const MODES = [
  { mode: 'editor',  Icon: PanelLeft, title: 'Editor only' },
  { mode: 'split',   Icon: Columns2,  title: 'Split view' },
  { mode: 'preview', Icon: Eye,       title: 'Preview only' },
];

export function LayoutToggle({ layoutMode, setLayoutMode }) {
  return (
    <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5 shrink-0">
      {MODES.map(({ mode, Icon, title }) => (
        <button
          key={mode}
          title={title}
          onClick={() => setLayoutMode(mode)}
          className={`p-1.5 rounded-md transition-all ${layoutMode === mode ? 'bg-white text-gray-700 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
        >
          <Icon size={13} />
        </button>
      ))}
    </div>
  );
}
