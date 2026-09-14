import { useState, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

const PX_PER_MM = 96 / 25.4;

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

export function PaginatedPreview({ resume, ActiveTemplate, margin, fontSize, lineHeight, pageContentMm, zoom = 1 }) {
  const contentRef = useRef(null);
  const [ranges, setRanges] = useState([{ start: 0, height: 0 }]);

  useLayoutEffect(() => {
    function measure() {
      const el = contentRef.current;
      if (!el) return;
      const next = computeRanges(el, pageContentMm * PX_PER_MM);
      setRanges(prev =>
        prev.length === next.length &&
        prev.every((r, k) => Math.abs(r.start - next[k].start) < 1 && Math.abs(r.height - next[k].height) < 1)
          ? prev : next
      );
    }
    measure();
    const ro = new ResizeObserver(measure);
    if (contentRef.current) ro.observe(contentRef.current);
    if (document.fonts?.ready) document.fonts.ready.then(measure);
    return () => ro.disconnect();
  }, [resume, margin, fontSize, lineHeight, pageContentMm]);

  // Portal measure node to <body> so it never participates in editor scroll metrics
  // (up or down). Full layout width so getBoundingClientRect pagination stays accurate.
  const measurePortal = createPortal(
    <div
      aria-hidden
      style={{
        position: 'fixed',
        left: '-10000px',
        top: 0,
        width: '210mm',
        visibility: 'hidden',
        pointerEvents: 'none',
        zIndex: -1,
      }}
    >
      <div
        id="resume-preview"
        className="bg-white"
        style={{ width: '210mm', padding: margin, fontSize, lineHeight }}
      >
        <div ref={contentRef}>
          <ActiveTemplate data={resume} />
        </div>
      </div>
    </div>,
    document.body,
  );

  return (
    <>
      {measurePortal}

      {/* Visible A4 pages only — no off-screen tall siblings in this tree */}
      <div style={{ zoom }} className="flex flex-col items-center gap-6 w-full">
        {ranges.map((range, i) => (
          <div
            key={i}
            className="bg-white shadow-2xl relative shrink-0"
            style={{ width: '210mm', height: '297mm', padding: margin, fontSize, lineHeight }}
          >
            <div style={{ height: `${Math.min(range.height, pageContentMm * PX_PER_MM)}px`, overflow: 'hidden' }}>
              <div style={{ transform: `translateY(-${range.start}px)` }}>
                <ActiveTemplate data={resume} />
              </div>
            </div>
            {ranges.length > 1 && (
              <span className="absolute bottom-3 right-4 text-[9px] text-gray-300 select-none">
                Page {i + 1} of {ranges.length}
              </span>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
