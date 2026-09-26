import { cx } from '../ui/index.js';

// The tracker's small charts, drawn in SVG with the workspace colours: a donut of parts of a
// whole (status categories) and bars of counts (priorities, types). Thin marks, rounded ends, a
// gap between segments; every mark names its value on hover (<title>) and the legend or the axis
// names every mark in text, so colour is never the only signal.

/**
 * A donut: `parts` `[{ id, label, value, color }]`, the total in its middle over `caption`.
 * The legend beside it lists each part with its count and share.
 */
export function Donut({ parts, caption = 'total', size = 160 }) {
  const total = parts.reduce((n, p) => n + p.value, 0);
  const r = size / 2 - 12;
  const c = 2 * Math.PI * r;
  const gap = total && parts.filter((p) => p.value).length > 1 ? 2 : 0;
  let offset = 0;
  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${total} ${caption}: ${parts.map((p) => `${p.value} ${p.label}`).join(', ')}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1f2f4" strokeWidth="18" />
        {total > 0 && parts.map((p) => {
          if (!p.value) return null;
          const len = (p.value / total) * c;
          const seg = (
            <circle
              key={p.id}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={p.color}
              strokeWidth="18"
              strokeDasharray={`${Math.max(len - gap, 0.5)} ${c}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              className="transition-opacity hover:opacity-80"
            >
              <title>{`${p.label}: ${p.value} (${Math.round((p.value / total) * 100)}%)`}</title>
            </circle>
          );
          offset += len;
          return seg;
        })}
        <text x="50%" y="47%" textAnchor="middle" className="fill-ink text-[28px] font-semibold">{total}</text>
        <text x="50%" y="62%" textAnchor="middle" className="fill-ink-subtlest text-[12px]">{caption}</text>
      </svg>
      <ul className="flex flex-col gap-2 text-sm">
        {parts.map((p) => (
          <li key={p.id} className="flex items-center gap-2">
            <span aria-hidden="true" className="size-3 shrink-0 rounded-[3px]" style={{ backgroundColor: p.color }} />
            <span className="text-ink">{p.label}</span>
            <span className="font-semibold text-ink">{p.value}</span>
            <span className="text-ink-subtlest">{total ? `${Math.round((p.value / total) * 100)}%` : ''}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Vertical bars of counts: `bars` `[{ id, label, value, icon }]` over a recessive baseline, each
 * labelled under it (its icon and name) and its count over it. One series: one colour.
 */
export function ColumnBars({ bars, color = '#1d7afc', height = 150, unit = 'issues' }) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <div className="flex flex-col gap-2" role="img" aria-label={bars.map((b) => `${b.label}: ${b.value} ${unit}`).join(', ')}>
      <div className="flex items-end gap-3 border-b border-line" style={{ height }}>
        {bars.map((b) => (
          <div key={b.id} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${b.label}: ${b.value} ${unit}`}>
            <span className="text-[12px] font-semibold text-ink">{b.value}</span>
            <span className="w-full max-w-10 rounded-t" style={{ height: `${(b.value / max) * (height - 24)}px`, minHeight: b.value ? 3 : 0, backgroundColor: color }} />
          </div>
        ))}
      </div>
      <div className="flex gap-3">
        {bars.map((b) => (
          <span key={b.id} className="flex min-w-0 flex-1 flex-col items-center gap-0.5 text-center text-[12px] text-ink-subtle">
            {b.icon}
            <span className="w-full truncate">{b.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Horizontal share bars: `rows` `[{ id, label, share, count, icon }]`, the share in % beside each. */
export function ShareBars({ rows, color = '#1d7afc', className }) {
  return (
    <ul className={cx('flex flex-col gap-3', className)}>
      {rows.map((r) => (
        <li key={r.id} className="grid grid-cols-[8rem_1fr_3rem] items-center gap-3 text-sm" title={`${r.label}: ${r.count} (${r.share}%)`}>
          <span className="flex min-w-0 items-center gap-2 text-ink">{r.icon}<span className="truncate">{r.label}</span></span>
          <span className="h-2 rounded-full bg-hovered">
            <span className="block h-2 rounded-full" style={{ width: `${r.share}%`, minWidth: r.count ? 4 : 0, backgroundColor: color }} />
          </span>
          <span className="text-right text-ink-subtle">{r.share}%</span>
        </li>
      ))}
    </ul>
  );
}
