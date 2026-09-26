import { PdfDesignedDocument, PdfDesignedHeader } from './shared/PdfDesigned';
import { pageMargins } from './shared/PdfPage';
import { MM_TO_PT } from './shared/pdfUnits';
import { bandedGround, BANDED_PAD } from './shared/designedMarks';

/**
 * Banded — the header on a pale band of the accent that runs to the paper's top and side edges, its text
 * in the page's own inks on the margins, and every section title on a band of the same kind across the
 * paper (Boxed's `bleed` mark, sectionHeadingLook). The header is Classic's, with every Header Customization
 * control (PdfDesignedHeader). ATS: good, as Banner — the same clean single column, under a tinted header
 * ground; the bands are fills.
 */
export function BandedTemplatePDF({ data }) {
  const s = data.settings || {};
  const { v, h } = pageMargins(s);
  return (
    <PdfDesignedDocument
      data={data}
      header={(
        <PdfDesignedHeader
          personal={data.personal}
          settings={s}
          frame={{ backgroundColor: bandedGround(s.accentColor), paddingBottom: BANDED_PAD }}
          bleed={{ top: v * MM_TO_PT, side: h * MM_TO_PT }}
        />
      )}
    />
  );
}
