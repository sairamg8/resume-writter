// "An icon and its label sit on one row" measured in a real browser (the Import dialog's Upload and Pin icons
// sat ABOVE their labels: the kit's Button wraps its children in an inline <span class="truncate"> and Tailwind
// v4's preflight makes every svg a block, so an icon written as a child broke the line). One function for both
// runners: Playwright runs it in the page (`locator.evaluate(stackedIcons)`), Cypress calls it on an element of
// the app's window. It uses nothing outside itself, because Playwright sends its source to the page.
//
// For every visible button, link, [role=button], [role=menuitem] and label under `root` that holds a painted svg
// AND painted text, the icon's vertical span must overlap the text's (its union over all lines): an icon wholly
// above or below its label is stacked. A control the author made a column on purpose (flex-direction: column or
// a grid around the icon, as the dashboard's "New Resume" tile) is skipped. A control one row high (48 px or less)
// must also hold its label inside its own box (3 px of slack for a font taller than its line). Text counts when its
// rects are more than 2 px wide and high (a range over screen-reader-only text keeps its glyph width, so such a
// label would count; there is none beside an icon today). Returns how many controls it checked, so a pass cannot
// be blind.
/**
 * @param {Element} root
 * @returns {{ checked: number, offenders: string[] }}
 */
export function stackedIcons(root) {
  const doc = root.ownerDocument;
  const view = doc.defaultView;
  const painted = (r) => r.width > 2 && r.height > 2;
  const offenders = [];
  let checked = 0;
  for (const el of root.querySelectorAll('button, a[href], [role="button"], [role="menuitem"], label')) {
    if (el.getClientRects().length === 0 || view.getComputedStyle(el).visibility === 'hidden') continue;
    const icons = [...el.querySelectorAll('svg')].map((svg) => ({ svg, r: svg.getBoundingClientRect() })).filter((i) => painted(i.r));
    if (icons.length === 0) continue;
    const lines = [];
    const walker = doc.createTreeWalker(el, 4); // 4: text nodes
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.data.trim() || n.parentElement.closest('svg')) continue;
      const range = doc.createRange();
      range.selectNodeContents(n);
      lines.push(...[...range.getClientRects()].filter(painted));
    }
    if (lines.length === 0) continue; // an icon-only control
    checked += 1;
    const top = Math.min(...lines.map((r) => r.top));
    const bottom = Math.max(...lines.map((r) => r.bottom));
    const name = `${el.tagName.toLowerCase()} "${el.textContent.trim().replace(/\s+/g, ' ').slice(0, 30)}"`;
    const column = (svg) => {
      for (let n = svg.parentElement; n; n = n.parentElement) {
        const s = view.getComputedStyle(n);
        if ((/flex/.test(s.display) && s.flexDirection.startsWith('column')) || /grid/.test(s.display)) return true;
        if (n === el) break;
      }
      return false;
    };
    for (const { svg, r } of icons) {
      if (column(svg)) continue;
      if (r.bottom <= top + 1) offenders.push(`${name}: the icon (${r.top.toFixed(1)}..${r.bottom.toFixed(1)}) is above its label (${top.toFixed(1)}..${bottom.toFixed(1)})`);
      else if (r.top >= bottom - 1) offenders.push(`${name}: the icon (${r.top.toFixed(1)}..${r.bottom.toFixed(1)}) is below its label (${top.toFixed(1)}..${bottom.toFixed(1)})`);
    }
    const box = el.getBoundingClientRect();
    if (box.height <= 48 && (top < box.top - 3 || bottom > box.bottom + 3)) {
      offenders.push(`${name}: the label (${top.toFixed(1)}..${bottom.toFixed(1)}) sticks out of its ${box.height.toFixed(1)} px button (${box.top.toFixed(1)}..${box.bottom.toFixed(1)})`);
    }
  }
  return { checked, offenders };
}
