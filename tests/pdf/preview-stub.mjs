// PdfPreview over tests/pdf/fake-dom.mjs with builds that SUCCEED, for tests/pdf/90-preview-*: a
// stand-in for pdf.js (installed with PdfPreview's _setPdfjsForTest) that opens one page per
// "PDF", whose text is the résumé's name, and counts the documents it opened and destroyed and
// the canvases it painted; and a build the test finishes (or fails) when it chooses, so the
// order in which renders finish is the test's to set. What is on screen is read back from the
// preview's own status, page count, canvases and screen-reader text.
import assert from 'node:assert/strict';
import { setup, teardown, loadModule, resume } from './harness.mjs';
import { fakeWindow, mount, elements, reactProps } from './fake-dom.mjs';

export const DEBOUNCE_MS = 350; // PdfPreview's
export const COLUMN_PX = 1000;  // the scroll column's width: the page fits it at 816 px (Letter)
export const wait = (ms) => new Promise((r) => { setTimeout(r, ms); });
/** Let a finished build run through pdf.js, the paint and React's commit. */
export const settle = () => wait(25);

const saved = { error: console.error, ResizeObserver: globalThis.ResizeObserver };
const Element = Object.getPrototypeOf(fakeWindow().document.createElement('div'));

export async function setupPreview() {
  await setup();
  console.error = () => {}; // "Preview render failed" from the builds a test fails on purpose
  globalThis.ResizeObserver = class { observe() {} disconnect() {} };
  // The two things fake-dom has no use for elsewhere: a column width to fit, and a 2-D context.
  Object.defineProperty(Element, 'clientWidth', { configurable: true, get: () => COLUMN_PX });
  Element.getContext = () => ({});
}

export async function teardownPreview() {
  const { _setPdfjsForTest } = await loadModule('/src/components/PdfPreview.jsx');
  _setPdfjsForTest(null);
  delete Element.clientWidth;
  delete Element.getContext;
  console.error = saved.error;
  if (saved.ResizeObserver) globalThis.ResizeObserver = saved.ResizeObserver;
  else delete globalThis.ResizeObserver;
  await teardown();
}

/**
 * A stand-in for pdf.js. `docs`: every document opened ({ name, destroyed }); `canvases`: every
 * canvas a page was painted into; `failPaint`: set true and the next paints fail.
 */
export function fakePdfjs() {
  const stub = { docs: [], canvases: [], failPaint: false };
  const page = (name) => ({
    view: [0, 0, 612, 792],
    getViewport: ({ scale }) => ({ width: 612 * scale, height: 792 * scale }),
    getTextContent: async () => ({ items: [{ str: name, transform: [1, 0, 0, 1, 72, 700], width: 100 }] }),
    render: ({ canvas }) => {
      stub.canvases.push(canvas);
      return { promise: stub.failPaint ? Promise.reject(new Error('paint failed')) : Promise.resolve() };
    },
  });
  const lib = {
    getDocument: ({ data }) => {
      const doc = { name: new TextDecoder().decode(data), destroyed: false, numPages: 1 };
      doc.getPage = async () => page(doc.name);
      doc.loadingTask = { destroy: async () => { doc.destroyed = true; } };
      stub.docs.push(doc);
      return { promise: Promise.resolve(doc) };
    },
  };
  stub.pdfjs = { lib, worker: {} };
  return stub;
}

/**
 * A build the test finishes: `calls[i]` is { input, finish(), fail(message) }. The "PDF" it
 * resolves to is the résumé's name, which the fake pdf.js shows as the page's text.
 */
export function heldBuild() {
  const calls = [];
  const build = (input) => new Promise((resolve, reject) => {
    const bytes = new TextEncoder().encode(input.personal.name);
    calls.push({
      input,
      finish: () => resolve({ arrayBuffer: async () => bytes.buffer }),
      fail: (message) => reject(new Error(message)),
    });
  });
  return { calls, build };
}

/** Mount PdfPreview with the fake pdf.js; read back what it shows. */
export async function preview(props) {
  const { PdfPreview, _setPdfjsForTest } = await loadModule('/src/components/PdfPreview.jsx');
  const pdf = fakePdfjs();
  _setPdfjsForTest(pdf.pdfjs);
  const base = { textId: 'resume-preview', ...props };
  const view = mount(PdfPreview, base);
  const all = () => [...elements(view.container)];
  const root = () => all().find((el) => el.hasAttribute('data-preview-status'));
  return {
    view,
    pdf,
    set: (next) => view.update({ ...base, ...next }),
    status: () => root()?.getAttribute('data-preview-status'),
    /** The screen-reader text of the pages on screen: the name of the résumé they show. */
    shown: () => all().find((el) => el.getAttribute('id') === base.textId)?.textContent ?? '',
    /** The canvases on screen. */
    onScreen: () => all().filter((el) => el.tagName === 'CANVAS'),
    alert: () => all().find((el) => el.getAttribute('role') === 'alert'),
    retry: () => {
      const button = all().find((el) => el.tagName === 'BUTTON' && el.textContent === 'Retry');
      view.act(() => reactProps(button).onClick());
    },
  };
}

/** Past the typing debounce: the change's build has started. */
export const pause = () => wait(DEBOUNCE_MS + 50);
/** `n` versions of one résumé, told apart by name — the text the fake pdf.js shows. */
export const versions = (n) => Array.from({ length: n }, (_, i) => resume({ personal: { name: `Pat v${i}` } }));
export const name = (v) => v.personal.name;
export const size = (canvas) => [canvas.width, canvas.height];

/**
 * Unmount, but leave the fake page's window and document in place as a browser does: a render
 * still in flight runs on after the preview is gone. `restore()` removes them.
 */
export async function unmountLeavingPage(view) {
  await view.unmount();
  Object.assign(globalThis, { window: view.window, document: view.document });
  return () => { delete globalThis.window; delete globalThis.document; };
}

/** Open the preview on `v0` and let its first render finish. */
export async function opened(v0, props = {}) {
  const { calls, build } = heldBuild();
  const p = await preview({ render: build, input: v0, ...props });
  await settle();
  calls[0].finish();
  await settle();
  assert.equal(p.shown(), name(v0), 'the first render is on screen');
  return { ...p, calls, build };
}
