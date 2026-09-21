import { Check } from 'lucide-react';
import { LABEL_COLORS } from '@/constants/boards';

/**
 * The card's label swatches: tap a colour to add it, tap again to remove it. Labels are matched by
 * colour, so the palette (constants/boards) is the single source of which colours exist.
 */
export function LabelPicker({ labels, onChange }) {
  const current = labels || [];
  const has = (color) => current.some((l) => l.color === color);

  function toggle(c) {
    onChange(has(c.color) ? current.filter((l) => l.color !== c.color) : [...current, { name: c.name, color: c.color }]);
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {LABEL_COLORS.map((c) => (
        <button
          key={c.color}
          onClick={() => toggle(c)}
          title={c.name}
          aria-label={c.name}
          aria-pressed={has(c.color)}
          className="h-7 w-9 rounded-lg flex items-center justify-center transition-transform hover:scale-105"
          style={{ backgroundColor: c.color }}
        >
          {has(c.color) && <Check size={14} className="text-white" />}
        </button>
      ))}
    </div>
  );
}
