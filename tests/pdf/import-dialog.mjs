// The Dashboard's Import dialog (src/components/ImportDialog.jsx, the kit's Dialog) over the fake DOM
// (tests/pdf/fake-dom.mjs). The dialog's code is a lazy chunk (lazyPiece.jsx, `import`): Import is pressed
// and the dialog is polled for with a bounded loop, never a fixed number of ticks. The dialog is drawn in a
// portal at the end of <body>; a closed one fades out for 150 ms (data-state="closed") before it unmounts,
// so a button is only looked for in the dialog that is open now.
import assert from 'node:assert/strict';
import { elements, reactProps } from './fake-dom.mjs';

export const IMPORT_TITLE = 'Import a file';
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
const click = () => ({ preventDefault() {}, stopPropagation() {}, detail: 1, nativeEvent: {} });
const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();

/** The open Import dialog, or undefined. */
export const importDialog = (view) => [...elements(view.document.body)]
  .find((el) => el.getAttribute('role') === 'dialog' && el.getAttribute('data-state') !== 'closed' && text(el).includes(IMPORT_TITLE));

/** The button `label` of the open dialog, or undefined. */
export const dialogButton = (view, label) => {
  const dialog = importDialog(view);
  return dialog && [...elements(dialog)].find((el) => el.tagName === 'BUTTON' && text(el) === label);
};

/** Waits (bounded) for the Import dialog to be open; returns it. */
export async function importDialogUp(view) {
  for (let i = 0; i < 500 && !importDialog(view); i += 1) {
    await sleep(10);
    view.act(() => {});
  }
  const dialog = importDialog(view);
  assert.ok(dialog, 'the Import dialog never opened');
  return dialog;
}

/** Presses `trigger` (the page's Import button), waits for the dialog and returns it. */
export async function openImportDialog(view, trigger) {
  view.act(() => reactProps(trigger).onClick(click()));
  return importDialogUp(view);
}

/** Presses `label` ("Choose a file", "Import as my original") in the open dialog. Returns the button. */
export function pressInDialog(view, label) {
  const button = dialogButton(view, label);
  assert.ok(button, `no "${label}" in the Import dialog: ${[...elements(importDialog(view) ?? view.document.body)].filter((e) => e.tagName === 'BUTTON').map(text).join(' | ')}`);
  view.act(() => reactProps(button).onClick(click()));
  return button;
}

/** The whole route: press the page's Import, wait for the dialog, press `label` in it. */
export async function importVia(view, trigger, label = 'Choose a file') {
  await openImportDialog(view, trigger);
  return pressInDialog(view, label);
}

/** Waits (bounded) for the dialog that was open to be gone (it fades out, then unmounts). */
export async function importDialogGone(view) {
  for (let i = 0; i < 500 && importDialog(view); i += 1) {
    await sleep(10);
    view.act(() => {});
  }
  assert.equal(importDialog(view), undefined, 'the Import dialog stayed open');
}
