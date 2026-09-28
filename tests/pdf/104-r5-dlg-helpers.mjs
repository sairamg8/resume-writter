// Shared by the R5 dialog tests (104-r5-dlg-*) and the older tests that mount the four dialogs moved
// onto the kit's Dialog (the Smart Cover Letter Generator, the Header Icon picker, New Cover Letter and
// Share a public link). The kit's Dialog renders in a portal at the end of <body> — beside the mount's
// container, not in it — and looks its first focus up with querySelector: so patchFakeDom first, and
// every lookup starts at <body>. The fake DOM has no layout: the tests read the classes the layout is
// made of.
import { loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';
import { patchFakeDom } from '../unit/ui-dom-harness.mjs';

/** `el`'s class tokens. */
export const classes = (el) => (el?.getAttribute('class') || '').split(/\s+/).filter(Boolean);

/** An element's text, its whitespace collapsed. */
export const label = (el) => el.textContent.replace(/\s+/g, ' ').trim();

/** Every element on `view`'s page, the portal's included. */
export const onPage = (view) => [...elements(view.document.body)];

/** The page's open dialog panel (role="dialog", not one animating out), or null. */
export const openDialog = (view) => onPage(view).find((el) => el.getAttribute('role') === 'dialog' && el.getAttribute('data-state') !== 'closed') ?? null;

/** Waits (up to 2 s) until `done()` holds, letting timers and React's scheduler run. */
export async function until(view, done) {
  for (const end = Date.now() + 2000; !done() && Date.now() < end;) {
    await new Promise((r) => { setTimeout(r, 10); });
    view.act(() => {});
  }
}

/**
 * A key pressed with focus on `from`, as React delivers it: every onKeyDown from there up to the page,
 * nearest first, until one stops it. `extra` adds to the event (isComposing, keyCode). Returns how
 * many handlers it reached.
 */
export function pressKey(view, from, key, extra = {}) {
  const event = {
    key, target: from, defaultPrevented: false, propagationStopped: false, nativeEvent: {}, ...extra,
    preventDefault() { this.defaultPrevented = true; },
    stopPropagation() { this.propagationStopped = true; },
  };
  let reached = 0;
  for (let n = from; n && !event.propagationStopped; n = n.parentNode) {
    const handler = reactProps(n)?.onKeyDown;
    if (!handler) continue;
    reached += 1;
    view.act(() => handler({ ...event, currentTarget: n, preventDefault: () => event.preventDefault(), stopPropagation: () => event.stopPropagation() }));
  }
  return reached;
}

/**
 * The modal at `path` (its default export) mounted open with `props` over the fake DOM: `all()` every
 * element on the page, `find(tag, text)` the first `tag` whose text is `text`, `dialog()` the open
 * panel, `closes()` how many times onClose was called, `unmount()`.
 */
export async function openModal(path, props = {}) {
  patchFakeDom();
  const { default: Modal } = await loadModule(path);
  let closes = 0;
  const view = mount(Modal, { isOpen: true, onClose: () => { closes += 1; }, ...props });
  const all = () => onPage(view);
  return {
    view,
    all,
    find: (tag, text) => all().find((el) => el.tagName === tag && label(el) === text),
    dialog: () => openDialog(view),
    closes: () => closes,
    unmount: () => view.unmount(),
  };
}

/**
 * The text fields among `fields` that would be under 16 px on a touch screen (iOS zooms into those):
 * a field passes with `pointer-coarse:text-base`, or with an unprefixed `text-base` that no
 * breakpoint shrinks. Returns each one's placeholder, aria-label or tag.
 */
export function under16OnTouch(fields) {
  return fields.filter((el) => {
    const cls = el.getAttribute('class') ?? '';
    if (/(^|\s)pointer-coarse:text-base(\s|$)/.test(cls)) return false;
    return !(/(^|\s)text-base(\s|$)/.test(cls) && !/(^|\s)(sm|md|lg|xl|2xl):text-(xs|sm|\[)/.test(cls));
  }).map((el) => el.getAttribute('placeholder') || el.getAttribute('aria-label') || el.tagName);
}

/** The typeable text fields among `els` (not a file, hidden, checkbox or radio input). */
export const textFields = (els) => els.filter((el) => ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)
  && !['file', 'hidden', 'checkbox', 'radio'].includes(el.getAttribute('type') ?? el.type));
