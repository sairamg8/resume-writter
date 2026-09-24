// What the kit's overlay and keyboard tests need beyond tests/pdf/fake-dom.mjs: focus that moves
// (document.activeElement, a `focusin` on the document as a browser fires it), the few CSS
// selectors the kit queries (`button`, `a[href]`, `[data-autofocus]`, `[role="menu"]`…, joined by
// commas — no combinators), closest(), isConnected, and animation frames. Added to fake-dom's
// element and document prototypes for this test process only; fake-dom itself is untouched.
// Also: the Vite SSR loader for the kit's JSX, event objects shaped like React's, and a wait.
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { fakeWindow, elements, reactProps } from '../pdf/fake-dom.mjs';

export { elements, reactProps };
export { mount } from '../pdf/fake-dom.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** Vite's SSR loader over the app (JSX, the `@/` alias); `close()` it in `after`. */
export async function kitLoader() {
  const vite = await createServer({
    root: ROOT, configFile: `${ROOT}vite.config.js`, appType: 'custom', logLevel: 'error',
    server: { middlewareMode: true, hmr: false, ws: false },
  });
  return { load: (id) => vite.ssrLoadModule(id), close: () => vite.close() };
}

/** One simple selector — `tag`, `[attr]`, `[attr="v"]`, or a tag followed by attribute parts. */
function matchesSimple(el, selector) {
  const m = /^([a-z0-9*]*)((?:\[[^\]]+\])*)$/i.exec(selector.trim());
  if (!m || el.nodeType !== 1) return false;
  if (m[1] && m[1] !== '*' && el.tagName !== m[1].toUpperCase()) return false;
  for (const [, name, value] of m[2].matchAll(/\[([^\]=\s]+)(?:=["']?([^"'\]]*)["']?)?\]/g)) {
    if (!el.hasAttribute(name)) return false;
    if (value !== undefined && el.getAttribute(name) !== value) return false;
  }
  return true;
}

const matches = (el, selectorList) => selectorList.split(',').some((s) => matchesSimple(el, s));

let patched = false;
/** Teaches fake-dom focus and selectors (once per process). Call before the first mount. */
export function patchFakeDom() {
  if (patched) return;
  patched = true;
  const { document } = fakeWindow();
  const Element = Object.getPrototypeOf(document.body);
  const Document = Object.getPrototypeOf(document);
  const all = (root, selector) => [...elements(root)].filter((el) => el !== root && matches(el, selector));
  Object.assign(Element, {
    matches(selector) { return !selector.includes(':') && matches(this, selector); },
    closest(selector) {
      for (let n = this; n && n.nodeType === 1; n = n.parentNode) if (!selector.includes(':') && matches(n, selector)) return n;
      return null;
    },
    querySelectorAll(selector) { return all(this, selector); },
    querySelector(selector) { return all(this, selector)[0] ?? null; },
    focus() {
      const doc = this.ownerDocument;
      if (doc.activeElement === this) return;
      doc.activeElement = this;
      doc.dispatchEvent?.({ type: 'focusin', target: this });
    },
    blur() {
      if (this.ownerDocument.activeElement === this) this.ownerDocument.activeElement = this.ownerDocument.body;
    },
  });
  Object.defineProperty(Element, 'isConnected', {
    get() {
      for (let n = this; n; n = n.parentNode) if (n.nodeType === 9) return true;
      return false;
    },
  });
  Object.assign(Document, {
    querySelectorAll(selector) { return all(this, selector); },
    querySelector(selector) { return all(this, selector)[0] ?? null; },
  });
  globalThis.requestAnimationFrame ??= (fn) => setTimeout(fn, 0);
  globalThis.cancelAnimationFrame ??= (id) => clearTimeout(id);
}

/** An event as a React handler reads it: `key`, `target`, modifiers, preventDefault and stopPropagation. */
export function ev(props = {}) {
  return {
    defaultPrevented: false,
    propagationStopped: false,
    shiftKey: false, metaKey: false, ctrlKey: false, altKey: false, detail: 1,
    nativeEvent: {},
    preventDefault() { this.defaultPrevented = true; },
    stopPropagation() { this.propagationStopped = true; },
    ...props,
  };
}

/** The elements under `root` with attribute `name` (= `value` when given). */
export function byAttr(root, name, value) {
  return [...elements(root)].filter((el) => el.hasAttribute(name) && (value === undefined || el.getAttribute(name) === value));
}

/** The first element under `root` whose text is exactly `text` and whose tag is `tag`. */
export function byText(root, text, tag = 'BUTTON') {
  return [...elements(root)].find((el) => el.tagName === tag && el.textContent.trim() === text) ?? null;
}

export const wait = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

/** A node in a line: its tag, id or role, and the start of its text. */
function describeNode(node) {
  if (!node || typeof node !== 'object') return String(node);
  const mark = node.getAttribute?.('id') ? `#${node.getAttribute('id')}` : node.getAttribute?.('role') ? `[role=${node.getAttribute('role')}]` : '';
  return `<${node.tagName ?? node.nodeName}${mark}> "${(node.textContent ?? '').slice(0, 40)}"`;
}

/**
 * `actual` is the very node `expected` (focus, say). Not assert.equal: on a failure its message
 * inspects both nodes to a depth of 1000 with getters, and a fake-dom node reaches the whole tree
 * and React's fibers along many paths — the report runs the process out of memory instead of
 * failing (R3-005: CI killed this file after 60 s).
 */
export function assertSame(actual, expected, message = 'not the same node') {
  assert.ok(actual === expected, `${message}: got ${describeNode(actual)}, expected ${describeNode(expected)}`);
}
