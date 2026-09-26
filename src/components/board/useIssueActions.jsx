import { useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useBoardStore } from '@/hooks/useBoardStore';
import { useConfirmOptional, useToast } from '@/components/ui';
import { withSearchParam } from '@/hooks/useUrlState';
import { copyText } from '@/utils/clipboard';
import { findIssueByKey, issueKey } from '@/utils/boardModel';
import { IssueDialog } from './IssueDialog';

/** How long a close waits for its step back to land before a second close may drop the param. */
const CLOSE_WAIT_MS = 1000;

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
  // The entry a close was asked from, and when: a browser steps back a while later, and a second
  // close meanwhile (Escape held down, a double-clicked X) stepped back twice, off the board. Past
  // CLOSE_WAIT_MS on the same entry the step back never landed (a count longer than the history a
  // restored tab kept): that close drops the param in place, or the view could never close.
  const closedFrom = useRef(null);
  // Taken over only when an address lands (a new key): the app's router commits a navigation later,
  // in a transition, and a render before it (a store update) would put the old address back over
  // the pending one. A close asked from the pending address keeps its guard on the one that lands.
  const landed = useRef(location.key);
  useLayoutEffect(() => {
    if (location.key === landed.current) return;
    landed.current = location.key;
    const pending = live.current.pending ? live.current.key : null;
    live.current = location;
    if (closedFrom.current && closedFrom.current.key === pending) closedFrom.current = { ...closedFrom.current, key: location.key };
    else if (closedFrom.current?.key !== location.key) closedFrom.current = null;
  });
  const at = (loc, key) => ({ pathname: loc.pathname, search: withSearchParam(loc.search, 'issue', key), hash: loc.hash });
  return {
    found,
    open: (key) => {
      const loc = live.current;
      const current = new URLSearchParams(loc.search).get('issue');
      const depth = loc.state?.issueDepth ?? 0;
      if (key === current) return;
      const to = at(loc, key);
      const replace = Boolean(current && depth === 0);
      const state = replace ? loc.state : { ...loc.state, issueDepth: depth + 1 };
      navigate(to, { replace, state });
      // The address it is going to, until it lands: a second open meanwhile (a double-clicked
      // row) is then the same issue, and pushes nothing.
      live.current = { ...loc, ...to, state, key: `${loc.key}:${key}`, pending: true };
    },
    close: () => {
      const loc = live.current;
      const again = closedFrom.current?.key === loc.key;
      if (again && Date.now() - closedFrom.current.at < CLOSE_WAIT_MS) return;
      closedFrom.current = { key: loc.key, at: Date.now() };
      const depth = loc.state?.issueDepth ?? 0;
      if (depth > 0 && !again) navigate(-depth);
      else navigate(at(loc, null), { replace: true, state: { ...loc.state, issueDepth: 0 } });
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
