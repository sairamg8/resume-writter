// The editor's controls, found by USING the editor — not listed by hand. Each panel that styles the
// résumé (Design, Personal Info's Header Customization and Photo, a section's Section Options) is
// mounted in the fake DOM with spies for its store actions; every button is clicked and every input
// is fed probe values, and each one's writes are recorded as an action. Number inputs are probed
// with -9999 and 99999, which their own clamping turns into the range they offer, and then with the
// middle of it. Anything that opens a panel (a section's header, "Header Customization", a
// confirm step) is found the same way: a click that writes nothing and adds elements is kept open.
// Controls that only show in some state (Photo → Height for a square photo, a border's thickness
// once it is on, a Bullet style's gap) are found one step deep: each action's patch is applied and
// the panel re-walked for elements it did not show before. The parity matrix (tests/pdf/parity/*)
// renders every action this finds, so a control added to a panel is in the matrix by construction,
// and 00-registry pins the setting keys so a new one without a measure fails.
import { createElement } from 'react';
import { mount, elements, reactProps } from '../fake-dom.mjs';
import { loadModule } from '../harness.mjs';

/** An event a handler can read: the value a probe types, and no-op propagation calls. */
const evt = (value = '') => {
  const target = { value, files: null, blur() {}, select() {} };
  return { target, currentTarget: target, key: '', stopPropagation() {}, preventDefault() {} };
};
const PROBE_COLOR = '#1a7f5a';
const GRID_SAMPLE = 16;

/** An input's type: React sets it as a property, not an attribute. */
const typeOf = (el) => el.type || el.getAttribute('type') || '';

/** Text a person reads for `el`: its own text, title or aria-label, or the label it points at. */
function nameOf(el, byId) {
  const own = el.textContent.replace(/\s+/g, ' ').trim().slice(0, 40);
  const by = el.getAttribute('aria-labelledby');
  return own || el.getAttribute('aria-label') || el.getAttribute('title') || (by && byId.get(by)) || '';
}

/** The data-* attributes of `el`'s nearest ancestors: a header-spacing row's key (data-gap) tells two "Name ↔ Title" rows apart. */
function dataOf(el) {
  const out = [];
  for (let n = el.parentNode, i = 0; n && n.attributes && i < 3; n = n.parentNode, i += 1) {
    for (const [k, v] of n.attributes) if (k.startsWith('data-') && k !== 'data-testid') out.push(`${k}=${v}`);
  }
  return out.join(',');
}

/** Every element a person can use, each with a signature that finds it again after a remount. */
function controls(container) {
  const all = [...elements(container)];
  const byId = new Map(all.filter((el) => el.getAttribute('id')).map((el) => [el.getAttribute('id'), el.textContent.trim()]));
  const seen = new Map();
  const out = [];
  for (const el of all) {
    const p = reactProps(el);
    if (!p || !['BUTTON', 'INPUT', 'SELECT'].includes(el.tagName)) continue;
    if (p.disabled) continue;
    const base = `${el.tagName}|${typeOf(el)}|${nameOf(el, byId)}|${dataOf(el)}`;
    const n = seen.get(base) || 0;
    seen.set(base, n + 1);
    out.push({ el, sig: `${base}#${n}`, name: nameOf(el, byId), props: p });
  }
  return out;
}

/**
 * One panel, walked. `render(spy)` → [Component, props] for a spy that records writes. Returns
 * { actions, sigs, openers }: each action { sig, name, writes } with at least one write, the
 * signatures of every control the opened panel shows, and the clicks that opened it. `openers`
 * given: replayed instead of found again; `onlyNew`: signatures to leave alone (walked already).
 */
