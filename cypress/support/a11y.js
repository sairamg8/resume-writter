// Accessible names as assistive technology computes them — the parts of W3C accname 1.2 this app
// uses — for the a11y spec (audit main-loop notes M8, M9). Run on the app's own document.

const TEXT = 3;
const ELEMENT = 1;

/** What a node says when its parent is named from content: text and alt text, minus aria-hidden. */
function contentText(node) {
  if (node.nodeType === TEXT) return node.textContent;
  if (node.nodeType !== ELEMENT || node.getAttribute('aria-hidden') === 'true') return '';
  if (node.tagName === 'IMG') return node.getAttribute('alt') || '';
  return [...node.childNodes].map(contentText).join('');
}

const squash = (s) => s.replace(/\s+/g, ' ').trim();

/** An element's accessible name: aria-labelledby, aria-label, <label>, its content, title. */
export function accessibleName(el) {
  const doc = el.ownerDocument;
  const by = el.getAttribute('aria-labelledby');
  if (by) {
    const text = squash(by.split(/\s+/).map((id) => {
      const ref = doc.getElementById(id);
      return ref ? contentText(ref) : '';
    }).join(' '));
    if (text) return text;
  }
  const aria = squash(el.getAttribute('aria-label') || '');
  if (aria) return aria;
  if (el.matches('input, select, textarea, [contenteditable]')) {
    // A field is never named by its value or placeholder here: a placeholder is not a label.
    const text = squash([...(el.labels || [])].map(contentText).join(' '));
    if (text) return text;
  } else {
    const text = squash(contentText(el));
    if (text) return text;
  }
  return squash(el.getAttribute('title') || '');
}

/** Shown, or reachable by Tab: a control faded out until hover (opacity 0) still counts. */
export function rendered(el) {
  return el.getClientRects().length > 0 && el.ownerDocument.defaultView.getComputedStyle(el).visibility !== 'hidden';
}

const FIELDS = 'input:not([type="hidden"]), select, textarea, [contenteditable="true"], [contenteditable=""]';
const BUTTONS = 'button, a[href], [role="button"], [role="switch"], [role="checkbox"], [role="tab"]';
/** A name that says something: "+", "−" or "↺" alone does not. */
const meaningful = (name) => /[\p{L}\p{N}]/u.test(name);
const describe = (el) => el.outerHTML.replace(/\s+/g, ' ').slice(0, 160);

/**
 * M8: every field on the page has a name, and every <label> names a control — through `for`,
 * by wrapping it, or as the target of an aria-labelledby.
 */
export function unlabelledFields(doc) {
  const out = [];
  doc.querySelectorAll(FIELDS).forEach((el) => {
    if (rendered(el) && !meaningful(accessibleName(el))) out.push(describe(el));
  });
  doc.querySelectorAll('label').forEach((label) => {
    if (!rendered(label) || label.control) return;
    const target = label.id && [...doc.querySelectorAll('[aria-labelledby]')]
      .some((el) => el.getAttribute('aria-labelledby').split(/\s+/).includes(label.id));
    if (!target) out.push(`<label> "${squash(label.textContent)}" names no control`);
  });
  return out;
}

/** M9: every button, link, switch, checkbox and tab on the page has a name that says something. */
export function unnamedButtons(doc) {
  const out = [];
  doc.querySelectorAll(BUTTONS).forEach((el) => {
    if (rendered(el) && !meaningful(accessibleName(el))) out.push(`"${accessibleName(el)}" ${describe(el)}`);
  });
  return out;
}
