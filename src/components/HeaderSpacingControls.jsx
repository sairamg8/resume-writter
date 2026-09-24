// Header spacing steppers (header_spacing_spec.md): one row per gap the header prints, in CSS px like
// Between Sections. An unset gap shows the template's own value in grey; a set one shows a reset
// arrow. The rows come from headerGapRows (src/utils/headerSpacingRows.js).
import { useId } from 'react';
import { RotateCcw } from 'lucide-react';
import { HEADER_GAP_KEYS } from '@/constants/headerSpacing';
import { useTypedNumber } from '@/hooks/useTypedNumber';

/** A px value as the stepper shows it: whole numbers plain, a template's 1.33 px as "1.3". */
export const formatPx = (px) => String(Math.round(px * 10) / 10);

const STEP_BTN = 'w-6 h-6 flex items-center justify-center border border-gray-200 rounded text-gray-600 hover:bg-gray-100 text-base leading-none disabled:opacity-40 disabled:hover:bg-transparent';

/**
 * One gap: label, −, the value, +, px — and ↺ once the user has set it. A typed value is written on
 * Enter or on leaving the box, and only when it differs from the shown one; Escape writes nothing
 * (useTypedNumber, R2-032) — clicking in and out no longer stores a template's 13.33 px as 13.
 */
export function GapStepper({ row, onChange, onReset }) {
  const labelId = useId();
  const { min, max, valuePx, set, name } = row;
  // −/+ land on whole pixels: from a template's 1.33 px, + gives 2 and − gives 1.
  const down = Math.max(min, Math.ceil(valuePx - 1e-6) - 1);
  const up = Math.min(max, Math.floor(valuePx + 1e-6) + 1);
  const lower = name.charAt(0).toLowerCase() + name.slice(1);

  const typed = useTypedNumber({
    shown: formatPx(valuePx),
    select: true,
    commit: (str) => {
      const n = parseFloat(str.replace(',', '.'));
      if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, Math.round(n))));
    },
  });

  return (
    <div className="flex items-center justify-between gap-2" data-gap={row.key}>
      <span id={labelId} className="text-[11px] text-gray-500">{row.label}</span>
      <div className="flex items-center gap-1">
        {set && (
          <button type="button" onClick={onReset} className="p-1 text-gray-400 hover:text-indigo-500" title="Back to the template's spacing" aria-label={`Reset ${lower} to the template's spacing`}>
            <RotateCcw size={11} aria-hidden="true" />
          </button>
        )}
        <button type="button" onClick={() => onChange(down)} disabled={valuePx <= min} className={STEP_BTN} aria-label={`Decrease ${lower}`}>−</button>
        <input
          type="text"
          inputMode="decimal"
          role="spinbutton"
          aria-label={`${name} (px)`}
          aria-describedby={labelId}
          aria-valuenow={Math.round(valuePx * 10) / 10}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuetext={`${formatPx(valuePx)} pixels${set ? '' : ", the template's spacing"}`}
          {...typed.inputProps}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp') { e.preventDefault(); typed.drop(); onChange(up); }
            else if (e.key === 'ArrowDown') { e.preventDefault(); typed.drop(); onChange(down); }
            else typed.inputProps.onKeyDown(e);
          }}
          className={`w-12 text-center text-xs border border-gray-200 rounded h-6 focus:outline-none focus:ring-1 focus:ring-blue-400 ${set ? 'font-medium text-gray-700' : 'text-gray-400'}`}
        />
        <button type="button" onClick={() => onChange(up)} disabled={valuePx >= max} className={STEP_BTN} aria-label={`Increase ${lower}`}>+</button>
        <span className="text-[11px] text-gray-400 w-4">px</span>
      </div>
    </div>
  );
}

/**
 * The group: a heading, its Reset (every row back to the template's, `allKeys` — not just the rows
 * on screen), `note` — a line saying why a gap is not offered yet — and the rows. `setKeys`: the
 * gaps this résumé has set, which is what Reset is offered for.
 */
export function HeaderSpacingGroup({ title = 'Header spacing', rows, onChange, onClear, note, allKeys = HEADER_GAP_KEYS, setKeys }) {
  const titleId = useId();
  // Reset is live when anything is set, including a gap whose row the header does not show now
  // (AUD-19) — `setKeys`, from headerGapKeysSet, which is the one rule for what "set" means. The
  // rows' own flags are the same rule, and stand in where a caller passes no keys.
  const anySet = (setKeys ?? rows.filter((r) => r.set).map((r) => r.key)).length > 0;
  return (
    <div role="group" aria-labelledby={titleId} className="space-y-2" data-testid="header-spacing">
      <div className="flex items-center justify-between">
        <p id={titleId} className="text-xs font-semibold text-gray-700">{title}</p>
        <button type="button" onClick={() => onClear(allKeys)} disabled={!anySet} aria-label="Reset header spacing to the template's" className="flex items-center gap-1 px-2 py-0.5 text-[11px] text-gray-500 border border-gray-200 rounded hover:text-indigo-600 hover:border-indigo-300 disabled:opacity-40 disabled:hover:text-gray-500 disabled:hover:border-gray-200">
          <RotateCcw size={10} aria-hidden="true" /> Reset
        </button>
      </div>
      {note && <p className="text-[10px] text-gray-400 leading-snug">{note}</p>}
      {rows.map((row) => (
        <GapStepper key={row.key} row={row} onChange={(v) => onChange(row.key, v)} onReset={() => onClear([row.key])} />
      ))}
    </div>
  );
}
