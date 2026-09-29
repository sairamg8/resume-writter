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
  // Where that statement sat (anchorOf): found again by its text after an outside value, the one at
  // its place is taken, not the first with the same text (R5-HUNT7 review).
  const optimizerAnchor = useRef(null);
  // With no statement, the empty bullet or line the caret was in (blankSpot), which the result fills.
  const optimizerSpot = useRef(null);
  // A drag that starts in this editor: the text it drags (a Range), and the mark it puts on the drag
  // so its own drop knows it (onDrop). A drag from anywhere else carries no such mark.
  const dragSource = useRef(null);
  const moveMark = useId();

  // What this editor last wrote through onChange (its last few values, in case the store hands one
  // back a render late), and what its box held when it last matched the stored value (emitted or
  // adopted): a `value` among the first is its own echo; a box still holding the second has nothing
  // typed in it that the store has not got.
  const emitted = useRef([]);
  const synced = useRef(null);
  // An outside value that came while the box had unsaved typing in it (an IME word being composed):
  // taken in when the box loses focus.
  const pending = useRef(false);

  // Show `value`, sanitized first: it may come from an imported file, and innerHTML runs
  // <img onerror> and friends.
  function adopt(next) {
    const el = ref.current;
    pending.current = false;
    emitted.current = []; // what it shows now is no longer its own
    const clean = sanitizeRichText(next || '');
    if (el.innerHTML !== clean) el.innerHTML = clean;
    synced.current = el.innerHTML;
    // A value stored with a picture's data in it (before R4-ED-02, a pasted screenshot's megabytes
    // of base64) is stored again without it, so it stops filling the browser's storage and the cloud
    // copy. Only then: showing a value otherwise writes nothing. The data: URL is looked for inside a
    // tag, where a picture keeps it; the same words typed as text stay in the clean value, and matching
    // them wrote the field again every time it was shown.
    if (DATA_URL.test(next || '')) {
      emitted.current = [clean];
      onChange(clean);
    }
  }

  // Adopt `value` whenever it changes from outside (another resume opened, an import, a cloud
  // pull, another tab). While this editor has focus its own echo is left alone: there the DOM is
  // the source of truth and rewriting innerHTML would reset the caret. An outside value is taken in
  // at once even then when nothing has been typed since the box last matched the store, else when the
  // box loses focus. Skipping it for good kept the old text on screen, and the next keystroke wrote
  // it back over the newer value (R5-HUNT3).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement !== el) { adopt(value); return; }
    // Its own echo: the store has taken this value and every one emitted before it, so those are
    // dropped. An older value of its own that comes back later (another tab's undo, a stale copy
    // saved elsewhere) is then an outside value again, and shown, not kept off screen for good.
    const echo = emitted.current.lastIndexOf(value ?? '');
    if (echo !== -1) { emitted.current = emitted.current.slice(echo + 1); return; }
    if (el.innerHTML === synced.current && !isComposing.current) adopt(value);
    else pending.current = true;
  }, [value]);

  const latest = useRef(value);
  latest.current = value;
  function onBlur() {
    if (pending.current && ref.current) adopt(latest.current);
  }

  // A word composed with an IME (and every word on most Android keyboards) ends before the box loses
  // focus, and emitting then wrote the box's text, typed over the old value, back over an outside
  // value that came meanwhile. The store's newer text is taken in instead; the composed word, typed
  // over text that is no longer there, goes (R5-HUNT3).
  function onCompositionEnd() {
    isComposing.current = false;
    if (pending.current && ref.current) adopt(latest.current);
    else onInput();
  }

  // What the editor holds, with any picture dropped first (dropMedia): the stored value never keeps
  // an <img> or a data: URL, whichever way the browser put one in.
  function emit() {
    const el = ref.current;
    if (el) dropMedia(el);
    const html = el?.innerHTML || '';
    // What the store holds already comes back as no new value, so it is no echo to wait for.
    if (html !== (latest.current ?? '')) emitted.current = [...emitted.current.slice(-9), html];
    synced.current = el ? el.innerHTML : null;
    pending.current = false;
    onChange(html);
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
    const statement = statementRange(ref.current);
    optimizerTarget.current = statement;
    optimizerAnchor.current = statement ? anchorOf(ref.current, statement) : null;
    optimizerSpot.current = statement ? null : blankSpot(ref.current);
    setOptimizerText(statement ? statement.toString().replace(/\s+/g, ' ').trim() : '');
    setOptimizerOpen(true);
  }

  /**
   * The optimizer's result in place of the statement it opened on, as text; with none, in the empty
   * bullet or line the caret was in (blankSpot); with neither, a new bullet.
   * A list item's own statement split by a nested list (statementRange) takes it in its first run of
   * text, and its later runs are deleted: the nested list between them is never touched (R4-SW-WT-02).
   */
  function handleApplyOptimizedText(optimizedText) {
    const el = ref.current;
    const text = String(optimizedText || '').trim();
    let statement = optimizerTarget.current;
    const anchor = optimizerAnchor.current;
    const spot = optimizerSpot.current;
    optimizerTarget.current = null;
    optimizerAnchor.current = null;
    optimizerSpot.current = null;
    if (!el || !text) return;
    // A value taken in from outside while the optimizer was open (another tab's save, a cloud pull)
    // replaced the editor's nodes, and the saved Range collapsed to the editor's start: Apply wrote the
    // result there, as loose text above the bullets, and left the statement as it was
    // (R5-HUNT7-OPTIMIZER-APPLY-AFTER-OUTSIDE-CHANGE). A Range that no longer covers the statement the
    // optimizer opened on is found again by its text; with none, the result is a new bullet. Of several
    // with that text (a word selected in one bullet that another bullet has too, two equal bullets), the
    // one with the same text around it, nearest its old place, is taken: the first one was, and Apply
    // rewrote another bullet than the one the optimizer opened on (R5-HUNT7 review).
    if (statement && !covers(el, statement, optimizerText)) statement = findStatement(el, optimizerText, anchor);
    el.focus();
    const range = statement?.target ?? statement;
    const removals = statement?.removals ?? [];
    if (range) {
      const sel = window.getSelection();
      // The item's own elements before the edit, each with whether it was blank: dropPlaceholders
      // removes only what the edit added or emptied.
      const kept = statement?.item ? new Map(ownElements(statement.item).map((n) => [n, isBlank(n)])) : null;
      // The later runs go first, last to first, so the ranges before them keep their place.
      for (const run of removals) {
        sel.removeAllRanges();
        sel.addRange(run);
        document.execCommand('delete');
      }
      sel.removeAllRanges();
      sel.addRange(range);
      document.execCommand('insertText', false, text);
      if (kept) dropPlaceholders(statement.item, kept);
    } else if (spot && spot.html === el.innerHTML && el.contains(spot.host ?? spot.parent)) {
      // Opened from an empty bullet or line: the result goes there. It went to the end of the
      // description as a new bullet — in a numbered list, a bulleted list under it — and the empty
      // bullet stayed, printed as a bare "•" (R5-HUNT8-OPTIMIZER-EMPTY-BULLET-APPLY-AT-END).
      const at = document.createRange();
      const placeholders = spot.host ? ownElements(spot.host).filter((n) => n.nodeName === 'BR') : [];
      if (spot.host) at.selectNodeContents(spot.host);
      else {
        const i = spot.child ? [...spot.parent.childNodes].indexOf(spot.child) : spot.parent.childNodes.length;
        at.setStart(spot.parent, i);
        at.setEnd(spot.parent, i);
      }
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(at);
      document.execCommand('insertText', false, text);
      // The empty item's own <br> (Chrome's <li><br></li>), if the browser kept it beside the text.
      for (const br of placeholders) if (spot.host.contains(br)) br.parentNode.removeChild(br);
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
          onBlur={onBlur}
          onPaste={onPaste}
          onDrop={onDrop}
          onDragStart={onDragStart}
          onDragEnd={() => { dragSource.current = null; }}
          onCompositionStart={() => { isComposing.current = true; }}
          onCompositionEnd={onCompositionEnd}
          className="px-3 py-2 text-sm pointer-coarse:text-base focus:outline-none empty-placeholder rich-text-output"
          style={{ minHeight: minH }}
          data-placeholder={placeholder}
        />
      </div>

      {/* Mounted only while open: its statement starts from the one it opens on, every time. The kit's
          Dialog draws it in a portal at the end of <body>: drawn here, it sat inside the entry, section
          or field around the editor, and when that one is hidden (faded with opacity) the optimizer was
          faded with it, and controls placed later on the page (the panel's resize handle, the phone's
          Edit | Preview pill) painted over it and took its clicks (R4-DVIS-23). */}
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

/**
 * The statement being edited in `el`, as a Range: the selection when it is inside `el` and not
 * empty; else, around the caret, the list item or paragraph it is in — or, in text that is not
 * in one (the first line Chrome leaves bare, lines split by <br>), the run of text between line
 * breaks. null when the caret is not in `el`, or sits on no text.
 * A list item whose own text is split by a nested list or by paragraphs inside it is one statement,
 * as the ATS score reads it and the PDF prints it ("Led migration" + sub-list + "for 3 regions" is
 * "Led migration for 3 regions", R4-LO-16): then it is { target, removals, toString() } — the item's
 * first run of text, which Apply replaces, and its later runs, which Apply deletes (R4-SW-WT-02).
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
  // A list item's own statement, when a nested list or a paragraph inside it splits it in runs. One
  // Range over them all would take the nested list with it, and Apply wiped the sub-items (R4-LO-12).
  const item = itemOf(host, el);
  const runs = item && ownRuns(item);
  if (runs?.length > 1) return ownStatement(item, runs);
  // Its line: the text between line breaks, a <br> at any depth ("<p><b>A<br>B</b></p>" is two lines,
  // R4-LO-12) or a block inside it (a nested list is its own statements, not part of its item's).
  const leaves = lineLeaves(host);
  if (host !== el && !leaves.some(isBreak)) {
    range.selectNodeContents(host);
    return range.toString().trim() ? range : null;
  }
  let node = at.startContainer;
  if (node.nodeType === 1 && !leaves.includes(node)) {
    // A caret between two nodes, at any depth: the leaf after it, but just before a line break it is
    // at the end of the line that break closes.
    const child = node.childNodes[at.startOffset];
    const pos = child ? leaves.indexOf(edgeLeaf(child, 'first')) : leaves.indexOf(edgeLeaf(node.lastChild, 'last')) + 1;
    if (pos < 0 || (!child && !node.lastChild)) return null;
    const [before, after] = [leaves[pos - 1], leaves[pos]];
    node = after && (!isBreak(after) || !before || isBreak(before)) ? after : before;
  }
  let i = leaves.indexOf(node);
  // A caret inside a nested block's own text is outside this host's lines.
  if (i < 0 || isBreak(leaves[i])) return null;
  let j = i;
  while (i > 0 && !isBreak(leaves[i - 1])) i -= 1;
  while (j < leaves.length - 1 && !isBreak(leaves[j + 1])) j += 1;
  range.setStartBefore(leaves[i]);
  range.setEndAfter(leaves[j]);
  return range.toString().trim() ? range : null;
}

/**
 * Where the caret sits in `el` on an empty line, when statementRange finds no statement there: an
 * empty list item or paragraph ({ host }), or a blank line between line breaks ({ parent, child }: the
 * caret is before `child` in `parent`, at its end with none), with the editor's HTML as it was
 * ({ html }): Apply fills it only when nothing has changed since. null elsewhere, and in an empty
 * editor, where the result is a new bullet.
 */
function blankSpot(el) {
  const sel = window.getSelection?.();
  if (!el || !sel || !sel.rangeCount || !el.contains(sel.anchorNode) || !el.textContent.trim()) return null;
  const at = sel.getRangeAt(0);
  if (at.toString().trim()) return null;
  let host = null;
  for (let n = at.startContainer; n && n !== el; n = n.parentNode) {
    if (n.nodeType === 1 && STATEMENTS.has(n.nodeName)) { host = n; break; }
  }
  if (host && isBlank(host)) return { host, html: el.innerHTML };
  const parent = at.startContainer;
  if (parent.nodeType !== 1 || (parent !== el && parent !== host)) return null;
  const child = parent.childNodes[at.startOffset] ?? null;
  const prev = parent.childNodes[at.startOffset - 1] ?? null;
  const edge = (n) => !n || isBreak(n);
  return edge(child) && edge(prev) ? { parent, child, html: el.innerHTML } : null;
}

/** A statement's text as the optimizer shows it: runs of white space as one space, trimmed. */
const flat = (s) => String(s).replace(/\s+/g, ' ').trim();

/** Whether `statement` (statementRange) is still in `el` and still covers the text `opened`. */
function covers(el, statement, opened) {
  const ranges = [statement.target ?? statement, ...(statement.removals ?? [])];
  return ranges.every((r) => el.contains(r.commonAncestorContainer)) && flat(statement.toString()) === opened;
}

/** Runs of white space as one space, not trimmed: offsets in a text read in parts add up. */
const spaced = (s) => String(s).replace(/\s+/g, ' ');

/**
 * Where `statement` (statementRange) sits in `el`: the offset of its start in el's text (spaced), and
 * up to 40 characters of that text on either side of it.
 */
function anchorOf(el, statement) {
  const first = statement.target ?? statement;
  const last = statement.removals?.[0] ?? first; // the removals run last to first
  const before = document.createRange();
  before.setStart(el, 0);
  before.setEnd(first.startContainer, first.startOffset);
  const after = document.createRange();
  after.setStart(last.endContainer, last.endOffset);
  after.setEnd(el, el.childNodes.length);
  const head = spaced(before.toString());
  return { at: head.length, before: head.slice(-40), after: spaced(after.toString()).slice(0, 40) };
}

/** How many characters `a` and `b` share at their ends (`fromEnd`) or at their starts. */
function shared(a, b, fromEnd) {
  let n = 0;
  while (n < a.length && n < b.length && a[fromEnd ? a.length - 1 - n : n] === b[fromEnd ? b.length - 1 - n : n]) n += 1;
  return n;
}

/**
 * The statement in `el` whose text is `opened`: each statement statementRange reads with the caret in
 * each line in turn, and each place a text node holds `opened` as it is (a selection inside a line).
 * Of several, the one whose text around it is most like `anchor`'s (anchorOf), then the one nearest
 * its place; a whole statement before a place in a line when both are as like. null with none.
 */
function findStatement(el, opened, anchor) {
  if (!opened) return null;
  const sel = window.getSelection?.();
  const texts = [];
  (function read(node) {
    for (const child of node.childNodes) {
      if (child.nodeType === 3) { if (child.nodeValue.trim()) texts.push(child); } else read(child);
    }
  })(el);
  const found = [];
  if (sel) {
    for (const node of texts) {
      const caret = document.createRange();
      caret.setStart(node, 0);
      caret.setEnd(node, 0);
      sel.removeAllRanges();
      sel.addRange(caret);
      const statement = statementRange(el);
      if (statement && flat(statement.toString()) === opened) found.push(statement);
    }
  }
  for (const node of texts) {
    for (let at = node.nodeValue.indexOf(opened); at >= 0; at = node.nodeValue.indexOf(opened, at + 1)) {
      const range = document.createRange();
      range.setStart(node, at);
      range.setEnd(node, at + opened.length);
      found.push(range);
    }
  }
  if (!anchor || found.length < 2) return found[0] ?? null;
  let best = null;
  let bestLike = -1;
  let bestOff = Infinity;
  for (const statement of found) {
    const here = anchorOf(el, statement);
    const like = shared(here.before, anchor.before, true) + shared(here.after, anchor.after, false);
    const off = Math.abs(here.at - anchor.at);
    if (like > bestLike || (like === bestLike && off < bestOff)) [best, bestLike, bestOff] = [statement, like, off];
  }
  return best;
}

/** The list item a statement host belongs to: itself, or the item its paragraph sits in; else null. */
function itemOf(host, el) {
  for (let n = host; n && n !== el; n = n.parentNode) {
    if (n.nodeName === 'LI') return n;
    if (n.nodeName === 'UL' || n.nodeName === 'OL') return null;
  }
  return null;
}

/**
 * `item`'s own text as runs, in order: [{ leaves, block }], a run ending at each block inside it; its
 * nested lists are skipped, as they are statements of their own. `block` is the paragraph a run is in
 * (null for text straight in the item). Runs with no text are left out. null when a <br> splits the
 * item's own text: its lines are then read one by one (R4-CL-04).
 */
function ownRuns(item) {
  const runs = [];
  let run = null;
  let split = false;
  const read = (node, block) => {
    for (const child of node.childNodes) {
      if (child.nodeName === 'BR') { split = true; return; }
      if (['UL', 'OL', 'LI'].includes(child.nodeName)) { run = null; continue; }
      if (isBreak(child)) {
        run = null;
        read(child, child);
        run = null;
      } else if (isWrapper(child)) {
        read(child, block);
      } else {
        if (!run) runs.push(run = { leaves: [], block });
        run.leaves.push(child);
      }
    }
  };
  read(item, null);
  return split ? null : runs.filter((r) => r.leaves.some((n) => n.textContent.trim()));
}

/**
 * An item's statement from its runs (ownRuns): the first to write into, the rest to delete, last first;
 * `item` for Apply to tidy afterwards (dropPlaceholders).
 */
function ownStatement(item, runs) {
  const span = (from, to) => {
    const r = document.createRange();
    r.setStartBefore(from);
    r.setEndAfter(to);
    return r;
  };
  const text = (run) => span(run.leaves[0], run.leaves[run.leaves.length - 1]);
  const [first, ...rest] = runs;
  return {
    item,
    target: text(first),
    // A run that is a whole paragraph goes with its paragraph, so no empty line is left in the item.
    removals: rest.reverse().map((run) => (run.block && run.block.textContent.trim() === text(run).toString().trim()
      ? span(run.block, run.block)
      : text(run))),
    toString: () => runs.map((run) => text(run).toString().trim()).join(' '),
  };
}

/** Every element in `node`, in order, outside its nested lists: an item's own markup. */
function ownElements(node, out = []) {
  for (const child of node.childNodes) {
    if (child.nodeType !== 1 || child.nodeName === 'UL' || child.nodeName === 'OL') continue;
    out.push(child);
    ownElements(child, out);
  }
  return out;
}

/** Whether element `n` holds no text and nothing but <br>s: an empty line. */
const isBlank = (n) => !n.textContent.replace(/[\s\u200b\ufeff]/g, '') && ownElements(n).every((c) => c.nodeName === 'BR');

/**
 * The empty lines Chrome's delete and insertText leave in an item Apply rewrote: a <p><br></p> where a
 * deleted run after a nested list was, and a <br> before that nested list. The PDF printed each as a
 * blank line inside the bullet (review of R4-SW-WT-02). A block goes when it is blank now and the edit
 * added it or emptied it; a <br> goes when the edit added it and it ends a line before a block or the
 * item's end. The item's own blank lines and <br>s stay (an item with a <br> of its own is never read
 * as one statement anyway, ownRuns). Repeated until nothing changes: removing one can expose another.
 */
function dropPlaceholders(item, kept) {
  for (let changed = true; changed;) {
    changed = false;
    for (const n of ownElements(item)) {
      if (!item.contains(n) || (kept.has(n) && (n.nodeName === 'BR' || kept.get(n)))) continue;
      let drop = false;
      if (n.nodeName === 'BR') {
        let next = n.nextSibling;
        while (next && next.nodeType === 3 && !next.nodeValue.replace(/[\s\u200b\ufeff]/g, '')) next = next.nextSibling;
        drop = !next || BLOCKS.has(next.nodeName);
      } else {
        drop = BLOCKS.has(n.nodeName) && isBlank(n);
      }
      if (drop) {
        n.parentNode.removeChild(n);
        changed = true;
      }
    }
  }
}

/** A line break: a <br>, or a block element, which starts a line of its own. */
const isBreak = (n) => n.nodeName === 'BR' || (n.nodeType === 1 && BLOCKS.has(n.nodeName));
/** Whether `n` is an inline element holding nodes of its own (<b>, <a>, <span>…), read through. */
const isWrapper = (n) => n.nodeType === 1 && !isBreak(n) && n.childNodes.length > 0;

/** `host`'s lines as a flat list, in order: text and empty inline nodes, and the breaks between them. */
function lineLeaves(host) {
  const out = [];
  for (const child of host.childNodes) {
    if (isWrapper(child)) out.push(...lineLeaves(child));
    else out.push(child);
  }
  return out;
}

/** The first or last of `node`'s leaves, reading through inline wrappers; null for no node. */
function edgeLeaf(node, edge) {
  let n = node;
  while (n && isWrapper(n)) n = edge === 'first' ? n.firstChild : n.lastChild;
  return n ?? null;
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
