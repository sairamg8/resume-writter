import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckSquare, Copy, Link2, ListPlus, MoreHorizontal, Trash2, X } from 'lucide-react';
import { useBoardStore } from '@/hooks/useBoardStore';
import { Button, Dialog, IconButton, InlineEdit, Menu, useConfirmOptional, useToast } from '@/components/ui';
import { useWorkspace } from '@/components/shell';
import RichTextEditor from '@/components/RichTextEditor';
import { IssueTypeIcon, PriorityIcon } from '@/components/tracker/TrackerIcons';
import { Lozenge, StatusMenu } from '@/components/tracker/Lozenge';
import { childrenOf } from '@/utils/boardQuery';
import { hasRichText, sanitizeRichText } from '@/utils/richText';
import { copyText } from '@/utils/clipboard';
import { issueById, issueKey, statusColumn } from '@/utils/boardModel';
import { IssueChecklist } from './IssueChecklist';
import { IssueActivity } from './IssueActivity';
import { IssueDetails } from './IssueDetails';
import { AddButton } from './IssueFields';

/** The description: its rich text, click to edit — an editor with Save / Cancel. */
function Description({ value, onSave }) {
  const [draft, setDraft] = useState(null);
  if (draft !== null) {
    return (
      <div className="flex flex-col gap-2">
        <RichTextEditor ariaLabel="Description" value={draft} onChange={setDraft} placeholder="Add a description…" rows={6} />
        <div className="flex gap-2">
          <Button variant="primary" size="sm" onClick={() => { onSave(draft); setDraft(null); }}>Save</Button>
          <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>Cancel</Button>
        </div>
      </div>
    );
  }
  const empty = !hasRichText(value || '');
  return (
    <button
      type="button"
      onClick={() => setDraft(value || '')}
      aria-label="Edit description"
      className="-mx-2 w-[calc(100%+1rem)] rounded px-2 py-1.5 text-left transition-colors hover:bg-hovered focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
    >
      {empty
        ? <span className="text-sm text-ink-subtlest">Add a description…</span>
        : <span className="rich-text block text-sm leading-6 text-ink [&_a]:text-brand [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5" dangerouslySetInnerHTML={{ __html: sanitizeRichText(value) }} />}
    </button>
  );
}

/** An epic's child issues: a row each (type, key, summary, priority, status), and "Add child issue". */
function ChildIssues({ board, epic, onOpen, onAdd }) {
  const children = childrenOf(board, epic.id);
  const done = children.filter((c) => statusColumn(board, c)?.category === 'done').length;
  return (
    <section aria-labelledby="issue-children-heading" className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <h3 id="issue-children-heading" className="text-sm font-semibold text-ink">Child issues</h3>
        {children.length > 0 && <span className="text-[12px] text-ink-subtlest">{done} of {children.length} done</span>}
        <AddButton onClick={onAdd} aria-label="Add a child issue">Add</AddButton>
      </div>
      {children.length > 0 ? (
        <ul className="divide-y divide-line-subtle rounded-md border border-line">
          {children.map((c) => {
            const col = statusColumn(board, c);
            return (
              <li key={c.id}>
                <button type="button" onClick={() => onOpen(issueKey(board, c))} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-hovered focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500/60">
                  <IssueTypeIcon type={c.type} />
                  <span className={col?.category === 'done' ? 'shrink-0 text-ink-subtlest line-through' : 'shrink-0 text-ink-subtle'}>{issueKey(board, c)}</span>
                  <span className="min-w-0 flex-1 truncate text-ink">{c.title}</span>
                  <PriorityIcon priority={c.priority} />
                  <Lozenge tone={col?.category}>{col?.title}</Lozenge>
                </button>
              </li>
            );
          })}
        </ul>
      ) : <p className="text-sm text-ink-subtlest">No child issues yet.</p>}
    </section>
  );
}

/**
 * One issue, as the tracker opens it over the board: the project › epic › key trail, the summary
 * (click to rename), the description, the checklist, an epic's child issues and the Activity
 * (comments, history) on the left; the status, the Details box and the dates on the right.
 * Every change goes straight to the store. `onOpenIssue(key)` opens another (a child, the epic).
 */
