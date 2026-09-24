import { useCallback, useLayoutEffect, useRef } from 'react';
import { Field, controlClass, useFieldIds } from './Field.jsx';
import { composeHandlers, cx, mergeRefs } from './compose.js';

/**
 * A labelled multi-line text box. Every native <textarea> prop passes through (`value`,
 * `onChange(event)`, `rows`, `placeholder`, `ref`…); `label`, `hint`, `error`, `required` as TextField.
 *
 * - `autoGrow`: the box grows with its text from `rows` (3) up to `maxRows` (12), then scrolls —
 *   measured before paint, so typing never jumps.
 */
export function TextArea({
  id, label, hint, error, required, autoGrow = false, rows = 3, maxRows = 12, className, inputClassName,
  labelClassName, ref, value, onInput, ...rest
}) {
  const ids = useFieldIds(id, { hint, error });
  const own = useRef(null);

  /** Sizes the box to its text, between `rows` and `maxRows` lines. */
  const fit = useCallback(() => {
    const box = own.current;
    if (!autoGrow || !box) return;
    const style = window.getComputedStyle(box);
    const px = (name) => parseFloat(style[name]) || 0;
    const line = px('lineHeight') || 20;
    const chrome = px('paddingTop') + px('paddingBottom') + px('borderTopWidth') + px('borderBottomWidth');
    box.style.height = 'auto';
    // border-box sizing: the natural height is the scroll height (content + padding) plus borders.
    const natural = box.scrollHeight + px('borderTopWidth') + px('borderBottomWidth');
    const max = line * maxRows + chrome;
    box.style.height = `${Math.min(Math.max(natural, line * rows + chrome), max)}px`;
    box.style.overflowY = natural > max ? 'auto' : 'hidden';
  }, [autoGrow, rows, maxRows]);

  // A controlled box refits when its value changes; an uncontrolled one on every input.
  useLayoutEffect(fit, [fit, value]);

  return (
    <Field ids={ids} label={label} hint={hint} error={error} required={required} className={className} labelClassName={labelClassName}>
      <textarea
        ref={mergeRefs(ref, own)}
        id={ids.controlId}
        rows={rows}
        value={value}
        onInput={composeHandlers(onInput, fit)}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={ids.describedBy}
        className={cx(controlClass({ invalid: !!error }), 'block px-3 py-2 leading-5', autoGrow ? 'resize-none' : 'resize-y', inputClassName)}
        {...rest}
      />
    </Field>
  );
}
