import { useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useBoardStore } from '@/hooks/useBoardStore';
import { useConfirmOptional, useToast } from '@/components/ui';
import { withSearchParam } from '@/hooks/useUrlState';
import { copyText } from '@/utils/clipboard';
import { findIssueByKey, issueKey } from '@/utils/boardModel';
import { IssueDialog } from './IssueDialog';

/** The address of an issue, for "Copy link". */
export const issueLink = (board, issue) => `${window.location.origin}${window.location.pathname}#/boards/${encodeURIComponent(board.id)}?issue=${encodeURIComponent(issueKey(board, issue))}`;

/**
 * The issue a project page shows over itself, named in the address (`?issue=LIFE-12`, pushed so
 * Back closes it): `{ found ({ board, issue } | null), open(key), close() }`. With `board`, only
 * an issue of that project opens there.
 *
 * Closing undoes the opening: each open() pushes an entry and counts it in the entry's state
 * (`issueDepth`: an epic, then its child, is 2), and close() steps back over all of them, so Back
 * after a close leaves the page instead of opening the issue again. An issue the address named
 * some other way (a shared link) has no count: close() then drops the param in place, and an issue
 * opened from it replaces it — stepping back to the shared one would not close the view.
 */
export function useIssueRoute(boards, board = null) {
  const location = useLocation();
  const navigate = useNavigate();
  const param = new URLSearchParams(location.search).get('issue');
  const hit = param ? findIssueByKey(boards, param) : null;
  const found = hit && (!board || hit.board.id === board.id) ? hit : null;
  // open() and close() read the address as it is now, not as it was when they were handed out:
  // a toast's "Open" (Duplicate's) is clicked after the view has closed, and with the depth of
  // its own render it pushed one entry too many, and the close after it stepped off the board.
  const live = useRef(location);
  useLayoutEffect(() => {
    live.current = location;
  });
  const at = (loc, key) => ({ pathname: loc.pathname, search: withSearchParam(loc.search, 'issue', key), hash: loc.hash });
  return {
    found,
    open: (key) => {
      const loc = live.current;
      const current = new URLSearchParams(loc.search).get('issue');
      const depth = loc.state?.issueDepth ?? 0;
      if (key === current) return;
      if (current && depth === 0) navigate(at(loc, key), { replace: true, state: loc.state });
      else navigate(at(loc, key), { state: { ...loc.state, issueDepth: depth + 1 } });
    },
    close: () => {
      const loc = live.current;
      const depth = loc.state?.issueDepth ?? 0;
      if (depth > 0) navigate(-depth);
      else navigate(at(loc, null), { replace: true, state: loc.state });
    },
  };
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
