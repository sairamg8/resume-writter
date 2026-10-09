import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Avatar, Button, TabPanel, Tabs, cx, isImeKey, useConfirmOptional, useHotkeys } from '@/components/ui';
import { describeActivity } from '@/utils/issueHistory';
import { formatDateTime, isoTime, relativeTime } from '@/utils/uiFormat';

const WHO = 'You';

/** A moment as "3h ago", its full date and time on hover. */
function When({ at }) {
  return <time dateTime={isoTime(at)} title={formatDateTime(at)} className="text-[12px] text-cv-faint">{relativeTime(at)}</time>;
}

/**
 * The box a comment is written in: a one-line prompt until focused, then a field with Save / Cancel.
 * Each new `summon` (the `m` shortcut) opens it, or goes back to it with what is typed kept. Text
 * left in it is saved when it goes (the view closes, another issue opens), as the description's
 * draft is: it used to vanish without a word.
 */
function Composer({ initial = '', onSave, onCancel, autoFocus = false, saveLabel = 'Save', summon = 0 }) {
  const [text, setText] = useState(initial);
  const [open, setOpen] = useState(autoFocus || !!initial);
  const fieldRef = useRef(null);
  // What is typed and this issue's save, as last rendered, for the unmount below; Save and Cancel
  // clear it at once, as the box can go in the same render (an edited comment's box does).
  const left = useRef({ text: '', onSave });
  useLayoutEffect(() => {
    left.current = { text: text.trim() !== initial.trim() ? text.trim() : '', onSave };
  });
  useEffect(() => () => {
    const { text: t, onSave: keep } = left.current;
    if (t) keep(t);
  }, []);
  // Only a summon made while it is mounted opens it (it stays mounted on the History tab, hidden).
  const [summoned, setSummoned] = useState(summon);
  if (summon !== summoned) {
    setSummoned(summon);
    setOpen(true);
  }
  // A closed box opens with its field focused (autoFocus); an open one gets the focus back here.
  useEffect(() => {
    if (summon) fieldRef.current?.focus();
  }, [summon]);
  const save = () => {
    const t = text.trim();
    if (!t) return;
    left.current.text = '';
    onSave(t);
    setText('');
    setOpen(!!initial);
  };
  const cancel = () => { left.current.text = ''; setText(initial); setOpen(false); onCancel?.(); };
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-10 w-full rounded-cv-control border border-cv-hairline bg-cv-surface px-3 text-left text-sm text-cv-faint transition-colors hover:bg-cv-stage focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cv-brand/60"
      >
        Add a comment…
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <textarea
        ref={fieldRef}
        autoFocus
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (isImeKey(e)) return; // the input method's Enter or Escape, not the comment's
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); save(); }
          if (e.key === 'Escape') { e.stopPropagation(); cancel(); }
        }}
        aria-label="Comment"
        placeholder="Add a comment…"
        // 16 px on touch screens: iOS Safari zooms the page into any smaller field it focuses (R4-DPH-11).
        className="w-full resize-y rounded-cv-control border border-cv-brand bg-cv-surface px-3 py-2 text-sm text-cv-ink ring-1 ring-cv-brand focus:outline-none pointer-coarse:text-base"
      />
      <div className="flex gap-2">
        <Button variant="primary" size="sm" onClick={save} disabled={!text.trim()}>{saveLabel}</Button>
        <Button variant="ghost" size="sm" onClick={cancel}>Cancel</Button>
      </div>
    </div>
  );
}

