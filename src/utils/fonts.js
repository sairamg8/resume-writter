export const FONTS = [
  { id: 'notosans',   label: 'Noto Sans',         family: "'Noto Sans', sans-serif",              googleQuery: 'Noto+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400' },
  { id: 'inter',      label: 'Inter',             family: "'Inter', sans-serif",                  googleQuery: 'Inter:wght@400;500;600;700' },
  { id: 'opensans',   label: 'Open Sans',         family: "'Open Sans', sans-serif",              googleQuery: 'Open+Sans:ital,wght@0,400;0,600;0,700;1,400' },
  { id: 'firasans',   label: 'Fira Sans',         family: "'Fira Sans', sans-serif",              googleQuery: 'Fira+Sans:ital,wght@0,400;0,500;0,600;1,400' },
  { id: 'ibmplexsans',label: 'IBM Plex Sans',     family: "'IBM Plex Sans', sans-serif",          googleQuery: 'IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400' },
  { id: 'asap',       label: 'Asap',              family: "'Asap', sans-serif",                   googleQuery: 'Asap:ital,wght@0,400;0,500;0,600;1,400' },
  { id: 'roboto',     label: 'Roboto',            family: "'Roboto', sans-serif",                 googleQuery: 'Roboto:ital,wght@0,400;0,500;0,700;1,400' },
  { id: 'lato',       label: 'Lato',              family: "'Lato', sans-serif",                   googleQuery: 'Lato:ital,wght@0,400;0,700;1,400' },
  { id: 'sourcesans', label: 'Source Sans 3',     family: "'Source Sans 3', sans-serif",          googleQuery: 'Source+Sans+3:ital,wght@0,400;0,600;0,700;1,400' },
  { id: 'georgia',    label: 'Georgia',           family: 'Georgia, serif',                       googleQuery: null },
  { id: 'sourceserif',label: 'Source Serif Pro',  family: "'Source Serif 4', serif",              googleQuery: 'Source+Serif+4:ital,wght@0,300;0,400;0,600;1,300;1,400' },
  { id: 'ptserif',    label: 'PT Serif',          family: "'PT Serif', serif",                    googleQuery: 'PT+Serif:ital,wght@0,400;0,700;1,400' },
  { id: 'literata',   label: 'Literata',          family: "'Literata', serif",                    googleQuery: 'Literata:ital,opsz,wght@0,7..72,300;0,7..72,400;0,7..72,600;1,7..72,400' },
];

export function getFontById(id) {
  return FONTS.find(f => f.id === id) || FONTS.find(f => f.id === 'inter');
}

export function loadGoogleFont(font) {
  if (!font?.googleQuery) return;
  const id = `gfont-${font.id}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${font.googleQuery}&display=swap`;
  document.head.appendChild(link);
}

// Custom fonts persisted separately from resume data
const CUSTOM_FONTS_KEY = 'cpwtcv_custom_fonts';

export function loadCustomFonts() {
  try { return JSON.parse(localStorage.getItem(CUSTOM_FONTS_KEY) || '[]'); } catch { return []; }
}

export function saveCustomFont(name) {
  if (!name) return;
  const list = loadCustomFonts();
  if (!list.includes(name)) {
    localStorage.setItem(CUSTOM_FONTS_KEY, JSON.stringify([...list, name]));
  }
}

export function removeCustomFont(name) {
  const list = loadCustomFonts().filter(f => f !== name);
  localStorage.setItem(CUSTOM_FONTS_KEY, JSON.stringify(list));
}

export function loadCustomGoogleFont(name) {
  if (!name) return;
  const id = `gfont-custom-${name.toLowerCase().replace(/\s+/g, '-')}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${name.replace(/\s+/g, '+')}:ital,wght@0,400;0,600;0,700;1,400&display=swap`;
  document.head.appendChild(link);
}
