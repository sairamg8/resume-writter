// Parity matrix (how it works: matrix.mjs): every template × every control of the 'footer' family the
// editor offers on it — Design → Page numbers (R2-147), on and off, and its ↺ — each changes the PDF
// (= the preview) as registry-design.mjs says: "Page n of N" on every page inside the bottom margin
// with nothing else moved, loses no text and overlaps nothing.
import { parityFamily } from './run.mjs';

await parityFamily(['footer']);
