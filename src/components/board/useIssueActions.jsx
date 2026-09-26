import { useBoardStore } from '@/hooks/useBoardStore';
import { useConfirmOptional, useToast, useUrlState } from '@/components/ui';
import { copyText } from '@/utils/clipboard';
import { findIssueByKey, issueKey } from '@/utils/boardModel';
import { IssueDialog } from './IssueDialog';

/** The address of an issue, for "Copy link". */
export const issueLink = (board, issue) => `${window.location.origin}${window.location.pathname}#/boards/${encodeURIComponent(board.id)}?issue=${encodeURIComponent(issueKey(board, issue))}`;

/**
 * The issue a project page shows over itself, named in the address (`?issue=LIFE-12`, pushed so
 * Back closes it): `{ found ({ board, issue } | null), open(key), close() }`. With `board`, only
 * an issue of that project opens there.
 */
export function useIssueRoute(boards, board = null) {
  const [param, setParam] = useUrlState('issue', null, { push: true });
  const hit = param ? findIssueByKey(boards, param) : null;
  const found = hit && (!board || hit.board.id === board.id) ? hit : null;
  return { found, open: (key) => setParam(key), close: () => setParam(null) };
}

/** The open issue's dialog, when the address names one. */
export function IssueHost({ route }) {
  if (!route.found) return null;
  return <IssueDialog board={route.found.board} issueId={route.found.issue.id} onClose={route.close} onOpenIssue={route.open} />;
}

/**
 * What a card's or a row's menu does, with the kit's confirm and toasts: delete (asked first, then
 * Undo), duplicate, copy link — for issues of `board`.
 */
export function useIssueActions(board) {
  const store = useBoardStore();
  const confirm = useConfirmOptional();
  const { toast } = useToast();
  return {
    async remove(issue) {
      const key = issueKey(board, issue);
      const ok = await confirm({ title: `Delete ${key}?`, body: `“${issue.title}” will be deleted. You can undo this for a few seconds.`, confirmLabel: 'Delete', tone: 'danger' });
      if (!ok) return;
      const removed = store.deleteIssue(board.id, issue.id);
      if (removed) toast({ title: `${key} deleted`, action: { label: 'Undo', onClick: () => store.restoreIssue(board.id, removed) } });
    },
    duplicate(issue) {
      const copy = store.duplicateIssue(board.id, issue.id);
      if (copy) toast({ tone: 'success', title: `${issueKey(board, copy)} created`, description: `A copy of ${issueKey(board, issue)}.` });
    },
    copyLink(issue) {
      copyText(issueLink(board, issue)).then(() => toast({ title: 'Link copied' }), () => toast({ tone: 'danger', title: 'Could not copy the link' }));
    },
  };
}
