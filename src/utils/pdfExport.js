// Replicated from App.jsx — needed to compute page breaks for print
function collectLeaves(root) {
  const base = root.getBoundingClientRect().top;
  const leaves = [];
  function isBlockish(el) {
    const d = getComputedStyle(el).display;
    return d.includes('block') || d.includes('flex') || d.includes('grid') || d.includes('list-item') || d.includes('table');
  }
  function walk(el) {
    for (const child of el.children) {
      const hasBlockChild = Array.from(child.children).some(isBlockish);
      if (!hasBlockChild) {
        const r = child.getBoundingClientRect();
        if (r.height > 0) leaves.push({ top: r.top - base, bottom: r.bottom - base });
      } else {
        walk(child);
      }
    }
  }
  walk(root);
  leaves.sort((a, b) => a.top - b.top || a.bottom - b.bottom);
  return leaves;
}

function computeRanges(contentEl, pageContentPx) {
  const leaves = collectLeaves(contentEl);
  const total = contentEl.scrollHeight;
  if (!leaves.length) return [{ start: 0, height: total }];

  const ranges = [];
  let start = 0;
  let i = 0;
  while (i < leaves.length && ranges.length < 40) {
    const limit = start + pageContentPx;
    let j = i;
    // 2px tolerance absorbs sub-pixel rendering differences that push leaves just past a page boundary
    while (j < leaves.length && leaves[j].bottom <= limit + 2) j++;
    if (j === i) {
      ranges.push({ start, height: pageContentPx });
      start += pageContentPx;
      while (i < leaves.length && leaves[i].top < start - 0.5) i++;
    } else {
      const nextStart = j < leaves.length ? leaves[j].top : total;
      ranges.push({ start, height: nextStart - start });
      start = nextStart;
      i = j;
    }
  }
  if (start < total - 1) ranges.push({ start, height: total - start });

  // Collapse a near-empty trailing page into the previous to prevent blank last pages.
  // Triggered when a leaf barely overflows a page boundary (section margins, sub-pixel layout).
  // Only collapses if the tail content fits within 4px of the available room on the prior page.
  if (ranges.length > 1) {
    const last = ranges[ranges.length - 1];
    const prev = ranges[ranges.length - 2];
    const room = pageContentPx - (last.start - prev.start);
    if (room > 0 && last.height <= room + 4) {
      prev.height = last.start + last.height - prev.start;
      ranges.pop();
    }
  }

  return ranges;
}

const PX_PER_MM = 3.7795275591;

// Parse '14mm 18mm' → { v: 14, h: 18 } (values in mm)
function parseMargin(margin) {
  const parts = margin.trim().split(/\s+/);
  const v = parseFloat(parts[0]) || 0;
  const h = parseFloat(parts[1] ?? parts[0]) || 0;
  return { v, h };
}

