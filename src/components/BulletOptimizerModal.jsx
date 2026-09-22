import { useState } from 'react';
import {
  Sparkles, CheckCircle2, AlertTriangle, X, ArrowRight,
  TrendingUp, Copy, Check, Zap, Wand2
} from 'lucide-react';
import {
  analyzeBullet,
  autoFixWeakPhrases,
  ACTION_VERBS_BY_CATEGORY,
  GOOGLE_XYZ_TEMPLATES
} from '@/utils/bulletOptimizer';

export default function BulletOptimizerModal({ isOpen, onClose, initialText = '', onApply }) {
  const [text, setText] = useState(initialText);
  const [activeCategory, setActiveCategory] = useState('Technical & Engineering');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const analysis = analyzeBullet(text);
  const { score, hasActionVerb, hasMetric, weakPhrases, suggestions } = analysis;

  function handleAutoFix() {
    setText(autoFixWeakPhrases(text));
  }

  function handleInsertVerb(verb) {
    if (!text.trim()) {
      setText(verb + ' ');
      return;
    }
    // If text already starts with a word, replace or prepend
    const words = text.trim().split(/\s+/);
    words[0] = verb;
    setText(words.join(' '));
  }

  function handleInsertMetric(metricStr) {
    setText(prev => prev.trim() + ' ' + metricStr);
  }

  function handleInsertTemplate(tmpl) {
    setText(tmpl);
  }

  function handleApply() {
    onApply(text);
    onClose();
  }

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const scoreColor = score >= 80
    ? 'text-emerald-600 bg-emerald-50 border-emerald-300'
    : score >= 60
    ? 'text-blue-600 bg-blue-50 border-blue-300'
    : 'text-amber-600 bg-amber-50 border-amber-300';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-sm">
              <Sparkles size={16} />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-gray-900">Bullet Optimizer & STAR Formula</h2>
              <p className="text-[11px] text-gray-500">Transform weak descriptions into Google X-Y-Z high-impact achievements</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">

          {/* Current Text Area */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-700">Achievement Statement</label>
              <div className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${scoreColor} flex items-center gap-1`}>
                <TrendingUp size={12} />
                Quality: {score}/100
              </div>
            </div>
            <textarea
              rows={3}
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="e.g. Engineered distributed cache system, reducing API latency by 45% for 2M+ active users."
              className="w-full text-xs sm:text-sm p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/50 resize-none text-gray-800"
            />
          </div>

          {/* Quality Indicators & Fixes */}
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className={`p-2.5 rounded-xl border flex items-center gap-1.5 ${hasActionVerb ? 'bg-emerald-50/80 border-emerald-200 text-emerald-800' : 'bg-amber-50/80 border-amber-200 text-amber-800'}`}>
              {hasActionVerb ? <CheckCircle2 size={14} className="text-emerald-600 shrink-0" /> : <AlertTriangle size={14} className="text-amber-600 shrink-0" />}
              <span className="font-semibold">{hasActionVerb ? 'Strong Action Verb' : 'Verb Missing'}</span>
            </div>
            <div className={`p-2.5 rounded-xl border flex items-center gap-1.5 ${hasMetric ? 'bg-emerald-50/80 border-emerald-200 text-emerald-800' : 'bg-amber-50/80 border-amber-200 text-amber-800'}`}>
              {hasMetric ? <CheckCircle2 size={14} className="text-emerald-600 shrink-0" /> : <AlertTriangle size={14} className="text-amber-600 shrink-0" />}
              <span className="font-semibold">{hasMetric ? 'Quantifiable Metric' : 'Metric Missing'}</span>
            </div>
            <div className={`p-2.5 rounded-xl border flex items-center gap-1.5 ${weakPhrases.length === 0 ? 'bg-emerald-50/80 border-emerald-200 text-emerald-800' : 'bg-red-50/80 border-red-200 text-red-800'}`}>
              {weakPhrases.length === 0 ? <CheckCircle2 size={14} className="text-emerald-600 shrink-0" /> : <AlertTriangle size={14} className="text-red-600 shrink-0" />}
              <span className="font-semibold">{weakPhrases.length === 0 ? 'No Weak Words' : `${weakPhrases.length} Weak Phrases`}</span>
            </div>
          </div>

          {/* Suggestions & Weak Words Auto-fix */}
          {weakPhrases.length > 0 && (
            <div className="p-3 bg-red-50/80 border border-red-200 rounded-xl flex items-center justify-between gap-3 text-xs">
              <span className="text-red-700">
                Detected weak phrase: <strong>&ldquo;{weakPhrases[0].phrase}&rdquo;</strong>. Replace with power verb?
              </span>
              <button
                onClick={handleAutoFix}
                className="px-2.5 py-1 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 shrink-0 transition-colors flex items-center gap-1"
              >
                <Wand2 size={12} /> Auto-Fix
              </button>
            </div>
          )}

          {suggestions.length > 0 && score < 80 && (
            <div className="text-[11px] text-gray-500 bg-gray-50 p-2.5 rounded-xl border border-gray-100">
              <span className="font-bold text-gray-700">Tip: </span>{suggestions[0]}
            </div>
          )}

          {/* 1-Click Action Verbs Selector */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                <Zap size={13} className="text-blue-500" /> Choose Strong Power Verb
              </span>
              <div className="flex gap-1 overflow-x-auto no-scrollbar max-w-[280px]">
                {Object.keys(ACTION_VERBS_BY_CATEGORY).map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-semibold whitespace-nowrap transition-colors ${
                      activeCategory === cat ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {cat.split('&')[0].trim()}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto p-1 bg-gray-50/60 rounded-xl border border-gray-100">
              {ACTION_VERBS_BY_CATEGORY[activeCategory]?.map(verb => (
                <button
                  key={verb}
                  onClick={() => handleInsertVerb(verb)}
                  className="px-2 py-0.5 bg-white hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 border border-gray-200 rounded-md text-xs font-medium text-gray-700 transition-all shadow-2xs"
                >
                  {verb}
                </button>
              ))}
            </div>
          </div>

          {/* Metric Prompt Helpers */}
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-gray-700">Add Quantifiable Impact Placeholders:</span>
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
                  className="px-2 py-1 text-[11px] bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
                >
                  + {metric}
                </button>
              ))}
            </div>
          </div>

          {/* Proven Formula Templates */}
          <div className="space-y-1.5 pt-1">
            <span className="text-xs font-semibold text-gray-700">Google X-Y-Z Proven Templates:</span>
            <div className="space-y-1.5 max-h-32 overflow-y-auto">
              {GOOGLE_XYZ_TEMPLATES.map(t => (
                <button
                  key={t.label}
                  onClick={() => handleInsertTemplate(t.template)}
                  className="w-full text-left p-2 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-blue-50/50 hover:border-blue-200 transition-all group"
                >
                  <div className="flex items-center justify-between text-[10px] font-bold text-gray-400 group-hover:text-blue-600">
                    <span>{t.role} · {t.label}</span>
                    <span className="text-blue-600 opacity-0 group-hover:opacity-100">Use Template →</span>
                  </div>
                  <p className="text-xs text-gray-700 mt-0.5 line-clamp-2">{t.template}</p>
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-3">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:text-gray-800 bg-white border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors"
          >
            {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-200 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={!text.trim()}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-colors disabled:opacity-50"
            >
              <span>Apply to Resume</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
