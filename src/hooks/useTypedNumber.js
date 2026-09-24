import { useRef, useState } from 'react';

/**
 * The typed box in the middle of a stepper (Header spacing's GapStepper, Design's SizeRow and
 * NumberRow): while it has focus it shows `editText` for typing, and what was typed is committed
 * ONCE — on Enter or on leaving the box — and only when it differs from `editText` (R2-032).
 *
 * Clicking into a box and out again used to commit the box's own rounded text: a template's 13.33 px
 * gap was stored as 13 (and read as set), Contact Icons with nothing stored became a stored 11. And
 * Escape set the draft aside and then blurred — a browser runs the blur handler at once, with the
 * typed text still in the box and the render that was on screen, so the typed value was saved. Enter
 * committed, then its blur committed again. A ref, not state, marks an edit Enter or Escape already
 * settled, since the blur they cause runs before React renders again.
 *
 * `shown`: the box's text while it is not being edited ("12pt"); `editText`: its text while it is
 * ("12"), default `shown`; `commit(text)`: parse, clamp and write the typed text; `select`: select the
 * text on focus, so typing replaces it (GapStepper's).
 * Returns the input's props, plus `drop()` — for a key that writes a value of its own (the arrows).
 */
export function useTypedNumber({ shown, editText = shown, commit, select = false }) {
  const [draft, setDraft] = useState(null);
  const settled = useRef(false);

  const write = (text) => {
    if (String(text).trim() !== String(editText)) commit(String(text));
  };

  return {
    drop: () => setDraft(null),
    inputProps: {
      value: draft ?? shown,
      onFocus: (e) => { settled.current = false; setDraft(String(editText)); if (select) e.target.select(); },
      onChange: (e) => setDraft(e.target.value),
      onBlur: (e) => {
        const done = settled.current;
        settled.current = false;
        setDraft(null);
        if (!done) write(e.target.value);
      },
      onKeyDown: (e) => {
        if (e.key !== 'Enter' && e.key !== 'Escape') return;
        const text = e.currentTarget.value;
        settled.current = true;
        setDraft(null);
        if (e.key === 'Enter') write(text);
        e.currentTarget.blur();
      },
    },
  };
}
