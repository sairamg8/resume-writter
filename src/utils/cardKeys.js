// A draggable card's keyboard: the job kanban's and a board's cards are focusable role=button
// elements (dnd-kit), yet Enter and Space did nothing on them (R2-039). No React and no path
// aliases, so both card components share it.

/**
 * Enter or Space pressed on the focused card itself — not on a link or button inside it, which
 * handles its own key — calls `open`, and the key does nothing else (Space would scroll the page).
 */
export function openOnKey(e, open) {
  if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return;
  e.preventDefault();
  open();
}

/*
 * What a screen reader reads on a focused card (a DndContext's screenReaderInstructions). dnd-kit's
 * own text promised a keyboard drag — the space bar, the arrow keys — that no sensor on either
 * board offers (R2-039). A keyboard user changes a job's status on the job's page.
 */
export const JOB_DRAG_INSTRUCTIONS = {
  draggable: 'Press Enter to open this job. To move it to another status, drag it with a mouse, or press and hold it on a touch screen, or open the job and pick its status there.',
};

export const BOARD_DRAG_INSTRUCTIONS = {
  draggable: 'Press Enter to open a card. To move a card or a list, drag it with a mouse, or press and hold it on a touch screen.',
};
