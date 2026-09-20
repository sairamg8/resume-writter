import { FileText, Sparkles, X, ArrowRight } from 'lucide-react';
import { STARTER_TEMPLATES } from '@/utils/starterTemplates';

export default function StarterTemplateModal({ isOpen, onClose, onSelectStarter, onSelectBlank }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-xl w-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
              <Sparkles size={16} />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-gray-900">Choose a Resume Starter</h2>
              <p className="text-[11px] text-gray-500">Start from scratch or use pre-filled, ATS-optimized role templates</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-3 max-h-[75vh] overflow-y-auto">
          {/* Blank Option */}
          <button
            onClick={onSelectBlank}
            className="w-full text-left p-3.5 rounded-xl border-2 border-dashed border-gray-200 hover:border-blue-400 hover:bg-blue-50/40 transition-all flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gray-100 group-hover:bg-blue-100 flex items-center justify-center text-gray-500 group-hover:text-blue-600 transition-colors">
                <FileText size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-800 group-hover:text-blue-700 transition-colors">Start from Scratch (Blank)</h3>
                <p className="text-xs text-gray-400">Empty sections to fill with your own custom experience.</p>
              </div>
            </div>
            <ArrowRight size={15} className="text-gray-300 group-hover:text-blue-600 transition-colors" />
          </button>

          <div className="flex items-center gap-2 pt-2">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Curated ATS Role Starters</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          {/* Role Starters */}
          {STARTER_TEMPLATES.map(t => (
            <button
              key={t.id}
              onClick={() => onSelectStarter(t.id)}
              className="w-full text-left p-3.5 rounded-xl border border-gray-200 hover:border-blue-400 hover:bg-blue-50/30 transition-all flex items-center justify-between group shadow-2xs"
            >
              <div className="min-w-0 pr-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-gray-900 group-hover:text-blue-700 transition-colors">{t.name}</h3>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">{t.badge}</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{t.description}</p>
              </div>
              <ArrowRight size={15} className="text-gray-300 group-hover:text-blue-600 shrink-0 transition-colors" />
            </button>
          ))}
        </div>

      </div>
    </div>
  );
}
