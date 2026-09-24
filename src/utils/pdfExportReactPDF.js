import React from 'react';
import { pdf } from '@react-pdf/renderer';
import { resolvePdfFonts, collectText } from '@/templates/pdf/shared/pdfFontLoader';
import { resolveTemplateSettings } from '@/templates/pdf/shared/templateSettings';
import { resolveSection } from '@/templates/pdf/shared/templateSectionDefaults';
import { downloadBlob } from '@/utils/download';
import { withPrintablePhotos } from '@/utils/printableImage';
import { templateId } from '@/constants/templates';

/** Each template's PDF component, code-split. Pinned to TEMPLATE_IDS (15-design-defaults, VM3-5). */
export const LOADERS = {
  classic:   () => import('@/templates/pdf/ClassicTemplatePDF').then(m => m.ClassicTemplatePDF),
  modern:    () => import('@/templates/pdf/ModernTemplatePDF').then(m => m.ModernTemplatePDF),
  minimal:   () => import('@/templates/pdf/MinimalTemplatePDF').then(m => m.MinimalTemplatePDF),
  sidebar:   () => import('@/templates/pdf/SidebarTemplatePDF').then(m => m.SidebarTemplatePDF),
  executive: () => import('@/templates/pdf/ExecutiveTemplatePDF').then(m => m.ExecutiveTemplatePDF),
  timeline:  () => import('@/templates/pdf/TimelineTemplatePDF').then(m => m.TimelineTemplatePDF),
  banner:    () => import('@/templates/pdf/BannerTemplatePDF').then(m => m.BannerTemplatePDF),
  academic:  () => import('@/templates/pdf/AcademicTemplatePDF').then(m => m.AcademicTemplatePDF),
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
 * Warm caches used by Export PDF: fonts and the template chunk.
 * Call from the editor on mount / when template or font changes.
 */
export async function warmPdfExport(resume) {
  const key = templateId(resume?.template);
  await Promise.all([
    resolvePdfFonts(resume?.settings, collectText(resume)).catch(() => null),
    loadTemplate(key).catch(() => null),
    // Cover letter is small; warm in background when user may need it
    import('@/templates/pdf/CoverLetterTemplatePDF').catch(() => null),
    // The copy the PDF prints for a photo saved as a WebP or GIF (R7-7): made once a session.
    withPrintablePhotos(resume).catch(() => null),
  ]);
}

/**
 * Render the résumé exactly as it is exported. Used by the live preview and by Export PDF. A photo
 * saved as WebP or GIF, before uploads were converted, prints as a converted copy (R7-7).
 */
export async function renderResumePdf(resume) {
  const key = templateId(resume?.template);
  const [{ fontFamily }, TemplatePDF, printable] = await Promise.all([
    resolvePdfFonts(resume?.settings, collectText(resume)),
    loadTemplate(key),
    withPrintablePhotos(resume),
  ]);
  const data = prepareResumeData(printable, fontFamily, key);
  const instance = pdf(React.createElement(TemplatePDF, { data }));
  const blob = await instance.toBlob();
  // Free internal resources when the API supports it
  try { instance.reset?.(); } catch { /* no-op */ }
  return blob;
}

/**
 * Render the cover letter exactly as it is exported. `preview: true` adds the grey writing
 * hint an empty letter shows in the editor; exports never carry it. Its photos print as the
 * résumé's do (renderResumePdf).
 */
export async function renderCoverLetterPdf(resume, { preview = false } = {}) {
  const templateKey = templateId(resume?.template);
  const [{ fontFamily }, mod, printable] = await Promise.all([
    resolvePdfFonts(resume?.settings, collectText({ personal: resume?.personal, coverLetter: resume?.coverLetter })),
    import('@/templates/pdf/CoverLetterTemplatePDF'),
    withPrintablePhotos(resume),
  ]);
  const resolvedSettings = resolveTemplateSettings({
    ...printable?.settings,
    _pdfFontFamily: fontFamily,
    _template: templateKey,
  }, templateKey);

  const data = { ...printable, settings: resolvedSettings, _preview: preview };
  const instance = pdf(React.createElement(mod.CoverLetterTemplatePDF, { data }));
  const blob = await instance.toBlob();
  try { instance.reset?.(); } catch { /* no-op */ }
  return blob;
}

export async function exportToPDFReact(resume, filename = 'resume.pdf') {
  const blob = await renderResumePdf(resume);
  downloadBlob(blob, filename);
  return blob;
}

export async function exportCoverLetterPDFReact(resume, filename = 'cover-letter.pdf') {
  const blob = await renderCoverLetterPdf(resume);
  downloadBlob(blob, filename);
  return blob;
}