function walkOnce(render, { openers: given = null, onlyNew = null } = {}) {
  let writes = [];
  const spy = (w) => writes.push(w);
  const [Component, props] = render(spy);
  let view = mount(Component, props);
  const count = () => [...elements(view.container)].length;
  const sigsNow = () => controls(view.container).map((c) => c.sig).join('\n');
  const openers = given ? [...given] : [];
  const replay = () => {
    view.unmount();
    view = mount(Component, props);
    for (const sig of openers) {
      const c = controls(view.container).find((x) => x.sig === sig);
      if (c) view.act(() => c.props.onClick(evt()));
    }
    writes = [];
  };
  if (given) replay();
  // Open everything: a click that writes nothing and shows more elements stays; one that hides some is undone.
  const tried = new Set();
  for (let changed = !given; changed;) {
    changed = false;
    for (const c of controls(view.container)) {
      if (tried.has(c.sig) || c.el.tagName !== 'BUTTON' || !c.props.onClick) continue;
      tried.add(c.sig);
      const before = count();
      const layout = sigsNow();
      writes = [];
      view.act(() => c.props.onClick(evt()));
      if (!writes.length && count() > before) { openers.push(c.sig); changed = true; break; }
      // A remount leaves this loop's elements stale: start again over the fresh ones.
      if (sigsNow() !== layout || count() !== before) { replay(); changed = true; break; }
    }
  }
  const actions = [];
  let all = controls(view.container);
  const sigs = new Set(all.map((c) => c.sig));
  if (onlyNew && all.every((c) => onlyNew.has(c.sig))) { view.unmount(); return { actions, sigs, openers }; }
  let bySig = new Map(all.map((c) => [c.sig, c.el]));
  // Spies change no props, so a click only changes the panel through its own state (a confirm step,
  // an error line): then it is remounted, and the controls found again by signature.
  const fire = (sig, how) => {
    const el = bySig.get(sig);
    if (!el) return;
    const before = count();
    writes = [];
    view.act(() => how({ el, props: reactProps(el) }));
    if (writes.length) actions.push({ sig, name: nameOf(el, new Map()), writes });
    if (count() !== before) {
      replay();
      bySig = new Map(controls(view.container).map((c) => [c.sig, c.el]));
    }
    writes = [];
  };
  // A grid of like choices (the icon picker's hundreds of icons) is sampled: the first GRID_SAMPLE
  // buttons of one parent. Every design grid (8 accents, 13 fonts, 6 heading styles) is under it.
  const perParent = new Map();
  for (const { sig, el, props: p } of all) {
    if (onlyNew && onlyNew.has(sig)) continue;
    const type = typeOf(el);
    if (el.tagName === 'BUTTON' && p.onClick) {
      const n = perParent.get(el.parentNode) || 0;
      if (n >= GRID_SAMPLE) continue;
      perParent.set(el.parentNode, n + 1);
      fire(sig, (c) => c.props.onClick(evt()));
    }
    else if (el.tagName === 'SELECT') {
      for (const o of el.options) fire(sig, (c) => c.props.onChange(evt(o.getAttribute('value') ?? o.textContent)));
    } else if (type === 'color') fire(sig, (c) => c.props.onChange(evt(PROBE_COLOR)));
    else if (type === 'file') continue; // uploads: a real file, not a probe (tests/pdf/16-photos, 39)
    else probeNumber(sig, el, p, fire);
  }
  view.unmount();
  all = null;
  return { actions, sigs, openers };
}

/** A number input: its clamp turns -9999 and 99999 into its range; then the middle of it. */
function probeNumber(sig, el, p, fire) {
  const handler = p.onBlur ? 'onBlur' : p.onChange ? 'onChange' : null;
  if (!handler) return;
  const typed = [];
  const put = (v) => fire(sig, (c) => {
    // A stepper's text box commits what was typed on blur; a number box on change.
    if (handler === 'onBlur') c.props.onFocus?.(evt(v));
    c.props[handler](evt(String(v)));
    typed.push(v);
  });
  const attrMin = Number(el.getAttribute('min'));
  const attrMax = Number(el.getAttribute('max'));
  if (typeOf(el) === 'number' && Number.isFinite(attrMin) && Number.isFinite(attrMax) && el.hasAttribute('min')) {
    for (const v of [attrMin, attrMax, Math.round((attrMin + attrMax) / 2)]) put(v);
    return;
  }
  put(-9999);
  put(99999);
  void typed;
}

