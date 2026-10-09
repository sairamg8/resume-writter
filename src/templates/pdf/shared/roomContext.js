import { createContext } from 'react';

/**
 * The room a list item is laid out in, { width, height, fontFamily } in pt: the width of the column
 * (or Grids cell) its text is drawn in, the height of a page's text, and the font the page prints in
 * (to measure the item with). Provided around the entries of a column (RenderColGrid, the Timeline's
 * rail, the Sidebar's dark column) so PdfRichText can tell an item that can never fit a page from one
 * that does, and so a word wider than the column breaks inside it (PdfText, PdfRichText). Nothing
 * provided: the item's length alone decides. Kept apart from keepTogether, which PdfText (read by
 * PdfPage, which keepTogether reads) could not import.
 */
export const ColumnRoom = createContext(null);
