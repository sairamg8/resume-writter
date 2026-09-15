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
 * notice checks each copy is still there.
 */
export function RecoveryNotice({ what, recovery, onDismiss }) {
  const [, setChecked] = useState(0);
  const { backupKey } = recovery;
  const kept = backupKey !== null && readBackup(backupKey) !== null;
  const earlier = (recovery.earlier || []).filter((k) => readBackup(k) !== null);

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
  const earlierLabel = (i) => (earlier.length === 1 ? 'Download the earlier copy' : `Download earlier copy ${i + 1}`);

  return (
    <p role="alert" className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-start gap-2">
      <span className="flex-1">
        Your saved {what} could not be read in full, so what could not be read was left out.{' '}
        {copy}
        {earlierCopy}
      </span>
      {kept && (
        <button onClick={() => download(backupKey)} className="font-semibold hover:text-red-800 whitespace-nowrap">Download the copy</button>
      )}
      {earlier.map((k, i) => (
        <button key={k} onClick={() => download(k)} className="font-semibold hover:text-red-800 whitespace-nowrap">{earlierLabel(i)}</button>
      ))}
      <button onClick={onDismiss} className="font-semibold hover:text-red-800">Dismiss</button>
    </p>
  );
}
