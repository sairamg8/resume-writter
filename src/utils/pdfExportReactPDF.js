import React from 'react';
import { pdf } from '@react-pdf/renderer';
import { registerPdfFont } from '@/templates/pdf/shared/pdfFontLoader';

import { resolveTemplateSettings } from '@/templates/pdf/shared/PdfPage';
import { resolveSection } from '@/templates/pdf/shared/templateSectionDefaults';

const LOADERS = {
  classic:   () => import('@/templates/pdf/ClassicTemplatePDF').then(m => m.ClassicTemplatePDF),
  modern:    () => import('@/templates/pdf/ModernTemplatePDF').then(m => m.ModernTemplatePDF),
  minimal:   () => import('@/templates/pdf/MinimalTemplatePDF').then(m => m.MinimalTemplatePDF),
  sidebar:   () => import('@/templates/pdf/SidebarTemplatePDF').then(m => m.SidebarTemplatePDF),
  executive: () => import('@/templates/pdf/ExecutiveTemplatePDF').then(m => m.ExecutiveTemplatePDF),
};

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exportToPDFReact(resume, filename = 'resume.pdf') {
  const key = resume?.template || 'classic';
  const load = LOADERS[key] || LOADERS.classic;

  // Register the user's chosen font with react-pdf, get back the family name.
  const fontFamily = registerPdfFont(resume?.settings);

  const TemplatePDF = await load();

  const resolvedSettings = resolveTemplateSettings({
    ...resume?.settings,
    _pdfFontFamily: fontFamily,
    _template: key,
  }, key);

  const resolvedSections = (resume?.sections || []).map(s => resolveSection(s, key));

  const data = { ...resume, sections: resolvedSections, settings: resolvedSettings };
  const blob = await pdf(React.createElement(TemplatePDF, { data })).toBlob();
  triggerDownload(blob, filename);
}

export async function exportCoverLetterPDFReact(resume, filename = 'cover-letter.pdf') {
  const { CoverLetterTemplatePDF } = await import('@/templates/pdf/CoverLetterTemplatePDF');
  const fontFamily = registerPdfFont(resume?.settings);

  const resolvedSettings = resolveTemplateSettings({
    ...resume?.settings,
    _pdfFontFamily: fontFamily,
    _template: resume?.template || 'classic',
  }, resume?.template || 'classic');

  const data = { ...resume, settings: resolvedSettings };
  const blob = await pdf(React.createElement(CoverLetterTemplatePDF, { data })).toBlob();
  triggerDownload(blob, filename);
}
