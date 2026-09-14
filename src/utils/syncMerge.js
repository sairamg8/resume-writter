// The cloud sync's merge of this browser's résumés with the account's. Plain data in and out (no
// Firebase), so tests run it directly.
import { normalizeResume } from '@/utils/normalizeResume';

/**
 * Merge local + cloud résumés: the newer `updatedAt` wins (this browser's copy on a tie) and
 * deleted ids are left out. Everything returned has been through normalizeResume(), so a copy
 * an older build saved to the cloud is made current before the sync writes it back and loads it
 * into the store.
 */
export function mergeResumeLists(local, cloud, deletedIds) {
  const byId = {};
  for (const r of cloud) {
    if (!deletedIds.has(r.id)) byId[r.id] = r;
  }
  for (const r of local) {
    if (deletedIds.has(r.id)) continue;
    if (!byId[r.id] || r.updatedAt >= byId[r.id].updatedAt) byId[r.id] = r;
  }
  return Object.values(byId).map(normalizeResume);
}
