import { useState, useMemo } from 'react';
import { Search, X, Check, ImagePlus, RotateCcw } from 'lucide-react';
import { Button, buttonClass } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { getSelectableIcons, resolveIconShapes } from '@/utils/contactIconPaths';

function IconPreview({ shapes, size = 20 }) {
  if (!shapes || !shapes.length) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {shapes.map(({ tag: Shape, props }, i) => (
        <Shape key={i} {...props} />
      ))}
    </svg>
  );
}

export default function HeaderIconPickerModal({
  isOpen,
  onClose,
  fieldKey,
  fieldLabel,
  currentCustomIcon,
  _settings,
  onSelectIcon,
  onPickIconFile,
  onClearIcon,
}) {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('recommended'); // 'recommended' | 'styles' | 'all'
  // Each opening starts on Recommended with an empty search, not on the last one's: the picker stays
  // mounted while closed, and while it animates out.
  const [wasOpen, setWasOpen] = useState(false);
  if (!!isOpen !== wasOpen) {
    setWasOpen(!!isOpen);
    if (isOpen) {
      setSearch('');
      setActiveTab('recommended');
    }
  }

  const { recommended = [], all = [] } = useMemo(() => getSelectableIcons(fieldKey) || {}, [fieldKey]);

  // Style pack variants for this specific field
  const packVariants = useMemo(() => [
    { id: 'pack:lucide', label: 'Classic Outline', desc: 'Standard Lucide outline style', packId: 'lucide' },
    { id: 'pack:refined', label: 'Modern Refined', desc: 'Sleek rounded line style', packId: 'refined' },
    { id: 'pack:filled', label: 'Solid Filled', desc: 'High-contrast filled shape', packId: 'filled' },
    { id: 'pack:minimal', label: 'Minimalist', desc: 'Ultra-clean geometric line', packId: 'minimal' },
    { id: 'pack:bold', label: 'Bold Outline', desc: 'Extra heavy outline weight', packId: 'bold' },
  ], []);

  // Filtered icons based on search
  const filteredIcons = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = activeTab === 'recommended' && recommended.length > 0 ? recommended : (all || []);
    if (!q) return list;
    return (all || []).filter(
      item =>
        item.label.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q) ||
        (item.category && item.category.toLowerCase().includes(q))
    );
  }, [search, activeTab, recommended, all]);

  function handleSelect(id) {
    onSelectIcon(id);
    onClose();
  }

  const currentVal = currentCustomIcon || '';

  // The kit's Dialog, as every other editor dialog is (R4-DVIS-25): in a portal over the page, with the
  // kit's title and close button, closing on Escape, and on a click beside the box only when the press
  // both starts and ends there — selecting the search text and releasing outside keeps it (R5-DLG-01).
  // On a phone it fills the screen, the grid scrolling under the search and tabs, between the title and
  // the action row (R4-DPH-37); the action row wraps rather than squeezing its buttons (R4-DPH-38).
  return (
    <Dialog
      open={Boolean(isOpen)}
      onClose={onClose}
      size="lg"
      flush
      title="Select Header Icon"
      description={<>Choose a vector icon for <strong>{fieldLabel || fieldKey}</strong></>}
      footer={(
        <>
          {currentCustomIcon ? (
            <button
              type="button"
              onClick={() => {
                onClearIcon();
                onClose();
              }}
              className="mr-auto inline-flex shrink-0 items-center gap-1 whitespace-nowrap px-2.5 py-1.5 text-xs font-medium text-cv-bad hover:bg-cv-bad-soft rounded-cv-control transition-colors cursor-pointer"
              title="Reset to default icon"
            >
              <RotateCcw size={12} />
              Reset to Default
            </button>
          ) : (
            <span className="mr-auto text-[11px] text-cv-faint">Using default template icon</span>
          )}

          {/* Optional Image Upload Fallback */}
          <label className={buttonClass({ variant: 'secondary', className: 'cursor-pointer' })} title="Upload custom image file">
            <ImagePlus size={14} />
            <span>Upload Image</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) {
                  onPickIconFile(file);
                  onClose();
                }
                e.target.value = '';
              }}
            />
          </label>

          <Button variant="ghost" onClick={onClose}>Close</Button>
        </>
      )}
    >
      {/* Search & Tabs: they stay at the top while the grid scrolls under them. */}
      <div className="sticky top-0 z-10 px-5 pt-4 pb-2 space-y-3 bg-cv-ground border-y border-cv-hairline">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-cv-faint" />
          {/* 16 px on a touch screen: iOS zooms the page into any smaller field it focuses (R4-DPH-30).
              A mouse keeps 12 px. */}
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search icons (e.g. mail, phone, globe, arrow, star)..."
            className="w-full pl-9 pr-3 py-1.5 text-xs pointer-coarse:text-base bg-cv-surface border border-cv-hairline rounded-cv-control focus:outline-none focus:ring-2 focus:ring-cv-brand focus:border-transparent transition-all"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-cv-faint hover:text-cv-muted"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {!search && (
          <div className="flex gap-1.5 p-0.5 bg-cv-sunken rounded-cv-control text-xs font-medium">
            <button
              type="button"
              onClick={() => setActiveTab('recommended')}
              className={`flex-1 py-1 rounded-cv-control transition-all ${
                activeTab === 'recommended'
                  ? 'bg-cv-surface text-cv-brand-text shadow-xs font-semibold'
                  : 'text-cv-muted hover:text-cv-ink'
              }`}
            >
              Recommended ({recommended.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('styles')}
              className={`flex-1 py-1 rounded-cv-control transition-all ${
                activeTab === 'styles'
                  ? 'bg-cv-surface text-cv-brand-text shadow-xs font-semibold'
                  : 'text-cv-muted hover:text-cv-ink'
              }`}
            >
              Style Packs (5)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`flex-1 py-1 rounded-cv-control transition-all ${
                activeTab === 'all'
                  ? 'bg-cv-surface text-cv-brand-text shadow-xs font-semibold'
                  : 'text-cv-muted hover:text-cv-ink'
              }`}
            >
              All Icons ({all.length})
            </button>
          </div>
        )}
      </div>

      {/* Modal Body: Icon Grid */}
      <div className="p-5 space-y-4">
        {activeTab === 'styles' && !search ? (
          <div className="space-y-2">
            <p className="text-[11px] text-cv-muted mb-2">
              Choose a specific visual style pack for this field:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {packVariants.map(pv => {
                const isSelected = currentVal === pv.id;
                const shapes = resolveIconShapes({ custom: pv.id, field: fieldKey });
                return (
                  <button
                    key={pv.id}
                    type="button"
                    onClick={() => handleSelect(pv.id)}
                    className={`flex items-center gap-3 p-2.5 rounded-cv-card border text-left transition-all ${
                      isSelected
                        ? 'border-cv-brand bg-cv-brand-soft ring-2 ring-cv-brand/20'
                        : 'border-cv-hairline hover:border-cv-brand-soft-border hover:bg-cv-ground bg-cv-surface'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-cv-control bg-cv-sunken flex items-center justify-center text-cv-ink shrink-0">
                      <IconPreview shapes={shapes} size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-cv-ink flex items-center justify-between">
                        {pv.label}
                        {isSelected && <Check size={12} className="text-cv-brand-text" />}
                      </p>
                      <p className="text-[10px] text-cv-faint truncate">{pv.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div>
            {filteredIcons.length === 0 ? (
              <div className="py-12 text-center text-cv-faint">
                <p className="text-xs font-medium">No icons match &quot;{search}&quot;</p>
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="mt-2 text-xs text-cv-brand-text hover:underline"
                >
                  Clear search
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
                {filteredIcons.map(item => {
                  const iconVal = `icon:${item.id}`;
                  const isSelected = currentVal === iconVal || currentVal === item.id;
                  const shapes = resolveIconShapes({ custom: iconVal, field: fieldKey });
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelect(iconVal)}
                      className={`flex flex-col items-center justify-center p-2.5 rounded-cv-card border text-center transition-all cursor-pointer group ${
                        isSelected
                          ? 'border-cv-brand bg-cv-brand-soft text-cv-brand-text ring-2 ring-cv-brand/20 shadow-xs'
                          : 'border-cv-hairline hover:border-cv-brand-soft-border hover:bg-cv-brand-soft text-cv-ink bg-cv-surface'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-cv-control flex items-center justify-center transition-colors mb-1.5 ${
                        isSelected ? 'text-cv-brand-text' : 'text-cv-muted group-hover:text-cv-brand-pressed'
                      }`}>
                        <IconPreview shapes={shapes} size={20} />
                      </div>
                      <span className="text-[10px] font-medium leading-tight truncate w-full px-1">
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}
