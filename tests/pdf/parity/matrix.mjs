// The parity matrix's engine. The walk (walk-cache.mjs) lists every action each panel offers on each
// template; here they are grouped into controls — the actions writing the same keys in the same state —
// and each control is rendered at every value it offers, from the state the panel offered it in. What
// every control must do, whatever it is (its own effect is registry.mjs's):
//   effect   two different stored values print two different PDFs; a one-value control (a toggle,
//            an eye, a ↺) prints differently from the state it was clicked in — offered and inert
//            is a defect
//   text     nothing the résumé holds goes missing (MARKS), unless hiding it is the control's job
//   layout   no two text runs overlap that did not overlap before the click
//   reset    a reset prints what the same reset prints from the template's defaults, whatever was
//            customised first
import { render } from '../harness.mjs';
import { snapshot, prints, overlapping } from './measure.mjs';
import { applyWrites, aroundTypes, baseResume, marksOf } from './store.mjs';
import { writeKey, PROBE_COLOR } from './walker.mjs';

const shots = new Map();
/** `r` rendered and measured, once per distinct résumé per process. */
export function shot(r) {
  const key = JSON.stringify(r);
  if (!shots.has(key)) shots.set(key, render(r).then(async (bytes) => ({ bytes, ...(await snapshot(bytes)) })));
  return shots.get(key);
}
/** Frees the renders kept so far (between templates: a file keeps hundreds otherwise). */
export const forget = () => shots.clear();

const sectionOf = (w) => (w.kind === 'section' ? w.sectionId : null);
const noValue = (w) => w.value === '' || w.value === undefined || w.value === null;
/** A reset: the Design ↺s (keys back to defaults), Reset Design Settings, header spacing's Reset, a ↺ that clears one value. */
export const isReset = (a) => a.writes.some((w) => w.kind === 'resetAll' || w.kind === 'clear')
  || /reset|↺/i.test(a.name) || (a.writes.every(noValue) && a.writes.every((w) => w.kind === 'setting' || w.kind === 'section'));

/**
 * One panel's actions as controls: { id, keys, context, actions, reset, sectionId }. A Section Options
 * control is per section (its writes name the section).
 */
export function controlsOf(actions) {
  const by = new Map();
  for (const a of actions) {
    const reset = isReset(a);
    const keys = a.writes.map(writeKey);
    const sectionId = a.writes.map(sectionOf).find(Boolean) || a.context.map(sectionOf).find(Boolean) || null;
    const id = `${reset ? 'reset ' : ''}${keys.join(' + ')}${a.context.length ? ` [after ${a.context.map((w) => `${w.key}=${JSON.stringify(w.value)}`).join(', ')}]` : ''}${reset ? ` (${a.name})` : ''}`;
    const k = `${sectionId}|${id}`;
    if (!by.has(k)) by.set(k, { id, keys, context: a.context, actions: [], reset, sectionId });
    const c = by.get(k);
    if (!c.actions.some((x) => JSON.stringify(x.writes) === JSON.stringify(a.writes))) c.actions.push(a);
  }
  return [...by.values()].map(sample);
}

/**
 * A numeric control is tried at its smallest, largest and middle value (a stepper's −/+ land between
 * them); a grid of like choices past the design panel's own (the icon picker's icons) at three.
 */
function sample(c) {
  if (c.reset || c.actions.length <= 3) return c;
  const vals = c.actions.map((a) => a.writes[0].value);
  if (vals.every((v) => typeof v === 'number')) {
    const [lo, hi] = [Math.min(...vals), Math.max(...vals)];
    const mid = vals.reduce((m, v) => (Math.abs(v - (lo + hi) / 2) < Math.abs(m - (lo + hi) / 2) ? v : m), lo);
    return { ...c, actions: c.actions.filter((a, i) => [lo, hi, mid].includes(vals[i]) && vals.indexOf(vals[i]) === i) };
  }
  if (vals.every((v) => v && typeof v === 'object')) return { ...c, actions: c.actions.slice(0, 3) };
  return c;
}

/** What a value looks like in a test name. */
export const show = (a) => a.writes.map((w) => (w.kind === 'hide' ? `hide ${w.key}` : w.kind === 'resetAll' ? 'Reset Design Settings'
  : w.kind === 'clear' ? `clear ${w.keys.join(',')}` : JSON.stringify(w.value ?? null))).join(', ');

