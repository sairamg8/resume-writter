import { templateId } from '@/constants/templates';
import { presetOf } from '@/constants/templatePresets';
import { cardSelected } from '@/utils/templatePicker';
import { designSnapshot } from '@/utils/templateSwitch';
import { useToast } from '@/components/ui/Toast';

/**
 * Picking a card of Design → Template's (utils/templatePicker.js), in the panel or the gallery: the
 * template or design through the store as before (setTemplate(engine[, preset]); a design the user saved
 * through applyDesign), the Layout the card sets (updateSetting), and a notice with Undo (A4) that puts
 * back the look the résumé had — its template, settings and sections' settings as a pair, since unset
 * colours and entry layouts print per template. The card the résumé is on already is no switch (R2-087).
 * Without restoreDesign (the tests' spies) there is no Undo, and outside a ToastProvider no notice.
 */
export function usePickCard(resume, { setTemplate, updateSetting, applyDesign, restoreDesign }) {
  const { toast } = useToast();
  const settings = resume.settings || {};
  const current = templateId(resume.template);
  const activePreset = presetOf(settings, current)?.id || '';
  const selected = (c) => cardSelected(c, current, activePreset, settings);

  function pick(c) {
    if (selected(c)) return;
    const before = designSnapshot(resume);
    if (c.own) applyDesign?.(c.design);
    else if (current !== c.engine || activePreset !== c.preset) {
      if (c.preset) setTemplate(c.engine, c.preset);
      else setTemplate(c.engine);
    }
    for (const [key, value] of Object.entries(c.variant || {})) {
      if (Boolean(settings[key]) !== value) updateSetting(key, value);
    }
    toast({
      id: 'template-switch',
      title: `Template: ${c.label}`,
      description: 'Your content is kept.',
      duration: 8000,
      ...(restoreDesign ? { action: { label: 'Undo', onClick: () => restoreDesign(before) } } : {}),
    });
  }

  return { pick, selected };
}
