import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Avatar, Button, TabPanel, Tabs, cx, isImeKey, useConfirmOptional, useHotkeys } from '@/components/ui';
import { describeActivity } from '@/utils/issueHistory';
import { formatDateTime, relativeTime } from '@/utils/uiFormat';

const WHO = 'You';

/** A moment as "3h ago", its full date and time on hover. */
function When({ at }) {
  return <time dateTime={new Date(at).toISOString()} title={formatDateTime(at)} className="text-[12px] text-ink-subtlest">{relativeTime(at)}</time>;
}

/** The box a comment is written in: a one-line prompt until focused, then a field with Save / Cancel. */
function Composer({ initial = '', onSave, onCancel, autoFocus = false, saveLabel = 'Save' }) {
  const [text, setText] = useState(initial);
  const [open, setOpen] = useState(autoFocus || !!initial);
  const save = () => {
    const t = text.trim();
    if (!t) return;
    onSave(t);
    setText('');
    setOpen(!!initial);
  };
  const cancel = () => { setText(initial); setOpen(false); onCancel?.(); };
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-10 w-full rounded border border-line bg-white px-3 text-left text-sm text-ink-subtlest transition-colors hover:bg-hovered focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
      >
        Add a comment…
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <textarea
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
        className="w-full resize-y rounded border border-brand bg-white px-3 py-2 text-sm text-ink ring-1 ring-brand focus:outline-none"
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
          <span className="text-sm font-semibold text-ink">{WHO}</span>
          <When at={comment.createdAt} />
          {comment.editedAt && <span className="text-[12px] text-ink-subtlest">(edited)</span>}
        </p>
        {editing ? (
          <div className="mt-1">
            <Composer initial={comment.text} autoFocus onSave={(t) => { onUpdate(t); setEditing(false); }} onCancel={() => setEditing(false)} />
          </div>
        ) : (
          <>
            <p className="mt-1 text-sm whitespace-pre-wrap break-words text-ink">{comment.text}</p>
            <div className="mt-1 flex gap-3 text-[12px] font-medium text-ink-subtle">
              <button type="button" className="hover:text-ink hover:underline" onClick={() => setEditing(true)}>Edit</button>
              <button
                type="button"
                className="hover:text-ink hover:underline"
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
      <div className="min-w-0 flex-1 text-sm text-ink">
        <p><span className="font-semibold">{WHO}</span> {d.text} <When at={entry.at} /></p>
        {d.from !== null && (
          <p className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-ink-subtle">
            <span className="max-w-full truncate rounded-[3px] bg-neutral-fill px-1.5 line-through decoration-ink-subtlest">{d.from}</span>
            <ArrowRight size={14} aria-hidden="true" className="shrink-0" />
            <span className="max-w-full truncate rounded-[3px] bg-brand-subtle px-1.5 text-ink">{d.to}</span>
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
  useHotkeys({ m: () => setComposeKey((k) => k + 1) });
  const comments = [...(issue.comments ?? [])].reverse();
  const history = [...(issue.activity ?? [])].filter((a) => a.kind !== 'comment').reverse();
  const rows = tab === 'history' ? history.map((h) => ({ kind: 'history', at: h.at, h }))
    : tab === 'comments' ? comments.map((c) => ({ kind: 'comment', at: c.createdAt, c }))
      : [...comments.map((c) => ({ kind: 'comment', at: c.createdAt, c })), ...history.map((h) => ({ kind: 'history', at: h.at, h }))].sort((a, b) => b.at - a.at);

  return (
    <section aria-labelledby="issue-activity-heading" className="flex flex-col gap-3">
      <h3 id="issue-activity-heading" className="text-sm font-semibold text-ink">Activity</h3>
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
      {tab !== 'history' && (
        <div className="flex gap-3">
          <Avatar name={WHO} size="md" decorative />
          <div className="min-w-0 flex-1">
            <Composer key={composeKey} autoFocus={composeKey > 0} onSave={onAddComment} />
            <p className="mt-1.5 text-[12px] text-ink-subtlest"><span className="font-semibold">Pro tip:</span> press <kbd className="rounded border border-line px-1">M</kbd> to comment</p>
          </div>
        </div>
      )}
      <ul className={cx('flex flex-col gap-5', rows.length === 0 && 'hidden')}>
        {rows.map((r) => (r.kind === 'comment'
          ? <Comment key={`c-${r.c.id}`} comment={r.c} onUpdate={(t) => onUpdateComment(r.c.id, t)} onDelete={() => onDeleteComment(r.c.id)} />
          : <HistoryEntry key={`h-${r.h.id}`} entry={r.h} />))}
      </ul>
      {rows.length === 0 && (
        <p className="text-sm text-ink-subtlest">{tab === 'history' ? 'No changes yet.' : 'No comments yet.'}</p>
      )}
      </TabPanel>
    </section>
  );
}
