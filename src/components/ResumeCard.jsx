import { useEffect, useId, useLayoutEffect, useMemo, useState } from 'react';
import { Edit2, Check, MoreHorizontal, Pin } from 'lucide-react';
import { timeAgo } from '@/utils/resume';
import { isOriginal } from '@/utils/demoSeed';
import { useRename } from '@/hooks/useRename';

import { templateLabel } from '@/constants/templates';
import ResumeThumbnail from '@/components/ResumeThumbnail';
import { usePicture } from '@/hooks/usePicture';
import { isLetter } from '@/utils/letters';
import { printHash, savedPicture, savePicture } from '@/utils/pageImageStore';
import { isImeKey } from '@/components/ui/compose';
import { Lazy, warm } from '@/components/lazyPiece';
import { KEEP_HINT, LAST_ORIGINAL_HINT } from '@/constants/cardHints';


// The endings Copy (useResumeStore's duplicate) and a sync conflict (cloudSyncLineage) add to a name.
const COPY_ENDINGS = [' (Copy)', ' (conflict copy)'];
/**
 * Where `name`'s run of copy endings starts, or -1 for none. They are taken off its end one at a time: the pattern for
 * it, /(?: \((?:Copy|conflict copy)\))+$/, was tried from each ending of a name with 50 000 of them and some other text
 * at its end, and read each one's run again (time squared; a name can be any first line of an imported file).
 */
function copyEndingAt(name) {
  let start = -1;
  for (let end = name.length; end > 0;) {
    const ending = COPY_ENDINGS.find((e) => name.endsWith(e, end));
    if (!ending) break;
    end -= ending.length;
    start = end;
  }
  return start;
}
// Three or more of one ending in a row show as one with a count, so pressing Copy on the newest copy
// again and again never grows the ending across the card (R4-DVIS-28).
const RUN_AS_COUNT = 3;

/**
 * `name` as its base and its copy ending (' (Copy)', ' (Copy) (Copy)', ' (conflict copy)'), or no
 * ending. A run of RUN_AS_COUNT or more of one ending reads ' (Copy ×4)'; the title keeps the full name.
 */
function splitName(name = '') {
  const at = copyEndingAt(name);
  if (at <= 0) return { base: name, suffix: '' };
  const runs = [];
  for (const [, kind] of name.slice(at).matchAll(/ \(([^)]+)\)/g)) {
    const last = runs.at(-1);
    if (last?.kind === kind) last.count += 1;
    else runs.push({ kind, count: 1 });
  }
  const suffix = runs
    .map(({ kind, count }) => (count >= RUN_AS_COUNT ? ` (${kind} ×${count})` : ` (${kind})`.repeat(count)))
    .join('');
  return { base: name.slice(0, at), suffix };
}

/**
 * Whether the name's copy ending must stand apart from its clamped base, and the ref for the name's
 * <p>. While the whole name fits in two lines it is one run of text, so the ending sits right after
 * the last word; once it runs past them the ending would be cut, so it is split off beside the base's
 * last line (R4-DVIS-28). The one-run layout is measured before paint, and again when the name or its
 * width changes.
 */
