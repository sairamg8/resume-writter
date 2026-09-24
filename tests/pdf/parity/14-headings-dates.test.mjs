// Parity matrix (how it works: matrix.mjs): every template × every control of the
// 'headings', 'dates' families the editor offers on it, at every value it offers — each changes the PDF
// (= the preview) as registry-*.mjs says, loses no text and overlaps nothing.
import { parityFamily } from './run.mjs';

await parityFamily(['headings', 'dates']);
