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
  // The STAR Optimizer's statement as it opened (optimizerText), and the Range its result replaces:
  // the selection, else the bullet or line the caret is in; null to add the result as a new bullet.
  const [optimizerText, setOptimizerText] = useState('');
  const optimizerTarget = useRef(null);

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

  /**
   * Open the STAR Optimizer on the statement being edited: the text selected in this editor, else
   * the bullet (or line) the caret is in (statementRange). It used to open on the text the editor
   * held at its first render — none — and Apply inserted the result at the caret as HTML, the
   * original left as it was (bug audit 2026-09-22).
   */
  function openOptimizer() {
    const range = statementRange(ref.current);
    optimizerTarget.current = range;
    setOptimizerText(range ? range.toString().replace(/\s+/g, ' ').trim() : '');
    setOptimizerOpen(true);
  }

  /** The optimizer's result in place of the statement it opened on, as text; with none, a new bullet. */
  function handleApplyOptimizedText(optimizedText) {
    const el = ref.current;
    const text = String(optimizedText || '').trim();
    const range = optimizerTarget.current;
    optimizerTarget.current = null;
    if (!el || !text) return;
    el.focus();
    if (range && el.contains(range.commonAncestorContainer)) {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      document.execCommand('insertText', false, text);
    } else {
      el.innerHTML = sanitizeRichText(`${el.innerHTML}<ul><li>${plainTextToHtml(text)}</li></ul>`);
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
              e.preventDefault(); // keeps the caret and selection in the editor for openOptimizer
              openOptimizer();
            }}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 hover:text-amber-800 transition-colors ml-auto cursor-pointer"
          >
            <Sparkles size={11} className="text-amber-600" />
            <span className="hidden sm:inline">STAR Optimizer</span>
          </button>
        </div>

        {/* Editable area. 16 px on touch screens: iOS zooms the page into any smaller field it
            focuses, a contenteditable included (J-38b). A mouse keeps 14 px, so the résumé
            editor looks as it did on a desktop. */}
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
          className="px-3 py-2 text-sm pointer-coarse:text-base focus:outline-none empty-placeholder rich-text-output"
          style={{ minHeight: minH }}
          data-placeholder={placeholder}
        />
      </div>

      {/* Mounted only while open: its statement starts from the one it opens on, every time. */}
      {optimizerOpen && (
        <BulletOptimizerModal
          isOpen
          onClose={() => setOptimizerOpen(false)}
          initialText={optimizerText}
          onApply={handleApplyOptimizedText}
        />
      )}
    </div>
  );
}

/** The elements a statement can be: a list item or a paragraph (Chrome writes a new line as a div). */
const STATEMENTS = new Set(['LI', 'P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE']);
const BLOCKS = new Set([...STATEMENTS, 'UL', 'OL']);
/** A node that sits inside a line of text: text, or an inline element other than <br>. */
const inLine = (n) => n.nodeType === 3 || (n.nodeType === 1 && !BLOCKS.has(n.nodeName) && n.nodeName !== 'BR');

/**
 * The statement being edited in `el`, as a Range: the selection when it is inside `el` and not
 * empty; else, around the caret, the list item or paragraph it is in — or, in text that is not
 * in one (the first line Chrome leaves bare, lines split by <br>), the run of text between line
 * breaks. null when the caret is not in `el`, or sits on no text.
 * Exported for tests/pdf/57-optimizer-statement: which statement the optimizer opens on is the
 * half of this fix a browser is not needed to check (AUD-09).
 */
export function statementRange(el) {
  const sel = window.getSelection?.();
  if (!el || !sel || !sel.rangeCount || !el.contains(sel.anchorNode)) return null;
  const at = sel.getRangeAt(0);
  if (!at.collapsed && at.toString().trim()) return at.cloneRange();
  const range = document.createRange();
  // The paragraph or item the caret is in, else the editor itself. A paragraph whose lines are split
  // by <br> (Shift+Enter, a pasted or imported description) is read line by line, as bare text is:
  // read whole, its two lines opened glued into one ("Handled QACut costs") and Apply replaced both
  // (R4-CL-04).
  let host = el;
  for (let n = at.startContainer; n && n !== el; n = n.parentNode) {
    if (n.nodeType === 1 && STATEMENTS.has(n.nodeName)) { host = n; break; }
  }
  if (host !== el && ![...host.childNodes].some((c) => c.nodeName === 'BR')) {
    range.selectNodeContents(host);
    return range.toString().trim() ? range : null;
  }
  let node = at.startContainer;
  if (node === host) {
    // A caret between two children: the one after it, but just before a <br> it is at the end of the
    // line that break closes.
    const [before, after] = [host.childNodes[at.startOffset - 1], host.childNodes[at.startOffset]];
    node = after && (after.nodeName !== 'BR' || !before || !inLine(before)) ? after : before || host.lastChild;
  }
  while (node && node.parentNode !== host) node = node.parentNode;
  if (!node || !inLine(node)) return null;
  let first = node;
  let last = node;
  while (first.previousSibling && inLine(first.previousSibling)) first = first.previousSibling;
  while (last.nextSibling && inLine(last.nextSibling)) last = last.nextSibling;
  range.setStartBefore(first);
  range.setEndAfter(last);
  return range.toString().trim() ? range : null;
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
