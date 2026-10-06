import { memo } from 'react';
import { User, Mail as MailIcon } from 'lucide-react';

const BUTTON = 'flex-1 min-w-0 flex items-center justify-center gap-1 sm:gap-1.5 py-1.5 px-2 sm:px-2.5 rounded-cv-control text-xs font-semibold transition-colors whitespace-nowrap';
const ON = 'bg-cv-surface text-cv-ink shadow-sm';
const OFF = 'text-cv-muted hover:text-cv-ink';

/**
 * The document switch: Resume | Cover Letter, two buttons and no more. `doc` is the open document
 * ('resume' or 'coverletter', useEditorTab); `onPick(doc)` is the Editor's stable picker (a keystroke
 * must not render the switch, PERF-4: it takes the document and that callback, no router hook, no link).
 * The preview and the Export menu follow the document that is open; Design and ATS are docks beside it,
 * not documents, so they are not here.
 */
export const EditorDocSwitch = memo(function EditorDocSwitch({ doc, onPick }) {
  return (
    <div className="order-5 xl:order-20 flex gap-1 flex-1 md:max-w-80 xl:max-w-none xl:flex-none xl:w-60 min-w-0 max-md:min-h-[44px] bg-cv-sunken rounded-cv-control p-1">
      <button onClick={() => onPick('resume')} data-testid="doc-switch-resume" className={`${BUTTON} ${doc === 'resume' ? ON : OFF}`}>
        <User size={13} className="shrink-0" /> <span className="min-w-0 truncate">Resume</span>
      </button>
      <button onClick={() => onPick('coverletter')} data-testid="doc-switch-letter" className={`${BUTTON} ${doc === 'coverletter' ? ON : OFF}`}>
        <MailIcon size={13} className="shrink-0" /> <span className="min-w-0 truncate">Cover Letter</span>
      </button>
    </div>
  );
});