/**
 * Run one control on `variant`. `spec(key)` → the registry entry of a write key. Returns the failures,
 * each a line naming the value. `customise(key)`: a non-default write for a key, for resets.
 */
export async function checkControl(variant, control, { spec, customise }) {
  const fail = [];
  // A section's options are tried on its own page of three (aroundTypes); the rest on the compact page.
  const types = control.sectionId ? aroundTypes(variant.template, variant.settings, control.sectionId.replace(/^sec_/, '')) : null;
  const base = baseResume(variant.template, variant.settings, { compact: !types, types });
  const before = applyWrites(base, control.context, control.sectionId);
  const b = await shot(before);
  if (control.reset) return checkReset(variant, control, { base, before, b, customise, fail });
  const runs = [];
  for (const a of control.actions) {
    const state = applyWrites(before, a.writes, control.sectionId);
    runs.push({ action: a, value: a.writes[0].value, writes: a.writes, state, snap: await shot(state) });
  }
  // effect
  const distinct = runs.filter((r, i) => runs.findIndex((x) => JSON.stringify(x.state) === JSON.stringify(r.state)) === i);
  if (distinct.length === 1) {
    const [r] = distinct;
    if (JSON.stringify(r.state) !== JSON.stringify(before) && r.snap.drawing === b.drawing) fail.push(`${show(r.action)}: the PDF is the same as before the click — the control does nothing here`);
  }
  for (let i = 0; i < distinct.length; i += 1) {
    for (let j = i + 1; j < distinct.length; j += 1) {
      if (distinct[i].snap.drawing === distinct[j].snap.drawing) fail.push(`${show(distinct[i].action)} and ${show(distinct[j].action)} print the same PDF`);
    }
  }
  for (const r of runs) {
    const hidden = new Set(r.writes.flatMap((w) => spec(writeKey(w))?.hides?.(w, variant) || []));
    for (const m of marksOf(before)) if (!hidden.has(m) && !prints(r.snap, m)) fail.push(`${show(r.action)}: "${m}" no longer prints`);
    const was = new Set(overlapping(b));
    for (const o of overlapping(r.snap)) if (!was.has(o)) fail.push(`${show(r.action)}: text overlaps — ${o}`);
  }
  for (const key of new Set(control.keys)) {
    const s = spec(key);
    if (s?.check) fail.push(...(await s.check({ variant, control, runs, before: { state: before, snap: b }, key })).map((e) => `${key}: ${e}`));
  }
  return fail;
}

async function checkReset(variant, control, { base, before, b, customise, fail }) {
  for (const a of control.actions) {
    // Customise what the reset puts back (unless the state it was offered in already did), then reset.
    const extra = control.context.length ? [] : a.writes.flatMap((w) => (w.kind === 'resetAll' ? customise('*') : w.kind === 'clear' ? w.keys.flatMap((k) => customise(`setting.${k}`)) : customise(writeKey(w))));
    const custom = applyWrites(before, extra, control.sectionId);
    const c = await shot(custom);
    const after = await shot(applyWrites(custom, a.writes, control.sectionId));
    const fresh = await shot(applyWrites(base, a.writes, control.sectionId));
    if (after.drawing !== fresh.drawing) fail.push(`${show(a)} after customising does not print what it prints from the template's defaults`);
    if (c.drawing === after.drawing && JSON.stringify(custom) !== JSON.stringify(applyWrites(custom, a.writes, control.sectionId))) {
      fail.push(`${show(a)} changes the stored settings but not the PDF — it resets nothing that prints`);
    }
  }
  void b;
  return fail;
}

/** For resets: one offered non-default write per key, from the variant's own controls ('*': every key's). */
export function customiser(controls) {
  const pick = new Map();
  for (const c of controls) {
    if (c.reset || c.context.length || c.keys.length !== 1) continue;
    const [key] = c.keys;
    if (!key.startsWith('setting.') || pick.has(key)) continue;
    const vals = c.actions.map((a) => a.writes[0]);
    const w = vals.find((x) => x.value === PROBE_COLOR) || vals[vals.length - 1];
    if (w) pick.set(key, w);
  }
  return (key) => (key === '*' ? [...pick.values()] : pick.has(key) ? [pick.get(key)] : []);
}
