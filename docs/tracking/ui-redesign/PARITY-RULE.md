# Parity rule: the redesign changes the UI only (owner, 2026-10-06, binding)

"In the new design proposal all the existing functionalities stay the same; only the UI is revamped."

Every function the live app has today stays, with the same behaviour, data, limits, shortcuts, persistence, sign-in and
offline behaviour, and the same error and empty states. A new screen may move, regroup, restyle or rename a control; it may
not remove it, change what it does, or make it harder to reach than "one drawer or menu away". Where a drawn layout cannot
hold a function, the layout bends, the function does not.

## What the rule settles in the canvas (README "Product calls", applied by the lead; the owner can overrule any line)
- Projects stays, with every function it has today (the canvas draws a simplified version: whatever it hides stays reachable).
- All of today's templates stay selectable (the 8 drawn are a layout question: scroll, filter, group; never fewer looks).
- Today's template apply-on-click with Undo stays (the canvas draws Cancel / Use template).
- The Jobs list keeps its Location, Salary and Contact (as columns, or one tap away); every Download / Export / Import entry of
  today stays, including "Import as my original" where it exists today.
- The cover-letter draft keeps today's generator and its options; the Tone / Length / pasted-posting controls drawn on
  EditorDraft are NOT built (they are new capabilities).
- New capabilities drawn that the app does not have today (Improve button on the Summary field, Weeks/Months on the Timeline,
  the Public page footer "Want your own?", new banner wording) are NOT built. They go on a PARKED list for the owner. If the
  audit finds one already exists in the live app under another name, it is the same function and is kept.
- Where a board and the live app differ and the audit cannot tell which is meant, the live app wins.

## How it is enforced
- `parity/<area>.md`: one row per live function (id, live behaviour with file:line, where it sits in the new design, status
  SAME / MOVED / RESTYLED / CHANGED / MISSING). CHANGED and MISSING rows are design-change requests for the canvas and are
  fixed in the React build by restoring the function, never by dropping it.
- Every batch of the plan lists the parity rows it owns; a batch is complete only when each of its rows is SAME / MOVED /
  RESTYLED in the built UI, proven by a test, and the parity walker (`tests/pdf/parity/`) still walks every control.
- Accessibility stays deferred (CLAUDE.md); keep the markup semantic where it costs nothing, do not add an a11y feature.