/** The middle of each numeric range the probes found, as a follow-up action for the same control. */
function withMiddles(render, walked) {
  const bySig = new Map();
  for (const a of walked.actions) {
    for (const w of a.writes) {
      if (typeof w.value !== 'number') continue;
      const k = `${a.sig}|${w.kind}|${w.key}`;
      // The write itself is kept: a Section Options write names its section (sectionId).
      const r = bySig.get(k) || { sig: a.sig, name: a.name, write: w, values: new Set() };
      r.values.add(w.value);
      bySig.set(k, r);
    }
  }
  const extra = [];
  for (const r of bySig.values()) {
    if (r.values.size < 2) continue;
    const lo = Math.min(...r.values);
    const hi = Math.max(...r.values);
    const step = Number.isInteger(lo) && Number.isInteger(hi) ? 1 : 0.1;
    const mid = Math.round(((lo + hi) / 2) / step) * step;
    const v = step < 1 ? Math.round(mid * 10) / 10 : mid;
    if (v !== lo && v !== hi) extra.push({ sig: r.sig, name: r.name, writes: [{ ...r.write, value: v }], middle: true });
  }
  void render;
  return extra;
}

/** An action's patch key: what it writes, for grouping actions into controls. */
export const writeKey = (w) => (w.kind === 'setting' || w.kind === 'section' ? `${w.kind}.${w.key}`
  : w.kind === 'hide' ? `hide.${w.key}` : w.kind);

/**
 * Walk a panel, then one step deeper: each action that sets a value is applied as the panel's state,
 * and the controls it reveals are walked in that state (`context`: the writes that revealed them).
 */
export function walkPanel(renderWith) {
  const top = walkOnce((spy) => renderWith(spy, []));
  const actions = [...top.actions, ...withMiddles(null, top)].map((a) => ({ ...a, context: [] }));
  // A context action counts once per distinct write: a pack's button reads "Selected" when it is the
  // active one, so the same control can come back under a new signature.
  const seen = new Set(actions.map((a) => JSON.stringify(a.writes)));
  const contexts = new Map();
  // The states worth walking again: one choice (an option, a toggle, the custom colour), not a number
  // (a size or a gap reveals no control) and not every preset colour (the custom one reveals its ↺).
  const revealing = (w) => (w.kind === 'setting' || w.kind === 'section') && ['string', 'boolean'].includes(typeof w.value)
    && !(typeof w.value === 'string' && /^#[0-9a-f]{6}$/i.test(w.value) && w.value !== PROBE_COLOR);
  for (const a of top.actions) {
    if (a.writes.length !== 1 || !revealing(a.writes[0])) continue;
    contexts.set(JSON.stringify(a.writes), a.writes);
  }
  for (const writes of contexts.values()) {
    const deeper = walkOnce((spy) => renderWith(spy, writes), { openers: top.openers, onlyNew: top.sigs });
    for (const a of [...deeper.actions, ...withMiddles(null, deeper)]) {
      const id = JSON.stringify(a.writes);
      if (seen.has(id)) continue;
      seen.add(id);
      actions.push({ ...a, context: writes });
    }
  }
  return actions;
}

export { evt, PROBE_COLOR };
export const loadPanels = async () => ({
  DesignPanel: (await loadModule('/src/components/DesignPanel.jsx')).default,
  PersonalInfoEditor: (await loadModule('/src/components/PersonalInfoEditor.jsx')).default,
  SectionCustomizer: (await loadModule('/src/components/SectionEditorCustomizer.jsx')).SectionCustomizer,
});
export { createElement };
