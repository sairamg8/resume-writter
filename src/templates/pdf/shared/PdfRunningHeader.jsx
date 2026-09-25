import { Text } from './PdfText';
import { pageMargins } from '@/constants/pageMargins';
import { RUNNING_HEADER_PT, runningHeaderText, runningHeaderTop } from '@/constants/runningHeader';
import { textShades } from './pdfColors';

/**
 * "Name · Page 2" in the top margin of every page after the first (ATS-7, constants/runningHeader.js).
 * A template puts it FIRST among its page's children: `pdftotext -raw` writes words in drawing order,
 * and only a line drawn before the page's text takes the form feed off a heading that opens the page.
 * `insetPt`: a band the template carries along the paper's top edge (the Banner's strip), kept clear.
 * `left`: where the line's box starts (the Sidebar's main column); the right margin ends it — it is
 * set flush right, so a short name never reaches past the page's own text.
 */
export function PdfRunningHeader({ personal, settings, insetPt = 0, left }) {
  const { v, h } = pageMargins(settings);
  const top = runningHeaderTop(v, insetPt);
  if (top == null) return null;
  return (
    <Text
      fixed
      style={{
        position: 'absolute', top, left: left ?? `${h}mm`, right: `${h}mm`,
        fontSize: RUNNING_HEADER_PT, lineHeight: 1.2, textAlign: 'right',
        color: textShades(settings.textColor || '#111111').meta,
      }}
      render={({ pageNumber }) => (pageNumber > 1 ? runningHeaderText(personal?.name, pageNumber) : '')}
    />
  );
}
