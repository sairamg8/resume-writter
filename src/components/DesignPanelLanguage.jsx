import { useId } from 'react';
import { DesignSection } from '@/components/DesignPanelShared';
import { DEFAULT_LANGUAGE, RESUME_LANGUAGES, isRtl, languageOf } from '@/utils/resumeLanguage';

/**
 * Design → Language (R2-148): the language of the words the app prints on the résumé — month names,
 * "Present", and the section titles it gave — in the PDF (the preview), Word, Markdown and ATS text.
 * Arabic, Hebrew, Persian and Urdu also turn the page right to left. English, which every résumé
 * storing no language prints, is first; the ↺ puts it back.
 */
export function LanguageSection({ settings, updateSetting }) {
  const id = useId();
  return (
    <DesignSection title="Language" onReset={() => updateSetting('language', DEFAULT_LANGUAGE)}>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-xs text-gray-600">Résumé language</label>
        <select
          id={id}
          value={languageOf(settings)}
          onChange={e => updateSetting('language', e.target.value)}
          className="px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          {RESUME_LANGUAGES.map(([value, name]) => <option key={value} value={value}>{name}</option>)}
        </select>
      </div>
      <p className="text-[11px] text-gray-400 leading-relaxed">
        Month names, &ldquo;Present&rdquo; and the section titles you have not renamed. What you type prints as typed.
        {isRtl(settings) ? ' The page reads right to left.' : ''}
      </p>
    </DesignSection>
  );
}
