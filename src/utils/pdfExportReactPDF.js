import React from 'react';
import { pdf } from '@react-pdf/renderer';
import {
  registerPdfFont,
  prefetchPdfFont,
  ensureNoHyphenation,
} from '@/templates/pdf/shared/pdfFontLoader';
import { resolveTemplateSettings } from '@/templates/pdf/shared/PdfPage';
import { resolveSection } from '@/templates/pdf/shared/templateSectionDefaults';
import { downloadBlob } from '@/utils/download';

const LOADERS = {
  classic:   () => import('@/templates/pdf/ClassicTemplatePDF').then(m => m.ClassicTemplatePDF),
  modern:    () => import('@/templates/pdf/ModernTemplatePDF').then(m => m.ModernTemplatePDF),
  minimal:   () => import('@/templates/pdf/MinimalTemplatePDF').then(m => m.MinimalTemplatePDF),
  sidebar:   () => import('@/templates/pdf/SidebarTemplatePDF').then(m => m.SidebarTemplatePDF),
  executive: () => import('@/templates/pdf/ExecutiveTemplatePDF').then(m => m.ExecutiveTemplatePDF),
};

/** Cache loaded template components so repeat exports skip network/chunk parse. */
const templateCache = new Map();

async function loadTemplate(key) {
  const k = LOADERS[key] ? key : 'classic';
  if (templateCache.has(k)) return templateCache.get(k);
  const load = LOADERS[k] || LOADERS.classic;
  const Comp = await load();
  templateCache.set(k, Comp);
  return Comp;
}

function prepareResumeData(resume, fontFamily, templateKey) {
  const resolvedSettings = resolveTemplateSettings({
    ...resume?.settings,
    _pdfFontFamily: fontFamily,
    _template: templateKey,
  }, templateKey);

  const resolvedSections = (resume?.sections || []).map(s => resolveSection(s, templateKey));
  return { ...resume, sections: resolvedSections, settings: resolvedSettings };
}

/**
 * Warm caches used by Export PDF: hyphenation off, font prefetch, template chunk.
 * Call from the editor on mount / when template or font changes.
 */
export async function warmPdfExport(resume) {
  ensureNoHyphenation();
  const key = resume?.template || 'classic';
  await Promise.all([
    prefetchPdfFont(resume?.settings),
    loadTemplate(key).catch(() => null),
    // Cover letter is small; warm in background when user may need it
    import('@/templates/pdf/CoverLetterTemplatePDF').catch(() => null),
  ]);
}

export async function exportToPDFReact(resume, filename = 'resume.pdf') {
  ensureNoHyphenation();
  const key = resume?.template || 'classic';

  // Font + template in parallel (font registration is sync after prefetch warms cache)
  const [, fontFamily, TemplatePDF] = await Promise.all([
    prefetchPdfFont(resume?.settings),
    Promise.resolve(registerPdfFont(resume?.settings)),
    loadTemplate(key),
  ]);

  const data = prepareResumeData(resume, fontFamily, key);
  const instance = pdf(React.createElement(TemplatePDF, { data }));
  const blob = await instance.toBlob();
  // Free internal resources when the API supports it
  try { instance.reset?.(); } catch { /* no-op */ }
  downloadBlob(blob, filename);
  return blob;
}

export async function exportCoverLetterPDFReact(resume, filename = 'cover-letter.pdf') {
  ensureNoHyphenation();
  const templateKey = resume?.template || 'classic';

  const [, fontFamily, mod] = await Promise.all([
    prefetchPdfFont(resume?.settings),
    Promise.resolve(registerPdfFont(resume?.settings)),
    import('@/templates/pdf/CoverLetterTemplatePDF'),
  ]);

  const resolvedSettings = resolveTemplateSettings({
    ...resume?.settings,
    _pdfFontFamily: fontFamily,
    _template: templateKey,
  }, templateKey);

  const data = { ...resume, settings: resolvedSettings };
  const instance = pdf(React.createElement(mod.CoverLetterTemplatePDF, { data }));
  const blob = await instance.toBlob();
  try { instance.reset?.(); } catch { /* no-op */ }
  downloadBlob(blob, filename);
  return blob;
}
