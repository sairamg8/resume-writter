import { useRef } from 'react';
import { Search, X } from 'lucide-react';
import { useHotkeys } from '../../hooks/useHotkeys.js';
import { Kbd } from './Kbd.jsx';
import { controlClass } from './Field.jsx';
import { cx, mergeRefs } from './compose.js';

/**
 * A search box: magnifier inside on the left, a clear button once there is text.
 *
 * - `value`, `onChange(value)` — the text, not the event (the clear button has no event to give).
 * - `hotkey`: a key that focuses it from anywhere on the page ('/' is the convention); drawn as a
 *   key cap while the box is empty. Ignored while typing elsewhere (useHotkeys).
 * - Escape clears the text, or — already empty — leaves the box.
 * - `placeholder` ('Search…'), `aria-label` (defaults to the placeholder), `size` 'sm' | 'md',
 *   `className` (the wrapper: set a width here), `ref` (the <input>), other <input> props pass through.
 */
export function SearchInput({
  value = '', onChange, placeholder = 'Search…', hotkey, size = 'md', className, 'aria-label': ariaLabel, ref, onKeyDown, ...rest
}) {
  const inputRef = useRef(null);
  useHotkeys(hotkey ? { [hotkey]: () => { inputRef.current?.focus(); inputRef.current?.select(); } } : {}, { enabled: !!hotkey });

  const clear = () => {
    onChange?.('');
    inputRef.current?.focus();
  };
  const handleKeyDown = (event) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    if (value) onChange?.('');
    else inputRef.current?.blur();
  };

  return (
    <div className={cx('relative flex items-center', className)}>
      <Search size={15} aria-hidden="true" className="pointer-events-none absolute left-2.5 text-slate-400" />
      <input
        ref={mergeRefs(ref, inputRef)}
        type="search"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        autoComplete="off"
        spellCheck={false}
        className={cx(
          controlClass({ size }),
          size === 'sm' ? 'h-8 pointer-coarse:h-11' : 'h-9 pointer-coarse:h-11',
          'pl-8 pr-9 [&::-webkit-search-cancel-button]:appearance-none',
        )}
        {...rest}
      />
      {value ? (
        <button
          type="button"
          onClick={clear}
          aria-label="Clear search"
          className="absolute right-1.5 inline-flex size-6 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
        >
          <X size={14} aria-hidden="true" />
        </button>
      ) : hotkey ? (
        <Kbd className="pointer-events-none absolute right-2 max-md:hidden">{hotkey}</Kbd>
      ) : null}
    </div>
  );
}
