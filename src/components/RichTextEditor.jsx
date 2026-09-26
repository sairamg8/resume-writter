import { useState, useRef, useEffect, useId } from 'react';
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
  // A drag that starts in this editor: the text it drags (a Range), and the mark it puts on the drag
  // so its own drop knows it (onDrop). A drag from anywhere else carries no such mark.
  const dragSource = useRef(null);
  const moveMark = useId();

  // Adopt `value` whenever it changes from outside (another resume opened, an import, a cloud
  // pull), but never while this editor has focus: there the DOM is the source of truth and
  // rewriting innerHTML would reset the caret. The value is sanitized first: it may come from
  // an imported file, and innerHTML runs <img onerror> and friends.
  useEffect(() => {
    const el = ref.current;
    if (!el || document.activeElement === el) return;
    const clean = sanitizeRichText(value || '');
    if (el.innerHTML !== clean) el.innerHTML = clean;
    // A value stored with a picture's data in it (before R4-ED-02, a pasted screenshot's megabytes
    // of base64) is stored again without it, so it stops filling the browser's storage and the cloud
    // copy. Only then: showing a value otherwise writes nothing. The data: URL is looked for inside a
    // tag, where a picture keeps it; the same words typed as text stay in the clean value, and matching
    // them wrote the field again every time it was shown.
    if (DATA_URL.test(value || '')) onChange(clean);
  }, [value]);

  // What the editor holds, with any picture dropped first (dropMedia): the stored value never keeps
  // an <img> or a data: URL, whichever way the browser put one in.
  function emit() {
    const el = ref.current;
    if (el) dropMedia(el);
    onChange(el?.innerHTML || '');
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
  // fonts or backgrounds from Google Docs or web pages, and nothing executable. The browser never
  // inserts its own: a clipboard or a drop with no text (a copied screenshot, an image file) put an
  // <img src="data:…"> of 1–5 MB in the field, which never prints and filled the browser's storage
  // and the cloud copy's 1 MB (R4-ED-02). The editor has no pictures, so that inserts nothing.
  function onPaste(e) {
    if (!e.clipboardData) return; // a browser with no clipboard data to read pastes as it always did
    e.preventDefault();
    insertClean(e.clipboardData);
  }

  function onDragStart(e) {
    // Only a selection is moved. A drag with none (a link dragged by itself) has a collapsed range,
    // and deleting that deleted the character before the caret.
    const sel = window.getSelection();
    const range = sel?.rangeCount ? sel.getRangeAt(0) : null;
    dragSource.current = range && !range.collapsed ? range.cloneRange() : null;
    if (dragSource.current) e.dataTransfer?.setData(MOVE_TYPE, moveMark);
  }

  // A drag that started in this editor is a move: the text leaves where it was and goes in at the
  // drop point. Inserting it there and nothing else — the browser's move cancelled — left it in both
  // places (R4-ED-04). The editor moves it itself, rather than leaving the drop to the browser, so
  // the moved text is sanitized like any drop (a browser's own move wraps it in styled spans). The
  // drag's mark, not a flag, says where it came from: a flag cleared on dragend stayed set when the
  // dragged node was gone before dragend fired, and every later drop went in unsanitized.
  function onDrop(e) {
    e.preventDefault();
    const data = e.dataTransfer;
    const source = dragSource.current;
    dragSource.current = null;
    if (!data?.getData('text/html') && !data?.getData('text/plain')) return;
    const at = dropRange(e.clientX, e.clientY);
    const sel = window.getSelection();
    if (source && data.getData(MOVE_TYPE) === moveMark && ref.current?.contains(source.commonAncestorContainer)) {
      if (!at || source.isPointInRange?.(at.startContainer, at.startOffset)) return; // dropped on itself
      sel.removeAllRanges();
      sel.addRange(source);
      document.execCommand('delete'); // `at` is a live Range: it keeps its place as the text goes
    }
    if (at) {
      sel.removeAllRanges();
      sel.addRange(at);
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
          onDragStart={onDragStart}
          onDragEnd={() => { dragSource.current = null; }}
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
  for (let n = at.startContainer; n && n !== el; n = n.parentNode) {
    if (n.nodeType === 1 && STATEMENTS.has(n.nodeName)) {
      range.selectNodeContents(n);
      return range.toString().trim() ? range : null;
    }
  }
  let node = at.startContainer === el ? el.childNodes[at.startOffset] || el.lastChild : at.startContainer;
  while (node && node.parentNode !== el) node = node.parentNode;
  if (!node || !inLine(node)) return null;
  let first = node;
  let last = node;
  while (first.previousSibling && inLine(first.previousSibling)) first = first.previousSibling;
  while (last.nextSibling && inLine(last.nextSibling)) last = last.nextSibling;
  range.setStartBefore(first);
  range.setEndAfter(last);
  return range.toString().trim() ? range : null;
}

/** Elements a browser can paste or drop into a contentEditable that the editor cannot print. */
const MEDIA = new Set(['IMG', 'PICTURE', 'VIDEO', 'AUDIO', 'SVG', 'CANVAS', 'IFRAME', 'OBJECT', 'EMBED']);
/** A data: URL's base64 payload inside a tag, as a browser's own paste of a picture stores it. */
const DATA_URL = /<[^>]*\bdata:[^\s"'>,;]*;base64,/i;
/** The type a drag from an editor carries, with that editor's own id, so its drop knows it as a move. */
const MOVE_TYPE = 'application/x-resume-rich-text-move';

/** Remove every picture and other media element under `node`, in place (R4-ED-02). */
function dropMedia(node) {
  for (const child of Array.from(node.childNodes)) { // a copy: removing a child changes the live list
    if (child.nodeType !== 1) continue;
    if (MEDIA.has(child.nodeName.toUpperCase())) node.removeChild(child);
    else dropMedia(child);
  }
}

/**
 * The caret position under a drop point, as a Range: caretRangeFromPoint (Chromium, Safari), else
 * caretPositionFromPoint (Firefox, which has no caretRangeFromPoint — the drop point was ignored
 * there and the text went over the selection instead, R4-ED-04). null when neither finds one.
 */
function dropRange(x, y) {
  const range = document.caretRangeFromPoint?.(x, y);
  if (range) return range;
  const pos = document.caretPositionFromPoint?.(x, y);
  if (!pos?.offsetNode) return null;
  const at = document.createRange();
  at.setStart(pos.offsetNode, pos.offset);
  at.setEnd(pos.offsetNode, pos.offset);
  return at;
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
