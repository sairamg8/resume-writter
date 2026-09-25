// The panels the walker uses, mounted as the editor mounts them, for one template (and its layout
// variant: the Sidebar's "Single · ATS-safe" prints another page, so its controls are walked on it
// too). Each panel's store actions are spies that record a write; the context writes the walker
// passes are applied to the résumé first (store.mjs), exactly as the store would have.
import { Component, createElement } from 'react';
import { TEMPLATE_IDS } from '../../../src/constants/templates.js';
import { walkPanel, loadPanels } from './walker.mjs';
import { baseResume, applyWrites, loadStore, SECTION_TYPES } from './store.mjs';

/** Renders its child, or the error it threw: a control that crashes the panel is a failure, not a hang. */
class Crash extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch() {}
  render() { return this.state.error ? createElement('p', { 'data-crash': '' }, `crashed: ${this.state.error.message}`) : this.props.children; }
}
const guarded = (C) => function Guarded(props) { return createElement(Crash, null, createElement(C, props)); };

/** Text a probe typed into a content field (a name, an e-mail): content, not a design control. */
const isContent = (w) => w.kind === 'personal' && w.key !== 'photo';

/**
 * What each panel offers on `variant` ({ id, template, settings }): { design, personal, sections }
 * — lists of actions { sig, name, writes, context }, sections by section type.
 */
export async function walkVariant(variant) {
  await loadStore();
  const P = await loadPanels();
  const base = () => baseResume(variant.template, variant.settings);
  const at = (context) => applyWrites(base(), context, null);
  const setting = (spy) => (key, value) => spy({ kind: 'setting', key, value });
  const keep = (actions) => actions.filter((a) => !a.writes.every(isContent));

  const design = keep(walkPanel((spy, ctx) => {
    const r = at(ctx);
    return [guarded(P.DesignPanel), {
      resume: r, updateSetting: setting(spy),
      // A design (R2-138) is picked as its engine and its id: a write of its own.
      setTemplate: (value, preset) => spy(preset ? { kind: 'preset', value: preset } : { kind: 'template', value }),
      resetSettings: () => spy({ kind: 'resetAll' }),
    }];
  }));
  const personal = keep(walkPanel((spy, ctx) => {
    const r = at(ctx);
    return [guarded(P.PersonalInfoEditor), {
      personal: r.personal, settings: r.settings, template: r.template, coverLetter: r.coverLetter,
      updatePersonal: (key, value) => spy({ kind: 'personal', key, value }),
      toggleFieldVisibility: (key) => spy({ kind: 'hide', key }),
      updateSetting: setting(spy),
      clearSettings: (keys) => spy({ kind: 'clear', keys: [...keys] }),
    }];
  }));
  const sections = {};
  for (const type of SECTION_TYPES) {
    const id = `sec_${type}`;
    sections[type] = walkPanel((spy, ctx) => {
      const r = applyWrites(base(), ctx, id);
      return [guarded(P.SectionCustomizer), {
        section: r.sections.find((s) => s.id === id), template: r.template, settings: r.settings,
        updateSectionSettings: (sectionId, key, value) => spy({ kind: 'section', key, value, sectionId }),
      }];
    });
  }
  return { design, personal, sections };
}

/**
 * Every template the app offers, plus each layout variant its Design panel offers (a Layout control,
 * `sidebarSingleColumn`, found by walking — not assumed), each walked: { variants, walks: { [id] } }.
 */
export async function walkAll() {
  const variants = [];
  const walks = {};
  for (const id of TEMPLATE_IDS) {
    const plain = { id, template: id, settings: {} };
    variants.push(plain);
    walks[id] = await walkVariant(plain);
    const layout = walks[id].design.find((a) => a.writes.length === 1 && a.writes[0].kind === 'setting'
      && a.writes[0].key === 'sidebarSingleColumn' && a.writes[0].value === true);
    if (layout) {
      const single = { id: `${id}+single`, template: id, settings: { sidebarSingleColumn: true } };
      variants.push(single);
      walks[single.id] = await walkVariant(single);
    }
  }
  return { variants, walks };
}
