import { CheckSquare, MessageSquare, MoreHorizontal } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DatePill, IconButton, Menu, cx } from '@/components/ui';
import { IssueTypeIcon, Points, PriorityIcon } from '@/components/tracker/TrackerIcons';
import { PRIORITIES } from '@/constants/boards';
import { openOnKey } from '@/utils/cardKeys';
import { EpicLozenge, LabelPill } from './IssueFields';

const MAX_LABELS = 2;

/**
 * An issue's card face, as the board shows it: its summary (two lines at most), its labels and
 * epic, and a footer — type, key (struck through once done), due date, checklist and comment
 * counts, story points, priority. Presentational, so it doubles as the drag overlay (`overlay`).
 * `card` is boardView's: the issue with `labels` and `epic` resolved.
 */
export function IssueCardView({ card, issueKey, done = false, overlay = false, menu }) {
  const labels = card.labels ?? [];
  const checklist = card.checklist ?? [];
  const ticked = checklist.filter((c) => c.done).length;
  const comments = card.comments?.length ?? 0;
  return (
    <div
      className={cx(
        'group/card relative flex flex-col gap-2 rounded bg-white p-3 text-left select-none',
        'shadow-[0_1px_1px_#091e4240,0_0_1px_#091e424f] transition-colors',
        overlay ? 'rotate-2 shadow-[0_8px_12px_#091e4226,0_0_1px_#091e424f]' : 'hover:bg-sunken',
      )}
    >
      <p className={cx('pr-6 text-sm leading-5 break-words text-ink line-clamp-3', done && 'text-ink-subtle')}>{card.title || 'Untitled'}</p>
      {(labels.length > 0 || card.epic) && (
        <div className="flex flex-wrap items-center gap-1">
          {card.epic && <EpicLozenge title={card.epic.title} className="max-w-[12rem]" />}
          {labels.slice(0, MAX_LABELS).map((l) => <LabelPill key={l.id} label={l} className="max-w-[9rem]" />)}
          {labels.length > MAX_LABELS && (
            <span className="text-[11px] font-medium text-ink-subtlest" title={labels.slice(MAX_LABELS).map((l) => l.name).join(', ')}>+{labels.length - MAX_LABELS}</span>
          )}
        </div>
      )}
      <div className="flex min-h-5 items-center gap-2">
        <IssueTypeIcon type={card.type} />
        <span className={cx('shrink-0 text-[12px] font-semibold text-ink-subtle', done && 'line-through decoration-ink-subtlest')}>{issueKey}</span>
        <span className="flex min-w-0 flex-1 items-center justify-end gap-2">
          {card.due && <DatePill value={card.due} done={done} size="sm" />}
          {checklist.length > 0 && (
            <span title={`Checklist: ${ticked} of ${checklist.length} done`} className={cx('inline-flex items-center gap-0.5 text-[11px] font-medium', ticked === checklist.length ? 'text-loz-done-ink' : 'text-ink-subtlest')}>
              <CheckSquare size={12} aria-hidden="true" />{ticked}/{checklist.length}
            </span>
          )}
          {comments > 0 && (
            <span title={`${comments} comment${comments === 1 ? '' : 's'}`} className="inline-flex items-center gap-0.5 text-[11px] font-medium text-ink-subtlest">
              <MessageSquare size={12} aria-hidden="true" />{comments}
            </span>
          )}
          <Points value={card.estimate} />
          <PriorityIcon priority={card.priority} />
        </span>
      </div>
      {menu && !overlay && (
        // Its own clicks and keys stay here: they must not open the card under it.
        <span className="absolute top-1.5 right-1.5" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
          {menu}
        </span>
      )}
    </div>
  );
}

/**
 * The card's ⋯ menu: move it to another status, change its priority, open it, copy its link,
 * duplicate or delete it — every card action reachable without dragging.
 */
export function IssueCardMenu({ columns, columnId, priority, onMove, onPriority, onOpen, onCopyLink, onDuplicate, onDelete }) {
  return (
    <Menu
      label="Card actions"
      items={[
        { id: 'open', label: 'Open', onSelect: onOpen },
        { id: 'move', label: 'Move to', items: columns.map((c) => ({ id: c.id, label: c.title || 'Untitled', checked: c.id === columnId, radio: true, onSelect: () => c.id !== columnId && onMove(c.id) })) },
        { id: 'priority', label: 'Priority', items: PRIORITIES.map((p) => ({ id: p.id, label: p.name, checked: p.id === priority, radio: true, onSelect: () => p.id !== priority && onPriority(p.id) })) },
        { type: 'separator' },
        { id: 'link', label: 'Copy link', onSelect: onCopyLink },
        { id: 'dup', label: 'Duplicate', onSelect: onDuplicate },
        { id: 'del', label: 'Delete', danger: true, onSelect: onDelete },
      ]}
      trigger={(
        <IconButton
          icon={MoreHorizontal}
          label="Card actions"
          size="sm"
          variant="subtle"
          tooltip={false}
          className="opacity-0 group-hover/card:opacity-100 no-hover:opacity-100 focus-visible:opacity-100"
        />
      )}
    />
  );
}

/**
 * A card on the board: sortable (dnd-kit — `data.type` 'card', its column in `data.listId`), a
 * focusable button that Enter / Space or a click opens. While it is dragged its place shows as a
 * dashed slot.
 */
export function SortableIssueCard({ card, listId, issueKey, done, onOpen, menu }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: 'card', listId },
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      role="button"
      aria-label={`${issueKey} ${card.title || 'Untitled'}`}
      onClick={onOpen}
      onKeyDown={(e) => { listeners?.onKeyDown?.(e); openOnKey(e, onOpen); }}
      className="touch-manipulation rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      {isDragging ? (
        <div className="h-20 rounded border-2 border-dashed border-[#8590a2]/60 bg-neutral-fill" />
      ) : (
        <IssueCardView card={card} issueKey={issueKey} done={done} menu={menu} />
      )}
    </div>
  );
}