export function IssueDialog({ board, issueId, onClose, onOpenIssue }) {
  const store = useBoardStore();
  const workspace = useWorkspace();
  const confirm = useConfirmOptional();
  const { toast } = useToast();
  const [checklistOpen, setChecklistOpen] = useState(false);
  const issue = board ? issueById(board, issueId) : null;
  if (!board || !issue) return null;

  const key = issueKey(board, issue);
  const epic = issue.epicId ? issueById(board, issue.epicId) : null;
  const column = statusColumn(board, issue);
  const update = (patch) => store.updateIssue(board.id, issue.id, patch);
  const link = () => `${window.location.origin}${window.location.pathname}#/boards/${encodeURIComponent(board.id)}?issue=${encodeURIComponent(key)}`;

  async function remove() {
    const ok = await confirm({
      title: `Delete ${key}?`,
      body: `“${issue.title}” will be deleted${issue.type === 'epic' ? ', and its child issues will leave the epic' : ''}. You can undo this for a few seconds.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    const removed = store.deleteIssue(board.id, issue.id);
    onClose();
    if (removed) toast({ title: `${key} deleted`, action: { label: 'Undo', onClick: () => store.restoreIssue(board.id, removed) } });
  }

  function duplicate() {
    const copy = store.duplicateIssue(board.id, issue.id);
    if (copy) {
      const copyKey = issueKey(board, copy);
      toast({ tone: 'success', title: `${copyKey} created`, description: 'A copy of this issue.', action: { label: 'Open', onClick: () => onOpenIssue(copyKey) } });
    }
  }

  const statuses = board.columns.map((c) => ({ id: c.id, name: c.title || 'Untitled', category: c.category }));

  return (
    <Dialog open onClose={onClose} aria-label={`${key} ${issue.title}`} size="wide" hideClose flush>
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-line bg-white px-4 py-2.5 sm:px-6">
        <nav aria-label="Issue" className="flex min-w-0 flex-1 items-center gap-1.5 text-sm text-ink-subtle">
          <Link to={`/boards/${encodeURIComponent(board.id)}`} onClick={onClose} className="flex min-w-0 items-center gap-1.5 rounded px-1 hover:underline">
            <span aria-hidden="true" className="size-4 shrink-0 rounded-[3px]" style={{ backgroundColor: board.color }} />
            <span className="truncate">{board.title}</span>
          </Link>
          {epic && (
            <>
              <span aria-hidden="true">/</span>
              <button type="button" onClick={() => onOpenIssue(issueKey(board, epic))} className="flex shrink-0 items-center gap-1.5 rounded px-1 hover:underline">
                <IssueTypeIcon type="epic" size={14} /> {issueKey(board, epic)}
              </button>
            </>
          )}
          <span aria-hidden="true">/</span>
          <span className="flex shrink-0 items-center gap-1.5 px-1 text-ink">
            <IssueTypeIcon type={issue.type} size={14} /> {key}
          </span>
        </nav>
        <IconButton icon={Link2} label="Copy link" onClick={() => copyText(link()).then(() => toast({ title: 'Link copied' }), () => toast({ tone: 'danger', title: 'Could not copy the link' }))} />
        <Menu
          label="Issue actions"
          items={[
            { id: 'dup', label: 'Duplicate', icon: Copy, onSelect: duplicate },
            { type: 'separator' },
            { id: 'del', label: 'Delete', icon: Trash2, danger: true, onSelect: remove },
          ]}
          trigger={<IconButton icon={MoreHorizontal} label="Issue actions" />}
        />
        <IconButton icon={X} label="Close" onClick={onClose} />
      </div>

      <div className="grid gap-8 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          <div className="flex flex-col gap-3">
            <h2 className="text-2xl font-medium leading-8 text-ink">
              {/* break-words wraps a word too long for the line (a pasted URL) at the column's edge;
                  without it the word ran past the summary's box and the issue view scrolled
                  sideways. The box already has the column's width, so nothing else has to shrink. */}
              <InlineEdit value={issue.title} onCommit={(title) => update({ title })} label="Summary" className="break-words text-2xl font-medium" />
            </h2>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" leftIcon={CheckSquare} onClick={() => setChecklistOpen(true)}>Add checklist item</Button>
              {issue.type === 'epic' && (
                <Button size="sm" leftIcon={ListPlus} onClick={() => workspace?.openCreate({ boardId: board.id, epicId: issue.id })}>Add child issue</Button>
              )}
            </div>
          </div>
          <section aria-labelledby="issue-description-heading" className="flex flex-col gap-1.5">
            <h3 id="issue-description-heading" className="text-sm font-semibold text-ink">Description</h3>
            <Description value={issue.description} onSave={(description) => update({ description })} />
          </section>
          {(issue.checklist.length > 0 || checklistOpen) && (
            <IssueChecklist key={checklistOpen ? 'open' : 'closed'} items={issue.checklist} onChange={(checklist) => update({ checklist })} autoFocus={checklistOpen} />
          )}
          {issue.type === 'epic' && (
            <ChildIssues board={board} epic={issue} onOpen={onOpenIssue} onAdd={() => workspace?.openCreate({ boardId: board.id, epicId: issue.id })} />
          )}
          <IssueActivity
            issue={issue}
            onAddComment={(text) => store.addComment(board.id, issue.id, text)}
            onUpdateComment={(id, text) => store.updateComment(board.id, issue.id, id, text)}
            onDeleteComment={(id) => store.deleteComment(board.id, issue.id, id)}
          />
        </div>
        <aside aria-label="Issue details" className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-16 lg:self-start">
          <div className="flex items-center gap-2">
            <StatusMenu value={column?.id} options={statuses} onChange={(columnId) => update({ columnId })} />
            {column?.category === 'done' && <span className="text-[13px] text-loz-done-ink">✓ Done</span>}
          </div>
          <IssueDetails board={board} issue={issue} onChange={update} onCreateLabel={(l) => store.addLabel(board.id, l)} />
        </aside>
      </div>
    </Dialog>
  );
}
