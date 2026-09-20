import { useState, useRef, useEffect } from 'react';
import {
  Bold, Italic, Underline, List, ListOrdered,
  AlignLeft, AlignCenter, AlignRight, AlignJustify, Link, Sparkles,
} from 'lucide-react';
import { sanitizeRichText, sanitizeForInsert, plainTextToHtml, safeHref } from '@/utils/richText';
import { useFieldIds } from '@/hooks/useFieldIds';
import BulletOptimizerModal from '@/components/BulletOptimizerModal';

/**
 * `label` draws a label above the editor; without one, the editor is named by the FieldRow it
 * sits in, or by `ariaLabel` (for an editor under its own heading).
 */
export default function RichTextEditor({ label, ariaLabel, value, onChange, placeholder, rows = 3 }) {
  const ref = useRef(null);
  const ids = useFieldIds(label);
  const isComposing = useRef(false);
  const [optimizerOpen, setOptimizerOpen] = useState(false);

  // Adopt `value` whenever it changes from outside (another resume opened, an import, a cloud
  // pull), but never while this editor has focus: there the DOM is the source of truth and
  // rewriting innerHTML would reset the caret. The value is sanitized first: it may come from
  // an imported file, and innerHTML runs <img onerror> and friends.
  useEffect(() => {
    const el = ref.current;
    if (!el || document.activeElement === el) return;
    const clean = sanitizeRichText(value || '');
    if (el.innerHTML !== clean) el.innerHTML = clean;
  }, [value]);

  function emit() {
    onChange(ref.current?.innerHTML || '');
  }

  function exec(cmd, val = null) {
    ref.current?.focus();
    document.execCommand(cmd, false, val);
    emit();
  }

  function insertLink() {
    const input = window.prompt('Paste URL (e.g. https://github.com/you):');
    if (!input || !input.trim()) return;
    const href = safeHref(input.trim());
    if (!href) {
      window.alert('That is not a web, e-mail or phone link.');
      return;
    }
    exec('createLink', href);
  }

  function insertClean(data) {
    const html = data?.getData('text/html');
    const text = data?.getData('text/plain');
    if (!html && !text) return false;
    document.execCommand('insertHTML', false, html ? sanitizeForInsert(html) : plainTextToHtml(text));
    emit();
    return true;
  }

  function handleApplyOptimizedText(optimizedText) {
    if (!optimizedText) return;
    ref.current?.focus();
    if (!ref.current?.innerText.trim()) {
      document.execCommand('insertHTML', false, `<ul><li>${optimizedText}</li></ul>`);
    } else {
      document.execCommand('insertHTML', false, optimizedText);
    }
    emit();
  }

  // Pasted and dropped content is reduced to what the editor itself can produce — no colours,
  // fonts or backgrounds from Google Docs or web pages, and nothing executable.
  function onPaste(e) {
    if (insertClean(e.clipboardData)) e.preventDefault();
  }

  function onDrop(e) {
    const data = e.dataTransfer;
    if (!data?.getData('text/html') && !data?.getData('text/plain')) return;
    e.preventDefault();
    const range = document.caretRangeFromPoint?.(e.clientX, e.clientY);
    if (range) {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      ref.current?.focus();
    }
    insertClean(data);
  }

  function onInput() {
    if (!isComposing.current) emit();
  }

  const minH = `${rows * 1.7}rem`;

  return (
    <div>
      {/* A <label> cannot name a contenteditable: the editor points back at it, and a click focuses it. */}
      {label && <label id={ids.labelId} htmlFor={ids.id} onClick={() => ref.current?.focus()} className="block text-xs text-gray-500 mb-1">{label}</label>}
      <div className="border border-gray-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">

        {/* Toolbar */}
        <div className="flex items-center flex-wrap gap-0.5 px-1.5 py-1 bg-gray-50 border-b border-gray-100">

          {/* Format group */}
          <Btn title="Bold (Ctrl+B)" onExec={() => exec('bold')}><Bold size={12} /></Btn>
          <Btn title="Italic (Ctrl+I)" onExec={() => exec('italic')}><Italic size={12} /></Btn>
          <Btn title="Underline (Ctrl+U)" onExec={() => exec('underline')}><Underline size={12} /></Btn>

          <Sep />

          {/* List group */}
          <Btn title="Bullet list" onExec={() => exec('insertUnorderedList')}><List size={12} /></Btn>
          <Btn title="Numbered list" onExec={() => exec('insertOrderedList')}><ListOrdered size={12} /></Btn>

          <Sep />

          {/* Link */}
          <Btn title="Insert link" onExec={insertLink}><Link size={12} /></Btn>

          <Sep />

          {/* Alignment group */}
          <Btn title="Align left" onExec={() => exec('justifyLeft')}><AlignLeft size={12} /></Btn>
          <Btn title="Align center" onExec={() => exec('justifyCenter')}><AlignCenter size={12} /></Btn>
          <Btn title="Align right" onExec={() => exec('justifyRight')}><AlignRight size={12} /></Btn>
          <Btn title="Justify" onExec={() => exec('justifyFull')}><AlignJustify size={12} /></Btn>

          {/* AI / STAR Optimizer */}
          <button
            type="button"
            title="Bullet Optimizer & STAR Formula Helper"
            onMouseDown={e => {
              e.preventDefault();
              setOptimizerOpen(true);
            }}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 hover:text-amber-800 transition-colors ml-auto cursor-pointer"
          >
            <Sparkles size={11} className="text-amber-600" />
            <span className="hidden sm:inline">STAR Optimizer</span>
          </button>
        </div>

        {/* Editable area */}
        <div
          ref={ref}
          id={ids.id}
          role="textbox"
          aria-multiline="true"
          aria-label={ariaLabel}
          aria-labelledby={ariaLabel ? undefined : ids.labelId}
          contentEditable
          suppressContentEditableWarning
          onInput={onInput}
          onPaste={onPaste}
          onDrop={onDrop}
          onCompositionStart={() => { isComposing.current = true; }}
          onCompositionEnd={() => { isComposing.current = false; onInput(); }}
          className="px-3 py-2 text-sm focus:outline-none empty-placeholder rich-text-output"
          style={{ minHeight: minH }}
          data-placeholder={placeholder}
        />
      </div>

      <BulletOptimizerModal
        isOpen={optimizerOpen}
        onClose={() => setOptimizerOpen(false)}
        initialText={ref.current?.innerText.trim() || ''}
        onApply={handleApplyOptimizedText}
      />
    </div>
  );
}

function Btn({ title, onExec, children }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={e => { e.preventDefault(); onExec(); }}
      className="p-1 rounded text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
    >
      {children}
    </button>
  );
}

function Sep() {
  return <div className="w-px h-4 bg-gray-200 mx-0.5 self-center" />;
}
