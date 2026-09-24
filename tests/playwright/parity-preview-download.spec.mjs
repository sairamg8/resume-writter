// Goal 1 (owner, 2026-09-23): "each case the canvas should render as expected and downloaded PDF have exact
// same stylings". For every template the app offers, with its defaults and with a heavily customised
// design, the preview's PDF and the downloaded PDF draw the same pages, and the preview canvas shows
// exactly the downloaded file's page 1 (parity-helpers.js says how each is measured).
import { test, expect } from '@playwright/test';
import { TEMPLATE_IDS } from '../../src/constants/templates.js';
import { visitEditor } from './pw-helpers.js';
import { hookPreviewPdfs, settledPreview, previewPdf, downloadedPdf, drawingDiff, canvasVsPdf } from './parity-helpers.js';

const PNG_2X2 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEElEQVR4nGP4z8AARAwQCgAf7gP9i18U1AAAAABJRU5ErkJggg==';

/** A design that moves nearly every control off its default at once. */
const CUSTOM = {
  accentColor: '#e11d48', textColor: '#334155', nameColor: '#0f766e', jobTitleColor: '#7c3aed',
  headingStyle: 'box', sectionTitleCase: 'normal', sectionBorderWidth: 3, fontSizeBase: 10, fontSizeNameDelta: 12,
  fontSizeSectionDelta: 2, fontSizeEntryDelta: 1, lineHeightValue: 1.3, marginV: 10, marginH: 12, sectionGap: 22,
  itemGap: 4, dateFormat: 'MMM YYYY', iconSet: 'lucide', iconSize: 13, contactStyle: 'bar', contactLayout: 'single',
  headerAlign: 'center', headerLayout: 'stack', showHeaderBorder: true, headerBorderWidth: 3, photoShape: 'rounded',
  photoSize: 'lg', photoBorder: 'accent', nameTitleGap: 6, contactGapY: 5,
};
const COMBOS = [
  ...TEMPLATE_IDS.flatMap((t) => [
    { name: `${t} · defaults`, template: t, settings: {} },
    { name: `${t} · customised`, template: t, settings: CUSTOM, personal: { photo: PNG_2X2 } },
  ]),
  { name: 'sidebar · Single · ATS-safe, customised', template: 'sidebar', settings: { ...CUSTOM, sidebarSingleColumn: true }, personal: { photo: PNG_2X2 } },
  { name: 'modern · banner colours', template: 'modern', settings: { accentColor: '#0f766e', headerTextColor: '#fde68a' } },
  { name: 'sidebar · column colours', template: 'sidebar', settings: { sidebarBg: '#14532d', headerTextColor: '#fef3c7', accentColor: '#f59e0b' } },
];

test.describe('preview == downloaded PDF', () => {
  for (const combo of COMBOS) {
    test(combo.name, async ({ page }) => {
      await hookPreviewPdfs(page);
      await visitEditor(page, combo.template, { settings: combo.settings, personal: combo.personal });
      await settledPreview(page);
      const shown = await previewPdf(page);
      const downloaded = await downloadedPdf(page);
      expect(await drawingDiff(shown, downloaded), 'the preview and the download draw the same pages').toEqual([]);
      const px = await canvasVsPdf(page, downloaded);
      expect(px.differing, `page 1 on screen vs the downloaded file (${px.width}×${px.height})`).toBe(0);
    });
  }
});
