// Just enough of a browser DOM for react-dom/client to mount, update and unmount a component in
// Node: elements, text nodes, attributes, style, and a scrollTop that stays where it was set, as
// a real scroll box's does. No layout, no events — a test calls a control's React handler itself
// (reactProps) inside flushSync. Enough for editor behaviour that lives in effects and refs,
// which the server renderer never runs.
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';

const HTML_NS = 'http://www.w3.org/1999/xhtml';

class FakeNode {
  constructor(doc, nodeType, nodeName) {
    this.ownerDocument = doc;
    this.nodeType = nodeType;
    this.nodeName = nodeName;
    this.parentNode = null;
    this.childNodes = [];
  }
  get firstChild() { return this.childNodes[0] ?? null; }
  get lastChild() { return this.childNodes.at(-1) ?? null; }
  get nextSibling() {
    const siblings = this.parentNode?.childNodes ?? [];
    return siblings[siblings.indexOf(this) + 1] ?? null;
  }
  appendChild(child) { return this.insertBefore(child, null); }
  insertBefore(child, ref) {
    child.parentNode?.removeChild(child);
    const at = ref ? this.childNodes.indexOf(ref) : -1;
    this.childNodes.splice(at < 0 ? this.childNodes.length : at, 0, child);
    child.parentNode = this;
    return child;
  }
  removeChild(child) {
    this.childNodes.splice(this.childNodes.indexOf(child), 1);
    child.parentNode = null;
    return child;
  }
  contains(node) {
    for (let n = node; n; n = n.parentNode) if (n === this) return true;
    return false;
  }
  get textContent() { return this.childNodes.map((c) => c.textContent).join(''); }
  set textContent(text) {
    for (const c of this.childNodes) c.parentNode = null;
    this.childNodes = [];
    if (text) this.appendChild(this.ownerDocument.createTextNode(text));
  }
  addEventListener() {}
  removeEventListener() {}
}

class FakeText extends FakeNode {
  constructor(doc, text) { super(doc, 3, '#text'); this.nodeValue = String(text); }
  get data() { return this.nodeValue; }
  get textContent() { return this.nodeValue; }
  set textContent(text) { this.nodeValue = String(text); }
}

class FakeElement extends FakeNode {
  constructor(doc, tag, namespaceURI = HTML_NS) {
    super(doc, 1, namespaceURI === HTML_NS ? tag.toUpperCase() : tag);
    this.tagName = this.nodeName;
    this.namespaceURI = namespaceURI;
    this.attributes = new Map();
    this.style = { setProperty(k, v) { this[k] = v; }, removeProperty(k) { delete this[k]; } };
    this.onclick = null;
    this.scrollTop = 0;
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  hasAttribute(name) { return this.attributes.has(name); }
  removeAttribute(name) { this.attributes.delete(name); }
  get className() { return this.getAttribute('class') ?? ''; }
  set className(value) { this.setAttribute('class', value); }
  focus() {}
  blur() {}
}

class FakeDocument extends FakeNode {
  constructor() {
    super(null, 9, '#document');
    this.ownerDocument = null;
    this.defaultView = null;
    this.documentElement = this.appendChild(this.createElement('html'));
    this.body = this.documentElement.appendChild(this.createElement('body'));
    this.activeElement = this.body;
  }
  createElement(tag) { return new FakeElement(this, tag); }
  createElementNS(ns, tag) { return new FakeElement(this, tag, ns); }
  createTextNode(text) { return new FakeText(this, text); }
}

/** Every element under `node` (itself included), depth first. */
export function* elements(node) {
  if (node.nodeType === 1) yield node;
  for (const c of node.childNodes) yield* elements(c);
}

/** The props React last rendered onto `el` (its handlers among them). */
export function reactProps(el) {
  const key = Object.keys(el).find((k) => k.startsWith('__reactProps$'));
  return key ? el[key] : undefined;
}

/**
 * Mount `component` with `props` into a fresh fake document; `window` and `document` exist for
 * as long as the mount does. Returns the container, `update(props)` (a synchronous re-render),
 * `act(fn)` (runs fn — a click handler, say — and commits what it set), and `await unmount()`.
 */
export function mount(component, props) {
  const saved = { window: globalThis.window, document: globalThis.document };
  const document = new FakeDocument();
  const window = { document, HTMLIFrameElement: class {}, location: { href: 'http://localhost/' } };
  document.defaultView = window;
  Object.assign(globalThis, { window, document });
  const container = document.body.appendChild(document.createElement('div'));
  const root = createRoot(container);
  const act = (fn) => flushSync(fn);
  const update = (next) => act(() => root.render(createElement(component, next)));
  update(props);
  return {
    container,
    update,
    act,
    async unmount() {
      act(() => root.unmount());
      // React flushes a commit's passive effects from a scheduler task (setImmediate in Node) that
      // reads window.event: let those run while the fake window is still there.
      for (let i = 0; i < 5; i += 1) await new Promise((r) => { setImmediate(r); });
      for (const k of ['window', 'document']) {
        if (saved[k] === undefined) delete globalThis[k];
        else globalThis[k] = saved[k];
      }
    },
  };
}