function Comment({ comment, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const confirm = useConfirmOptional();
  return (
    <li className="flex gap-3">
      <Avatar name={WHO} size="md" decorative />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-sm font-semibold text-cv-ink">{WHO}</span>
          <When at={comment.createdAt} />
          {comment.editedAt && <span className="text-[12px] text-cv-faint">(edited)</span>}
        </p>
        {editing ? (
          <div className="mt-1">
            <Composer initial={comment.text} autoFocus onSave={(t) => { onUpdate(t); setEditing(false); }} onCancel={() => setEditing(false)} />
          </div>
        ) : (
          <>
            <p className="mt-1 text-sm whitespace-pre-wrap break-words text-cv-ink">{comment.text}</p>
            <div className="mt-1 flex gap-3 text-[12px] font-medium text-cv-muted">
              <button type="button" className="hover:text-cv-ink hover:underline" onClick={() => setEditing(true)}>Edit</button>
              <button
                type="button"
                className="hover:text-cv-ink hover:underline"
                onClick={async () => { if (await confirm({ title: 'Delete this comment?', body: 'Once it is deleted, it is gone for good.', confirmLabel: 'Delete', tone: 'danger' })) onDelete(); }}
              >
                Delete
              </button>
            </div>
          </>
        )}
      </div>
    </li>
  );
}

function HistoryEntry({ entry }) {
  const d = describeActivity(entry);
  if (!d) return null;
  return (
    <li className="flex gap-3">
      <Avatar name={WHO} size="md" decorative />
      <div className="min-w-0 flex-1 text-sm text-cv-ink">
        <p><span className="font-semibold">{WHO}</span> {d.text} <When at={entry.at} /></p>
        {d.from !== null && (
          <p className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-cv-muted">
            <span className="max-w-full truncate rounded-[3px] bg-cv-sunken px-1.5 line-through decoration-ink-subtlest">{d.from}</span>
            <ArrowRight size={14} aria-hidden="true" className="shrink-0" />
            <span className="max-w-full truncate rounded-[3px] bg-cv-brand-soft px-1.5 text-cv-ink">{d.to}</span>
          </p>
        )}
      </div>
    </li>
  );
}

/**
 * The issue's Activity: All | Comments | History (newest first), and the comment box on top —
 * `m` jumps to it. Comments are plain text; the history lists what issueHistory describes.
 */
export function IssueActivity({ issue, onAddComment, onUpdateComment, onDeleteComment }) {
  const [tab, setTab] = useState('comments');
  const [composeKey, setComposeKey] = useState(0);
  const sectionRef = useRef(null);
  // The issue view is a modal dialog, where the page's shortcuts sleep: `m` is the view's own. It
  // acts only while the view is the top dialog: under a confirm or the Create dialog opened from
  // the view, the comment box opened behind them and took the focus out of the one on top.
  useHotkeys({
    m: (event) => {
      const modals = document.querySelectorAll('[aria-modal="true"]');
      if (!modals[modals.length - 1]?.contains(sectionRef.current)) return;
      // Nor from a popover over the view (the Labels picker's buttons): the box's focus would close it.
      const layer = event?.target?.closest?.('[data-ui-portal]');
      if (layer && !layer.contains(sectionRef.current)) return;
      // The History tab has no comment box: M goes to Comments, where it is.
      setTab((t) => (t === 'history' ? 'comments' : t));
      setComposeKey((k) => k + 1);
    },
  }, { allowInDialog: true });
  const comments = [...(issue.comments ?? [])].reverse();
  const history = [...(issue.activity ?? [])].filter((a) => a.kind !== 'comment').reverse();
  const rows = tab === 'history' ? history.map((h) => ({ kind: 'history', at: h.at, h }))
    : tab === 'comments' ? comments.map((c) => ({ kind: 'comment', at: c.createdAt, c }))
      : [...comments.map((c) => ({ kind: 'comment', at: c.createdAt, c })), ...history.map((h) => ({ kind: 'history', at: h.at, h }))].sort((a, b) => b.at - a.at);

  return (
    <section ref={sectionRef} aria-labelledby="issue-activity-heading" className="flex flex-col gap-3">
      <h3 id="issue-activity-heading" className="text-sm font-semibold text-cv-ink">Activity</h3>
      <Tabs
        id="issue-activity"
        aria-label="Activity"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'all', label: 'All' },
          { value: 'comments', label: 'Comments', count: comments.length || null },
          { value: 'history', label: 'History' },
        ]}
      />
      <TabPanel tabsId="issue-activity" value={tab} current={tab} className="flex flex-col gap-5">
      {/* Hidden, not unmounted, on the History tab: a comment being typed stays, and coming back
          to Comments does not count an old M again. */}
      <div className={cx('flex gap-3', tab === 'history' && 'hidden')}>
        <Avatar name={WHO} size="md" decorative />
        <div className="min-w-0 flex-1">
          {/* Summoned, not re-keyed: a new key threw away a comment being typed. */}
          <Composer summon={composeKey} onSave={onAddComment} />
          <p className="mt-1.5 text-[12px] text-cv-faint"><span className="font-semibold">Pro tip:</span> press <kbd className="rounded-cv-control border border-cv-hairline px-1">M</kbd> to comment</p>
        </div>
      </div>
      <ul className={cx('flex flex-col gap-5', rows.length === 0 && 'hidden')}>
        {rows.map((r) => (r.kind === 'comment'
          ? <Comment key={`c-${r.c.id}`} comment={r.c} onUpdate={(t) => onUpdateComment(r.c.id, t)} onDelete={() => onDeleteComment(r.c.id)} />
          : <HistoryEntry key={`h-${r.h.id}`} entry={r.h} />))}
      </ul>
      {rows.length === 0 && (
        <p className="text-sm text-cv-faint">{tab === 'history' ? 'No changes yet.' : 'No comments yet.'}</p>
      )}
      </TabPanel>
    </section>
  );
}
