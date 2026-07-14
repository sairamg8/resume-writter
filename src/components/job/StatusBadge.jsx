import { STATUS_MAP } from '@/constants/jobs';

export function StatusBadge({ statusId }) {
  const s = STATUS_MAP[statusId] || STATUS_MAP.saved;
  return (
    <span
      className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full"
      style={{ color: s.text, backgroundColor: s.bg, border: `1px solid ${s.color}40` }}
    >
      {s.label}
    </span>
  );
}