function useSplitEnding(name, hasEnding) {
  const [el, setEl] = useState(null); // the name's <p>: a new one each time Rename closes
  const [measured, setMeasured] = useState(null); // { name, width, split }, from the one-run layout
  const [width, setWidth] = useState(null); // the name's width, as a ResizeObserver last saw it
  const stale = !measured || measured.name !== name || (width !== null && width !== measured.width);
  useLayoutEffect(() => {
    if (!hasEnding || !el || !stale) return;
    // The width measured here is the width from now on too: the observer may have missed a change
    // (it is off while Rename is open, or while the name has no ending), and a `width` left behind
    // would call every new measurement stale, measuring over and over until React gives up.
    const now = el.clientWidth;
    setWidth(now);
    setMeasured({ name, width: now, split: el.scrollHeight > el.clientHeight });
  });
  useEffect(() => {
    if (!hasEnding || !el || typeof ResizeObserver !== 'function') return undefined;
    const observer = new ResizeObserver(() => setWidth(el.clientWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, [el, hasEnding]);
  return [setEl, hasEnding && !stale && measured.split];
}

/**
 * A résumé on the dashboard. `onKeep(id, keep)` — only in a demo account, whose originals come
 * back (useDemoSeed) — adds "Keep as my original" / "Stop keeping" and the "Original" badge.
 * `lastOriginal`: deleted, it would come straight back (demoSeed.comesStraightBack), so Delete is
 * disabled and the card says why (V2OWNER-DATA-4).
 */
export function ResumeCard({ resume, onOpen, onDuplicate, onDelete, onRename, onKeep, lastOriginal = false }) {
  const rename = useRename(resume, (name) => onRename(resume.id, name));
  const hintId = useId();
  const name = splitName(resume.name);
  const [nameRef, split] = useSplitEnding(resume.name, Boolean(name.suffix));
  const accent = resume.settings?.accentColor || '#2563eb';
  // Its real page 1 (C1) — a letter's, for a letter — painted once the card is on screen and kept
  // until the résumé prints differently (printHash): the drawn page shows until then.
  const hash = useMemo(() => printHash(resume), [resume]);
  const letter = isLetter(resume);
  const original = isOriginal(resume);
  // The more menu's open state is the card's: a press made while its code is still on the way opens it on arrival.
  const [menuOpen, setMenuOpen] = useState(false);
  const [pictureRef, picture] = usePicture(
    `resume:${resume.id}:${hash}`,
    () => import('@/utils/pageImage').then((m) => m.pageImage(resume, { width: 160, letter })),
    { saved: () => savedPicture(resume.id, hash), onPainted: (url) => savePicture(resume.id, hash, url) },
  );

  // The ⋯ button as the entry draws it: shown until the menu's code has arrived (and it asks for it), then the menu's own.
  const moreButton = (
    <button
      type="button"
      aria-label="More"
      aria-haspopup="menu"
      data-testid="resume-card-more"
      onClick={() => { warm('menu'); setMenuOpen(true); }}
      onMouseEnter={() => warm('menu')}
      onFocus={() => warm('menu')}
      className="inline-flex size-7 shrink-0 items-center justify-center rounded text-cv-muted hover:bg-cv-sunken hover:text-cv-ink transition-colors"
    >
      <MoreHorizontal size={16} />
    </button>
  );
  // The menu's code could not be had (offline, or a deploy replaced it): the card's own plain buttons do what the menu does.
  const plainActions = () => (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] font-medium text-cv-muted">
      <button type="button" onClick={() => onOpen(resume.id)} className="hover:text-cv-ink">Edit</button>
      <button type="button" onClick={() => onDuplicate(resume.id)} className="hover:text-cv-ink">Copy</button>
      {onKeep && (
        <button type="button" onClick={() => onKeep(resume.id, !original)} title={KEEP_HINT} className="hover:text-cv-ink">
          {original ? 'Stop keeping' : 'Keep as my original'}
        </button>
      )}
      <button
        type="button"
        onClick={() => onDelete(resume.id)}
        disabled={lastOriginal}
        title={lastOriginal ? LAST_ORIGINAL_HINT : undefined}
        aria-describedby={lastOriginal ? hintId : undefined}
        className="enabled:hover:text-cv-bad disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Delete
      </button>
    </span>
  );

  return (
    <div data-testid="resume-card" className="group cv-card overflow-hidden flex flex-col hover:shadow-md transition-shadow">
      {/* Thumbnail: the page on a sunken stage. A press anywhere on it opens the document. */}
      <div
        className="h-[172px] sm:h-[260px] bg-cv-sunken flex items-start justify-center pt-3.5 sm:pt-6 relative cursor-pointer overflow-hidden"
        onClick={() => onOpen(resume.id)}
      >
        <div ref={pictureRef} className="w-[118px] sm:w-[148px] flex justify-center">
          {picture ? (
            <img data-page-image="" src={picture} alt="" className="w-full bg-white shadow-md" />
          ) : <ResumeThumbnail resume={resume} accent={accent} />}
        </div>
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 no-hover:hidden">
          <span className="px-4 py-2 bg-cv-surface rounded-cv-control shadow-md text-sm font-semibold text-cv-ink">Open</span>
        </div>
      </div>

      {/* Name — grows, so every card in a row has its menu at the bottom (the last original's hint is longer) */}
      <div className="px-3.5 sm:px-4 pt-3 pb-3 flex-1 flex flex-col">
        {rename.editing ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              aria-label="Résumé name"
              value={rename.draft}
              onChange={e => rename.setDraft(e.target.value)}
              onBlur={rename.commit}
              onKeyDown={e => {
                if (e.key === 'Enter' && !isImeKey(e)) rename.commit();
                if (e.key === 'Escape' && !isImeKey(e)) rename.cancel();
              }}
              // 16 px on a touch screen, as the kit's fields are (R4-DPH-26): under that iOS zooms the page on focus.
              className="flex-1 min-w-0 text-sm pointer-coarse:text-base font-semibold text-cv-ink border-b border-cv-brand outline-none bg-transparent"
            />
            <button onClick={rename.commit} aria-label="Save name" className="p-0.5 text-cv-brand-text"><Check size={13} /></button>
          </div>
        ) : (
          <div className="flex items-start gap-1 group/name">
            {/* Up to two lines, and a copy's "(Copy)" never cut: a touch screen has no hover to show the
                title, so a long name and its copy must differ on the card itself (R4-DVIS-28). A name
                that fits in two lines is one run of text, its ending right after the last word. A longer
                one clamps only its base, and the ending stands beside the base's last line (items-end),
                taking at most half the row and wrapping between endings, so the base keeps room. */}
            {split ? (
              <p ref={nameRef} title={resume.name} className="flex-1 min-w-0 flex items-end text-sm sm:text-[15px] font-semibold text-cv-ink">
                <span className="line-clamp-2 break-words min-w-0">{name.base}</span>
                <span className="shrink-0 max-w-1/2 whitespace-pre-wrap">{name.suffix}</span>
              </p>
            ) : (
              <p ref={nameRef} title={resume.name} className="flex-1 min-w-0 line-clamp-2 break-words text-sm sm:text-[15px] font-semibold text-cv-ink">
                <span>{name.base}</span>{name.suffix && <span>{name.suffix}</span>}
              </p>
            )}
            <button
              onClick={rename.start}
              title="Rename"
              data-testid="resume-card-rename"
              aria-label="Rename"
              className="opacity-0 group-hover/name:opacity-100 no-hover:opacity-100 mt-0.5 p-0.5 text-cv-faint hover:text-cv-ink transition-opacity shrink-0"
            >
              <Edit2 size={11} />
            </button>
          </div>
        )}
        {onKeep && original && (
          <span title={KEEP_HINT} className="mt-1.5 self-start inline-flex items-center gap-1 text-[11px] font-semibold text-cv-warn bg-cv-warn-soft rounded-full px-2 py-0.5">
            <Pin size={10} aria-hidden="true" /> Original
          </span>
        )}
        {lastOriginal && <p id={hintId} className="mt-1 text-[11px] leading-snug text-cv-muted">{LAST_ORIGINAL_HINT}</p>}
        {/* The template's name as the editor shows it: an id the app does not offer opens as Classic (R2-133). */}
        <div className="mt-auto pt-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <p className="text-xs sm:text-[13px] text-cv-muted min-w-0">
            {/* A record with no edit time (an older or hand-edited one) shows no age, not "NaNd ago". */}
            {templateLabel(resume.template)}{Number.isFinite(resume.updatedAt) && ` · ${timeAgo(resume.updatedAt)}`}
          </p>
          <Lazy
            load="menu"
            pending={moreButton}
            fallback={plainActions}
            resume={resume}
            original={original}
            lastOriginal={lastOriginal}
            onOpen={onOpen}
            onDuplicate={onDuplicate}
            onDelete={onDelete}
            onRename={rename.start}
            onKeep={onKeep}
            open={menuOpen}
            onOpenChange={setMenuOpen}
          />
        </div>
      </div>
    </div>
  );
}
