import { useState } from 'react';
import {
  CheckCircle2, AlertTriangle, ArrowRight,
  TrendingUp, Copy, Check, Zap, Wand2
} from 'lucide-react';
import { Button, buttonClass } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import {
  analyzeBullet,
  autoFixWeakPhrases,
  insertActionVerb,
  insertMetric,
  opensWithAuxiliary,
  opensWithVerbWith,
  ACTION_VERBS_BY_CATEGORY,
  GOOGLE_XYZ_TEMPLATES
} from '@/utils/bulletOptimizer';
import { copyText } from '@/utils/clipboard';

// The "[X]%" / "[feature/system]" slots of the templates. Only these count: a bracket the user wrote
// themselves ("[Confidential]") is their text.
const PLACEHOLDERS = new Set(GOOGLE_XYZ_TEMPLATES.flatMap((t) => t.template.match(/\[[^\]]+\]/g) ?? []));

/** The template slots still in `text`, in order, once each. */
const unfilledSlots = (text) => [...new Set((text.match(/\[[^\]]+\]/g) ?? []).filter((slot) => PLACEHOLDERS.has(slot)))];

export default function BulletOptimizerModal({ isOpen, onClose, initialText = '', onApply }) {
  const [text, setText] = useState(initialText);
  const [activeCategory, setActiveCategory] = useState('Technical & Engineering');
  // Copy's outcome, shown on the button for a moment: 'done', 'failed' or null.
  const [copied, setCopied] = useState(null);
  // The statement as it was before a template replaced it, for "Restore my statement" (R4-DUX-22); null
  // when there is nothing to restore. A template is full of placeholders ("[X]%", "[feature/system]"), so
  // the text is always edited next: the saved statement stays through typing, Auto-Fix and the chips
  // (dropping it on the first keystroke left Cancel, and the whole session with it, as the only way
  // back), and through further template picks (it is the user's own text that comes back). It goes once
  // it is restored, or once the text is that statement again; Apply and closing unmount the modal.
  const [beforeTemplate, setBeforeTemplate] = useState(null);
  // A power verb was picked for a statement that opens with "Did not…", "Was…" or "Never…": no verb
  // can go before those words, so the text is left alone and a tip asks for a rewrite (R4-SW-WT-04).
  // The verb picked: "Worked with…" takes "Partnered" after "Spearheaded" was refused
  // (R5-HUNT11-VERB-CHIP-ON-WORKED-WITH), and the tip goes when the statement takes it.
  const [verbBlocked, setVerbBlocked] = useState(null);

  if (!isOpen) return null;

  const analysis = analyzeBullet(text);
  // A template written into the résumé as it stands would print its slots ("by [X]%"): Apply waits until they are filled.
  const unfilled = unfilledSlots(text);
  const { score, hasActionVerb, hasMetric, weakPhrases, suggestions } = analysis;

  /**
   * Any change but a template (typing, Auto-Fix, a chip): `next` is the new text, or a function of the
   * current one. The saved statement is kept for restoring, unless the text is that statement again.
   */
  function editText(next) {
    const value = typeof next === 'function' ? next(text) : next;
    setText(value);
    if (value === beforeTemplate) setBeforeTemplate(null);
  }

  function handleAutoFix() {
    editText(autoFixWeakPhrases(text));
  }

  // The verb in place of a leading verb or weak phrase, else before the first word; the metric before
  // the closing full stop (R4-CL-07, R4-CL-08).
  function handleInsertVerb(verb) {
    if (opensWithAuxiliary(text, verb)) {
      setVerbBlocked(verb);
      return;
    }
    // A verb that went in answers the tip ("Partnered" on "Worked with…").
    setVerbBlocked(null);
    editText(prev => insertActionVerb(prev, verb));
  }

  function handleInsertMetric(metricStr) {
    editText(prev => insertMetric(prev, metricStr));
  }

  // A template replaces the whole statement, so the text it replaced is kept for restoring.
  function handleInsertTemplate(tmpl) {
    if (tmpl === text) return;
    setBeforeTemplate(prev => (prev === null ? text : prev));
    setText(tmpl);
  }

  // Back to the user's own statement: the edits made to the template go, as the button says.
  function handleRestoreStatement() {
    setText(beforeTemplate);
    setBeforeTemplate(null);
  }

  function handleApply() {
    if (unfilled.length > 0) return;
    onApply(text);
    onClose();
  }

  /** Copy: says Copied, or Copy failed where the browser refuses the clipboard (R2-080). */
  function handleCopy() {
    copyText(text).then(() => 'done', () => 'failed').then((outcome) => {
      setCopied(outcome);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  const scoreColor = score >= 80
    ? 'text-cv-good bg-cv-good-soft border-cv-good'
    : score >= 60
    ? 'text-cv-brand-text bg-cv-brand-soft border-cv-brand-soft-border'
    : 'text-cv-warn bg-cv-warn-soft border-cv-warn';

  // The kit's Dialog, as the template gallery opened from the same editor is (R4-DVIS-07): drawn like
  // the workspace dialogs, in a portal over the page (so a faded or clipped parent never reaches it),
  // with the page behind held still. On a phone it fills the screen, its body scrolling between the
  // title and the action row (R4-DPH-37); the action row wraps rather than squeezing its buttons (R4-DPH-38).
  // A click beside the box closes it only while the statement is still the one it opened with: once
  // it is rewritten, a stray click must not throw the rewrite away (R4-DUX-09). Escape likewise: it is
  // pressed by reflex in a text field, and the kit's default closed a rewrite with one key (R5-OPT-01).
  // The Dialog still takes that Escape and ignores it here, rather than being told not to handle it:
  // unhandled, it went on to the dialog the editor sits in (an issue's), which closed instead.
  // Cancel and × always close it; Apply saves.
  return (
    <Dialog
      open
      onClose={(reason) => { if (reason !== 'escape' || text === initialText) onClose(); }}
      size="lg"
      title="Bullet Optimizer & STAR Formula"
      description="Transform weak descriptions into Google X-Y-Z high-impact achievements"
      closeOnOverlay={text === initialText}
      footer={(
        <>
          <button
            type="button"
            onClick={handleCopy}
            title={copied === 'failed' ? 'The browser did not allow copying to the clipboard. Select the text above and copy it with Ctrl+C (⌘C on a Mac).' : undefined}
            className={buttonClass({ variant: 'secondary', className: 'mr-auto' })}
          >
            {copied === 'done' && <><Check size={16} className="text-cv-good" /> Copied</>}
            {copied === 'failed' && <><AlertTriangle size={16} className="text-cv-bad" /> Copy failed</>}
            {!copied && <><Copy size={16} /> Copy</>}
          </button>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" rightIcon={ArrowRight} onClick={handleApply} disabled={!text.trim() || unfilled.length > 0} title={unfilled.length > 0 ? 'Fill in the bracketed slots first' : undefined}>Apply to Resume</Button>
        </>
      )}
    >
      <div className="space-y-4">
        {/* Current Text Area */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-cv-ink">Achievement Statement</label>
            <div className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${scoreColor} flex items-center gap-1`}>
              <TrendingUp size={12} />
              Quality: {score}/100
            </div>
          </div>
          {/* 16 px on a touch screen: iOS zooms the page into any smaller field it focuses (R4-DPH-30).
              A mouse keeps 12 px on a narrow window and 14 px from sm, as before. */}
          <textarea
            rows={3}
            value={text}
            onChange={e => editText(e.target.value)}
            placeholder="e.g. Engineered distributed cache system, reducing API latency by 45% for 2M+ active users."
            className="w-full text-xs sm:text-sm pointer-coarse:text-base p-3 border border-cv-hairline rounded-cv-card focus:outline-none focus:ring-2 focus:ring-cv-brand bg-cv-ground resize-none text-cv-ink"
          />
          {unfilled.length > 0 && (
            <p className="text-[11px] text-cv-warn">Type over {unfilled.join(' ')} with your own details to apply this.</p>
          )}
          {beforeTemplate !== null && (
            <div className="flex items-center justify-between gap-3 text-[11px] text-cv-muted">
              <span>Template applied: your statement was replaced.</span>
              <button
                onClick={handleRestoreStatement}
                title="Puts your statement back as it was before the template; changes made to the template are discarded."
                className="font-semibold text-cv-brand-text hover:text-cv-brand-pressed hover:underline shrink-0"
              >
                Restore my statement
              </button>
            </div>
          )}
        </div>

        {/* Quality Indicators & Fixes. Stacked on a phone: a third of its width is narrower than
            "Quantifiable", which ran through its tile's border (R4-DPH-41). */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          <div className={`p-2.5 rounded-cv-card border flex items-center gap-1.5 ${hasActionVerb ? 'bg-cv-good-soft border-cv-good text-cv-good' : 'bg-cv-warn-soft border-cv-warn text-cv-warn'}`}>
            {hasActionVerb ? <CheckCircle2 size={14} className="text-cv-good shrink-0" /> : <AlertTriangle size={14} className="text-cv-warn shrink-0" />}
            <span className="font-semibold">{hasActionVerb ? 'Strong Action Verb' : 'Verb Missing'}</span>
          </div>
          <div className={`p-2.5 rounded-cv-card border flex items-center gap-1.5 ${hasMetric ? 'bg-cv-good-soft border-cv-good text-cv-good' : 'bg-cv-warn-soft border-cv-warn text-cv-warn'}`}>
            {hasMetric ? <CheckCircle2 size={14} className="text-cv-good shrink-0" /> : <AlertTriangle size={14} className="text-cv-warn shrink-0" />}
            <span className="font-semibold">{hasMetric ? 'Quantifiable Metric' : 'Metric Missing'}</span>
          </div>
          <div className={`p-2.5 rounded-cv-card border flex items-center gap-1.5 ${weakPhrases.length === 0 ? 'bg-cv-good-soft border-cv-good text-cv-good' : 'bg-cv-bad-soft border-cv-bad text-cv-bad'}`}>
            {weakPhrases.length === 0 ? <CheckCircle2 size={14} className="text-cv-good shrink-0" /> : <AlertTriangle size={14} className="text-cv-bad shrink-0" />}
            <span className="font-semibold">{weakPhrases.length === 0 ? 'No Weak Words' : `${weakPhrases.length} Weak Phrases`}</span>
          </div>
        </div>

        {/* Suggestions & Weak Words Auto-fix */}
        {weakPhrases.length > 0 && (
          <div className="p-3 bg-cv-bad-soft border border-cv-bad rounded-cv-card flex items-center justify-between gap-3 text-xs">
            <span className="text-cv-bad">
              Detected weak phrase: <strong>&ldquo;{weakPhrases[0].phrase}&rdquo;</strong>. Replace with power verb?
            </span>
            <button
              onClick={handleAutoFix}
              className="px-2.5 py-1 bg-cv-bad text-white rounded-cv-control font-semibold hover:bg-cv-bad shrink-0 transition-colors flex items-center gap-1"
            >
              <Wand2 size={12} /> Auto-Fix
            </button>
          </div>
        )}

        {suggestions.length > 0 && score < 80 && (
          <div className="text-[11px] text-cv-muted bg-cv-ground p-2.5 rounded-cv-card border border-cv-hairline">
            <span className="font-bold text-cv-ink">Tip: </span>{suggestions[0]}
          </div>
        )}

        {/* 1-Click Action Verbs Selector. The categories wrap, beside the heading or under it: a
            280 px sideways strip hid half of them, most of all on a phone (R4-DPH-42). */}
        <div className="space-y-2 pt-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-cv-ink flex items-center gap-1">
              <Zap size={13} className="text-cv-brand-text" /> Choose Strong Power Verb
            </span>
            <div className="flex flex-wrap gap-1">
              {Object.keys(ACTION_VERBS_BY_CATEGORY).map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-2 py-0.5 rounded-cv-control text-[10px] font-semibold whitespace-nowrap transition-colors ${
                    activeCategory === cat ? 'bg-cv-brand text-white' : 'bg-cv-sunken text-cv-muted hover:bg-cv-stage'
                  }`}
                >
                  {cat.split('&')[0].trim()}
                </button>
              ))}
            </div>
          </div>
          {/* Shown while the statement still opens that way: rewriting it takes the tip away. */}
          {verbBlocked && opensWithAuxiliary(text, verbBlocked) && (
            <p className="text-[11px] text-cv-warn bg-cv-warn-soft border border-cv-warn rounded-cv-card p-2.5">
              This starts with &ldquo;{text.replace(/^[^\p{L}]+/u, '').split(/\s+/).slice(0, 2).join(' ')}&rdquo;, so {opensWithVerbWith(text) ? <>only a verb that takes &ldquo;with&rdquo; (Partnered, Liaised, Coordinated) can replace it</> : <>a verb can&rsquo;t go in front of it</>}.
              {' '}Rewrite it as something you did, e.g. &ldquo;Shipped every release on time&rdquo;, then pick a verb.
            </p>
          )}
          <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto p-1 bg-cv-ground rounded-cv-card border border-cv-hairline">
            {ACTION_VERBS_BY_CATEGORY[activeCategory]?.map(verb => (
              <button
                key={verb}
                onClick={() => handleInsertVerb(verb)}
                className="px-2 py-0.5 bg-cv-surface hover:bg-cv-brand-soft hover:text-cv-brand-pressed hover:border-cv-brand-soft-border border border-cv-hairline rounded-cv-control text-xs font-medium text-cv-ink transition-all shadow-2xs"
              >
                {verb}
              </button>
            ))}
          </div>
        </div>

        {/* Metric Prompt Helpers */}
        <div className="space-y-1.5">
          <span className="text-xs font-semibold text-cv-ink">Add Quantifiable Impact Placeholders:</span>
          <div className="flex flex-wrap gap-1.5">
            {[
              'by 35%',
              'saving $25K annually',
              'reducing latency by 50ms',
              'serving 100K+ users',
              'accelerating delivery by 2 weeks',
              'across 5 cross-functional teams'
            ].map(metric => (
              <button
                key={metric}
                onClick={() => handleInsertMetric(metric)}
                className="px-2 py-1 text-[11px] bg-cv-good-soft text-cv-good border border-cv-good rounded-cv-control hover:bg-cv-good-soft transition-colors"
              >
                + {metric}
              </button>
            ))}
          </div>
        </div>

        {/* Proven Formula Templates */}
        <div className="space-y-1.5 pt-1">
          <span className="text-xs font-semibold text-cv-ink">Google X-Y-Z Proven Templates:</span>
          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {GOOGLE_XYZ_TEMPLATES.map(t => (
              <button
                key={t.label}
                onClick={() => handleInsertTemplate(t.template)}
                className="w-full text-left p-2 rounded-cv-card border border-cv-hairline bg-cv-ground hover:bg-cv-brand-soft hover:border-cv-brand-soft-border transition-all group"
              >
                <div className="flex items-center justify-between text-[10px] font-bold text-cv-faint group-hover:text-cv-brand-text">
                  <span>{t.role} · {t.label}</span>
                  <span className="text-cv-brand-text opacity-0 group-hover:opacity-100">Use Template →</span>
                </div>
                <p className="text-xs text-cv-ink mt-0.5 line-clamp-2">{t.template}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