export function exportToPDF(elementId, filename = 'resume.pdf', pageMargin = '14mm 18mm') {
  // The outer wrapper: id="resume-preview", has width:210mm, padding:margin, fontSize, lineHeight
  // Its firstElementChild is the measured content div (contentRef)
  const outer = document.getElementById(elementId);
  if (!outer) return Promise.resolve();

  const contentEl = outer.firstElementChild;
  if (!contentEl) return Promise.resolve();

  return new Promise(resolve => {
    const { v: vMm } = parseMargin(pageMargin);
    const pageContentMm = 297 - 2 * vMm;
    const pageContentPx = pageContentMm * PX_PER_MM;

    const ranges = computeRanges(contentEl, pageContentPx);

    const fontSize = outer.style.fontSize || '11px';
    const lineHeight = outer.style.lineHeight || '1.5';

    // Build one explicit A4 div per page so each page gets correct margins
    // and @page { margin: 0 } suppresses browser URL/date/title decorations
    const portal = document.createElement('div');
    portal.id = '__cpwtcv_print_portal__';

    ranges.forEach(range => {
      const page = document.createElement('div');
      page.className = '__cpwtcv_page__';
      page.style.cssText = [
        'width: 210mm',
        'height: 297mm',
        `padding: ${pageMargin}`,
        'box-sizing: border-box',
        'overflow: hidden',
        'background: white',
        `font-size: ${fontSize}`,
        `line-height: ${lineHeight}`,
      ].join('; ');

      const clip = document.createElement('div');
      clip.style.cssText = `overflow: hidden; height: ${Math.min(range.height, pageContentPx)}px`;

      const contentClone = contentEl.cloneNode(true);
      contentClone.style.transform = `translateY(-${range.start}px)`;
      // Preserve any inline positioning overrides from the original
      contentClone.style.position = '';

      clip.appendChild(contentClone);
      page.appendChild(clip);
      portal.appendChild(page);
    });

    document.body.appendChild(portal);

    const style = document.createElement('style');
    style.id = '__cpwtcv_print_style__';
    style.textContent = `
      @media print {
        @page {
          size: A4;
          margin: 0;
        }
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          background: white !important;
          height: auto !important;
          overflow: visible !important;
        }
        body > *:not(#__cpwtcv_print_portal__) { display: none !important; }
        #__cpwtcv_print_portal__ { display: block !important; }
        .__cpwtcv_page__ { page-break-after: always; }
        .__cpwtcv_page__:last-child { page-break-after: auto; }
        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
          /* Strip decorative CSS that adds noise or bloat in PDF */
          box-shadow: none !important;
          text-shadow: none !important;
          transition: none !important;
          animation: none !important;
        }

        /* ATS COMPATIBILITY — use system fonts so Chrome's PDF engine writes
           standard glyph-to-Unicode mappings. Subsetted Google Fonts (e.g. Noto Sans)
           cause misreads in Workday: "WoW" → "Work", "Natwest" → "Netverst".
           System fonts (Arial/Helvetica) are never embedded — they are referenced by
           name, which also dramatically reduces PDF file size (~500KB → ~50KB). */
        #__cpwtcv_print_portal__ * {
          font-family: Arial, Helvetica, 'Liberation Sans', sans-serif !important;
        }

        /* Guard against the browser's print-mode UA stylesheet giving h1/h2/p their own
           default line-height instead of inheriting the page's configured lineHeightValue
           (settings.lineHeightValue, set on each .__cpwtcv_page__ above). Must be "inherit",
           not a hardcoded number — h2 section headings and <p> body text (rich-text content
           is user-authored HTML, often wrapped in <p>) both need to track the user's actual
           Line Height setting to match the Canvas preview and the react-pdf export. */
        #__cpwtcv_print_portal__ h1,
        #__cpwtcv_print_portal__ h2,
        #__cpwtcv_print_portal__ p {
          line-height: inherit !important;
        }

        /* ATS COMPATIBILITY — strip bold from rich-text content inside descriptions.
           Bold <strong>/<b> project sub-headers look like entry-level markers to ATS
           parsers, causing them to lose the actual company name for that entry.
           (e.g. LTIMindtree, Crossdev, Indegene company names went missing in Workday) */
        #__cpwtcv_print_portal__ .rich-text-output strong,
        #__cpwtcv_print_portal__ .rich-text-output b {
          font-weight: normal !important;
        }

        /* ATS COMPATIBILITY — hide SVG icons (contact info icons, brand icons).
           ATS parsers read SVG path data as gibberish text, polluting parsed output.
           The text labels remain fully readable without the icons. */
        #__cpwtcv_print_portal__ svg {
          display: none !important;
        }
      }
    `;
    document.head.appendChild(style);

    const originalTitle = document.title;
    document.title = filename.replace(/\.pdf$/i, '').replace(/_/g, ' ').replace(/-/g, ' ');

    function cleanup() {
      document.title = originalTitle;
      style.remove();
      portal.remove();
      window.removeEventListener('afterprint', cleanup);
      resolve();
    }

    window.addEventListener('afterprint', cleanup);
    window.print();
    setTimeout(cleanup, 60000);
  });
}
