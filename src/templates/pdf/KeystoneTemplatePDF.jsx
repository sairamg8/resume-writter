import { Svg, Polygon } from '@react-pdf/renderer';
import { PdfDesignedDocument, PdfDesignedHeader } from './shared/PdfDesigned';
import { KEYSTONE_WEDGE } from './shared/designedMarks';

/**
 * Keystone — a keystone of the accent set beside the name (a drawn wedge, wider at the top), and section
 * titles in a tinted box with an accent bar at its left edge (Boxed's `edge` mark, sectionHeadingLook). The
 * header is Classic's, with every Header Customization control (PdfDesignedHeader); the wedge takes its
 * width from the name's row. ATS: certified — the wedge is a shape, not text.
 */
export function KeystoneTemplatePDF({ data }) {
  const s = data.settings || {};
  const { width, height } = KEYSTONE_WEDGE;
  const wedge = (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Polygon points={`0,0 ${width},0 ${width * 0.78},${height} ${width * 0.22},${height}`} fill={s.accentColor} />
    </Svg>
  );
  return <PdfDesignedDocument data={data} header={<PdfDesignedHeader personal={data.personal} settings={s} beside={{ node: wedge, width }} />} />;
}
