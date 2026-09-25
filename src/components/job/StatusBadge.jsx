import { STATUS_MAP } from '@/constants/jobs';
import { Lozenge } from '@/components/tracker/Lozenge';
import { jobTone } from './jobTone';

/** A job's status as a lozenge ("INTERVIEW"), coloured by where it is in the pipeline. */
export function StatusBadge({ statusId }) {
  const s = STATUS_MAP[statusId] || STATUS_MAP.saved;
  return <Lozenge tone={jobTone(s.id)}>{s.label}</Lozenge>;
}
