import { Dialog } from './Dialog.jsx';
import { Kbd } from './Kbd.jsx';

/**
 * The "?" help: every keyboard shortcut of the page, grouped.
 *
 * - `open`, `onClose`; `groups`: `[{ title, shortcuts: [{ combo, label }] }]` — `combo` as
 *   useHotkeys writes it ('c', '/', 'mod+Enter', 'Escape').
 *
 *     useHotkeys({ '?': () => setHelpOpen(true) });
 *     <ShortcutsDialog open={helpOpen} onClose={() => setHelpOpen(false)} groups={[…]} />
 */
export function ShortcutsDialog({ open, onClose, groups = [], title = 'Keyboard shortcuts' }) {
  return (
    <Dialog open={open} onClose={onClose} title={title} size="md" sheet>
      <div className="flex flex-col gap-5">
        {groups.map((group) => (
          <section key={group.title}>
            <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{group.title}</h3>
            <dl className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {group.shortcuts.map((s) => (
                <div key={s.combo} className="flex items-center justify-between gap-4 px-3 py-2">
                  <dt className="text-[13px] text-slate-700">{s.label}</dt>
                  <dd><Kbd combo={s.combo} /></dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Dialog>
  );
}
