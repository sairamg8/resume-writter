import { ChevronDown } from 'lucide-react';
import { Field, controlClass, useFieldIds } from './Field.jsx';
import { cx } from './compose.js';

/** One <option>, or an <optgroup> of them for `{ label, options }`. */
function renderOption(option) {
  if (option.options) {
    return (
      <optgroup key={`group-${option.label}`} label={option.label}>
        {option.options.map(renderOption)}
      </optgroup>
    );
  }
  return <option key={String(option.value)} value={option.value} disabled={option.disabled}>{option.label}</option>;
}

/**
 * A styled native <select>: native on purpose — screen readers, keyboards and phones' own pickers
 * all know it. Every native prop passes through (`value`, `onChange(event)`, `name`, `ref`…).
 *
 * - `options`: `[{ value, label, disabled }]`, or `{ label, options: [...] }` for a group; or pass
 *   <option> children instead.
 * - `placeholder`: a first empty option ("Choose…"), not selectable again once a value is set
 *   unless `allowEmpty`.
 * - `label`, `hint`, `error`, `required`, `size` ('sm' | 'md') as TextField; `leadingIcon` inside
 *   on the left (a status dot's icon, say).
 */
export function Select({
  id, label, hint, error, required, options, placeholder, allowEmpty = false, size = 'md', leadingIcon: LeadingIcon,
  className, selectClassName, labelClassName, children, ref, ...rest
}) {
  const ids = useFieldIds(id, { hint, error });
  return (
    <Field ids={ids} label={label} hint={hint} error={error} required={required} className={className} labelClassName={labelClassName}>
      <div className="relative flex items-center">
        {LeadingIcon && <LeadingIcon size={16} aria-hidden="true" className="pointer-events-none absolute left-2.5 text-slate-400" />}
        <select
          ref={ref}
          id={ids.controlId}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={ids.describedBy}
          className={cx(
            controlClass({ invalid: !!error, size }),
            'cursor-pointer appearance-none pr-8',
            size === 'sm' ? 'h-8 pointer-coarse:h-11' : 'h-9 pointer-coarse:h-11',
            LeadingIcon ? 'pl-8' : 'pl-3',
            selectClassName,
          )}
          {...rest}
        >
          {placeholder != null && <option value="" disabled={!allowEmpty}>{placeholder}</option>}
          {options ? options.map(renderOption) : children}
        </select>
        <ChevronDown size={16} aria-hidden="true" className="pointer-events-none absolute right-2.5 text-slate-400" />
      </div>
    </Field>
  );
}
