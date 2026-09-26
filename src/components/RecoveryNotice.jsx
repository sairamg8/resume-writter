import { useState } from 'react';
import { downloadBlob } from '@/utils/download';
import { readBackup } from '@/utils/storageBackup';

/**
 * The notice for a saved list that could not be read in full (utils/storageBackup.js
 * loadSavedList): the résumés on the dashboard, the job list in the tracker. `what` names the
 * list; `recovery.backupKey` is where the original was copied, null when storage was too full;
 * `recovery.earlier` the copies of repairs made before this one while the notice was up (R8-10).
 * "Download the copy" saves that original as a file — the key alone only helped someone who
 * knows DevTools (R4-8). Storage that fills up later removes backups to save new changes, so the
 * notice checks each copy is still there, and says so for one that is gone.
 */
export function RecoveryNotice({ what, recovery, onDismiss }) {
  const [, setChecked] = useState(0);
  const { backupKey } = recovery;
  const kept = backupKey !== null && readBackup(backupKey) !== null;
  const earlier = (recovery.earlier || []).filter((k) => readBackup(k) !== null);
  // Earlier copies removed since (BACKUPS_KEPT, or to make room): said, not left out (V2W1a-9).
  const pruned = (recovery.earlier || []).length - earlier.length;

  function download(key) {
    const raw = readBackup(key);
    if (raw === null) {
      setChecked(n => n + 1); // it was removed meanwhile: say so
      return;
    }
    downloadBlob(new Blob([raw], { type: 'application/json' }), `${key}.json`);
  }

  let copy = 'Browser storage is full, so no copy of the original could be kept.';
  if (kept) copy = <>A copy of the original is kept in this browser's local storage under “{backupKey}”.</>;
  else if (backupKey) copy = <>The copy of the original kept under “{backupKey}” was later removed to make room for your changes.</>;
  const earlierCopy = earlier.length > 0 && (
    <> It was repaired before too: {earlier.length === 1 ? 'that copy is' : 'those copies are'} kept under {earlier.map((k) => `“${k}”`).join(', ')}.</>
  );
  const prunedCopy = pruned > 0 && (
    <> {pruned === 1 ? 'An earlier copy was' : `${pruned} earlier copies were`} later removed to make room.</>
  );
  const earlierLabel = (i) => (earlier.length === 1 ? 'Download the earlier copy' : `Download earlier copy ${i + 1}`);

  // On a phone the message is on top and the buttons wrap in a row below it: beside it, the
  // unbreakable buttons squeezed the message into a column a few words wide, and the row overflowed
  // (J-39). From sm up they sit beside it again, in at most half the row, wrapping there too. The
  // backup key is one long word: it may break.
  return (
    <p role="alert" className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex flex-col gap-2 sm:flex-row sm:items-start">
      <span className="min-w-0 sm:flex-1 [overflow-wrap:anywhere]">
        Your saved {what} could not be read in full, so what could not be read was left out.{' '}
        {copy}
        {earlierCopy}
        {prunedCopy}
      </span>
      <span className="flex flex-wrap gap-x-3 gap-y-1 sm:max-w-[50%] sm:justify-end">
        {kept && (
          <button type="button" onClick={() => download(backupKey)} className="font-semibold hover:text-red-800 whitespace-nowrap">Download the copy</button>
        )}
        {earlier.map((k, i) => (
          <button key={k} type="button" onClick={() => download(k)} className="font-semibold hover:text-red-800 whitespace-nowrap">{earlierLabel(i)}</button>
        ))}
        <button type="button" onClick={onDismiss} className="font-semibold hover:text-red-800">Dismiss</button>
      </span>
    </p>
  );
}
