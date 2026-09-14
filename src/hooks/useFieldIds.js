import { createContext, useContext, useId } from 'react';

/**
 * Ties a field's visible label to its control, so assistive technology reads the label as the
 * field's name (audit M8). A <label htmlFor={id}> names an input with that `id`; a control a
 * <label> cannot name — rich text, a pair of month/year selects — takes the label's `labelId`
 * through aria-labelledby, or an aria-label built from `label`.
 *
 * A FieldRow (section editor) draws the label and the eye toggle and wraps the control, so it
 * provides these ids to its child; anywhere else a control makes its own.
 */
export const FieldIdsContext = createContext(null);

export function useFieldIds(label) {
  const own = useId();
  const row = useContext(FieldIdsContext);
  return row || { id: own, labelId: `${own}label`, label };
}
