// react-pdf's font store, for a test that looks at the faces the app registered and loaded
// (tests/pdf/97-woff-glyf-once). Loaded through the harness's Vite instance, as the app's modules are,
// so it is the same store pdfFontLoader.js registers in.
export { Font } from '@react-pdf/renderer';
