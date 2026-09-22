import { useState, useMemo } from 'react';
import {
  ShieldCheck, AlertTriangle, XCircle, CheckCircle2, ChevronDown,
  Sparkles, Copy, Download, Briefcase, FileText, Target, Plus, Check
} from 'lucide-react';
import {
  analyzeAtsScore,
  standardizeSectionsForAts,
  generateAtsPlainText
} from '@/utils/atsChecker';
import { downloadBlob } from '@/utils/download';
import { newId } from '@/utils/ids';

export default function AtsCheckerPanel({ resume, store }) {
  const [jobDescription, setJobDescription] = useState('');
  const [copiedText, setCopiedText] = useState(false);
  const [copiedKeyword, setCopiedKeyword] = useState(null);
  const [expandedCats, setExpandedCats] = useState({
    contact: true,
    headings: true,
    experience: true,
    education: false,
    skills: false,
    layout: false,
  });

  const analysis = useMemo(() => {
    return analyzeAtsScore(resume, jobDescription);
  }, [resume, jobDescription]);

  function toggleCat(catKey) {
    setExpandedCats(prev => ({ ...prev, [catKey]: !prev[catKey] }));
  }

  function handleStandardizeHeadings() {
    if (!resume || !Array.isArray(resume.sections)) return;
    const updated = standardizeSectionsForAts(resume.sections);
    store.updateSections(updated);
  }

  function handleOptimizeExperienceOrder() {
    if (!resume || !Array.isArray(resume.sections)) return;
    const updated = resume.sections.map(s => {
      if (s.type !== 'experience') return s;
      return {
        ...s,
        titleOrder: 'role',
        settings: { ...s.settings, titleOrder: 'role' },
      };
    });
    store.updateSections(updated);
  }

  function handleSwitchToClassic() {
    if (!store?.setTemplate) return;
    store.setTemplate('classic');
  }

  function handleCopyPlainText() {
    const text = generateAtsPlainText(resume);
    navigator.clipboard.writeText(text).then(() => {
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2500);
    });
  }

  function handleDownloadPlainText() {
    const text = generateAtsPlainText(resume);
    const candidateName = (resume?.personal?.name || 'resume').replace(/\s+/g, '_');
    downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), `${candidateName}_ATS.txt`);
  }

  function handleAddMissingSkill(keyword) {
    if (!keyword) return;
    const sections = Array.isArray(resume?.sections) ? resume.sections : [];
    const skillSec = sections.find(s => s.type === 'skills' && s.visible !== false);

    if (skillSec) {
      const items = Array.isArray(skillSec.items) ? skillSec.items : [];
      if (items.length > 0) {
        const firstItem = items[0];
        const existing = firstItem.skills ? `${firstItem.skills}, ${keyword}` : keyword;
        store.updateItem(skillSec.id, firstItem.id, i => ({ ...i, skills: existing }));
      } else {
        store.addItem(skillSec.id, { id: newId('skill'), category: 'Core Skills', skills: keyword });
      }
    } else {
      store.addSection('skills', { id: newId('skill'), category: 'Core Skills', skills: keyword });
    }

    setCopiedKeyword(keyword);
    setTimeout(() => setCopiedKeyword(null), 2000);
  }

  const { totalScore, grade, gradeLabel, categories, criticalCount, warningCount, passedCount, jobMatch } = analysis;

  const scoreColor = totalScore >= 90
    ? 'text-emerald-600 bg-emerald-50 border-emerald-300'
    : totalScore >= 75
    ? 'text-blue-600 bg-blue-50 border-blue-300'
    : totalScore >= 60
    ? 'text-amber-600 bg-amber-50 border-amber-300'
    : 'text-red-600 bg-red-50 border-red-300';

  const scoreProgressBg = totalScore >= 90
    ? 'bg-emerald-500'
    : totalScore >= 75
    ? 'bg-blue-500'
    : totalScore >= 60
    ? 'bg-amber-500'
    : 'bg-red-500';

  const hasNonStandardHeadings = categories.headings.items.some(i => i.id === 'std_headings' && i.status === 'warn');
  const hasSidebarWarning = categories.layout.items.some(i => i.id === 'template' && i.status === 'warn');
  const hasCompanyTitleOrder = categories.experience.items.some(i => i.id === 'exp_title_order' && i.status === 'warn');

  return (
    <div className="space-y-5 text-gray-800 pb-12">
      {/* ── Top Header & Score Card ─────────────────────────────── */}
      <div className="p-5 bg-white border border-gray-200 rounded-2xl shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-blue-50 text-blue-600 shrink-0">
                <ShieldCheck size={20} />
              </span>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-gray-900 leading-tight">ATS Score & Parser Checker</h2>
                <p className="text-[11px] sm:text-xs text-gray-500 mt-0.5">Tested for Workday, Taleo, Greenhouse, Lever & iCIMS</p>
              </div>
            </div>
          </div>

          {/* Big Score Badge */}
          <div className={`flex flex-col items-center justify-center px-4 py-2 rounded-2xl border ${scoreColor} shrink-0 self-stretch sm:self-auto`}>
            <div className="text-xl sm:text-2xl font-black tracking-tight leading-none">{totalScore}<span className="text-xs font-semibold text-gray-500">/100</span></div>
            <div className="text-[10px] sm:text-[11px] font-bold uppercase mt-1 tracking-wider">{grade} · {gradeLabel}</div>
          </div>
        </div>

        {/* Overall Progress Bar */}
        <div className="space-y-1.5">
          <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${scoreProgressBg}`}
              style={{ width: `${totalScore}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-gray-500 pt-0.5">
            <span className="flex items-center gap-1 text-emerald-600 font-semibold"><CheckCircle2 size={13} /> {passedCount} Passed</span>
            <span className="flex items-center gap-1 text-amber-600 font-semibold"><AlertTriangle size={13} /> {warningCount} Suggestions</span>
            <span className="flex items-center gap-1 text-red-600 font-semibold"><XCircle size={13} /> {criticalCount} Critical</span>
          </div>
        </div>

        {/* One-Click Quick Fixes */}
        {(hasNonStandardHeadings || hasSidebarWarning || hasCompanyTitleOrder) && (
          <div className="pt-3 border-t border-gray-100 flex flex-wrap gap-2">
            {hasCompanyTitleOrder && (
              <button
                onClick={handleOptimizeExperienceOrder}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-xl border border-purple-200 transition-colors"
              >
                <Sparkles size={13} /> Put Job Title First (Role / Co.)
              </button>
            )}
            {hasNonStandardHeadings && (
              <button
                onClick={handleStandardizeHeadings}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl border border-blue-200 transition-colors"
              >
                <Sparkles size={13} /> Standardize All Section Headings
              </button>
            )}
            {hasSidebarWarning && (
              <button
                onClick={handleSwitchToClassic}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl border border-emerald-200 transition-colors"
              >
                <Briefcase size={13} /> Switch to Single-Column ATS Layout
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── ATS Plain Text Export Card ─────────────────────────── */}
      <div className="p-4 bg-gradient-to-br from-gray-50 to-blue-50/40 border border-gray-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
            <FileText size={14} className="text-blue-600" /> ATS Plain Text (For Direct Copy-Paste)
          </h3>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Standard ASCII text format for pasting directly into Workday or Taleo application text boxes.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          <button
            onClick={handleCopyPlainText}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-100 border border-gray-300 rounded-xl shadow-sm transition-all"
          >
            {copiedText ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
            {copiedText ? 'Copied!' : 'Copy Text'}
          </button>
          <button
            onClick={handleDownloadPlainText}
            title="Download .txt"
            className="p-1.5 text-gray-600 bg-white hover:bg-gray-100 border border-gray-300 rounded-xl shadow-sm transition-all"
          >
            <Download size={14} />
          </button>
        </div>
      </div>

      {/* ── Target Job Description Matcher ─────────────────────── */}
      <div className="p-4 sm:p-5 bg-white border border-gray-200 rounded-2xl shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-purple-50 text-purple-600 shrink-0">
              <Target size={16} />
            </span>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Target Job Description Scanner</h3>
              <p className="text-xs text-gray-500">Paste a job posting to check keyword match rate & missing skills</p>
            </div>
          </div>
          {jobMatch && (
            <div className="text-xs font-bold px-2.5 py-1 rounded-full bg-purple-100 text-purple-700 border border-purple-200 self-start sm:self-auto">
              {jobMatch.matchPercentage}% Match
            </div>
          )}
        </div>

        <textarea
          rows={3}
          value={jobDescription}
          onChange={e => setJobDescription(e.target.value)}
          placeholder="Paste job posting description here (requirements, qualifications, tech stack)..."
          className="w-full text-xs p-3 border border-gray-200 rounded-xl outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all text-gray-700 resize-none"
        />

        {jobMatch && (
          <div className="space-y-3 pt-2">
            {jobMatch.missingKeywords.length > 0 && (
              <div>
                <div className="text-xs font-bold text-amber-700 mb-1.5 flex items-center gap-1.5">
                  <AlertTriangle size={13} /> Missing Keywords in Resume ({jobMatch.missingKeywords.length})
                </div>
                <p className="text-[11px] text-gray-500 mb-2">Click "+" to immediately add a missing keyword into your Skills section:</p>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                  {jobMatch.missingKeywords.map(kw => (
                    <button
                      key={kw}
                      onClick={() => handleAddMissingSkill(kw)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-colors"
                      title="Click to add to Skills"
                    >
                      <span>{kw}</span>
                      {copiedKeyword === kw ? <Check size={11} className="text-emerald-600" /> : <Plus size={11} className="text-amber-600" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {jobMatch.matchedKeywords.length > 0 && (
              <div>
                <div className="text-xs font-bold text-emerald-700 mb-1.5 flex items-center gap-1.5">
                  <CheckCircle2 size={13} /> Matched Keywords Found ({jobMatch.matchedKeywords.length})
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                  {jobMatch.matchedKeywords.map(kw => (
                    <span key={kw} className="px-2.5 py-1 rounded-lg text-xs bg-emerald-50 text-emerald-800 border border-emerald-200">
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Category Breakdowns ─────────────────────────────────── */}
      <div className="space-y-3">
        {Object.entries(categories).map(([catKey, cat]) => {
          const isExpanded = expandedCats[catKey];
          const hasErrors = cat.items.some(i => i.status === 'fail');
          const hasWarnings = cat.items.some(i => i.status === 'warn');

          return (
            <div key={catKey} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm transition-all">
              <button
                onClick={() => toggleCat(catKey)}
                className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className={`w-2 h-2 rounded-full ${hasErrors ? 'bg-red-500' : hasWarnings ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                  <span className="text-sm font-bold text-gray-800 truncate">{cat.label}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-md">
                    {cat.score} / {cat.max} pts
                  </span>
                  <ChevronDown size={15} className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 pt-1 border-t border-gray-100 space-y-2.5">
                  {cat.items.map(item => (
                    <div
                      key={item.id}
                      className={`p-3 rounded-xl border text-xs ${
                        item.status === 'pass'
                          ? 'bg-emerald-50/40 border-emerald-100 text-gray-700'
                          : item.status === 'warn'
                          ? 'bg-amber-50/50 border-amber-200 text-gray-800'
                          : 'bg-red-50/50 border-red-200 text-gray-800'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {item.status === 'pass' && <CheckCircle2 size={15} className="text-emerald-600 shrink-0 mt-0.5" />}
                        {item.status === 'warn' && <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />}
                        {item.status === 'fail' && <XCircle size={15} className="text-red-600 shrink-0 mt-0.5" />}
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-gray-900">{item.text}</div>
                          {item.detail && <p className="text-[11px] text-gray-600 mt-0.5">{item.detail}</p>}
                          {item.fixable && item.action === 'standardize_headings' && (
                            <button
                              onClick={handleStandardizeHeadings}
                              className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-blue-700 bg-white border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors shadow-2xs"
                            >
                              <Sparkles size={11} /> Standardize Headings Now
                            </button>
                          )}
                          {item.fixable && item.action === 'switch_to_classic' && (
                            <button
                              onClick={handleSwitchToClassic}
                              className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 bg-white border border-emerald-300 rounded-lg hover:bg-emerald-50 transition-colors shadow-2xs"
                            >
                              <Briefcase size={11} /> Switch to Classic ATS Layout
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
