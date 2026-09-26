// Parity matrix (how it works: matrix.mjs): every template × every control of the
// 'photo', 'visibility' families the editor offers on it, at every value it offers — each changes the PDF
// (= the preview) as registry-*.mjs says, loses no text and overlaps nothing.
// Photo → Tone Grayscale prints a greyscale copy drawn through a canvas: the app is handed Node's
// before the first render, as the browser has its own (R2-147).
import { parityFamily } from './run.mjs';
import { installPhotoCanvas } from '../harness.mjs';

await parityFamily(['photo', 'visibility'], { prepare: installPhotoCanvas });
