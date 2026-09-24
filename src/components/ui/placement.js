// Where a floating panel (menu, popover, tooltip, submenu) goes next to its anchor so it stays
// inside the viewport: flip to the other side when the preferred one has no room, then shift along
// the anchor to keep the whole panel visible, and say how tall it may grow (maxHeight) so a long
// list scrolls inside instead of running off the screen. Pure — no DOM, no React — so node tests
// drive it with plain rectangles (tests/unit/ui-placement.unit.mjs); useFloating measures and calls it.

const OPPOSITE = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };

/** 'bottom-start' → { side: 'bottom', align: 'start' }; align defaults to 'center'. */
export function parsePlacement(placement = 'bottom-start') {
  const parts = String(placement).split('-');
  const side = parts[0] || 'bottom';
  const align = parts[1] || 'center';
  return { side: OPPOSITE[side] ? side : 'bottom', align: ['start', 'end', 'center'].includes(align) ? align : 'center' };
}

const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

/** The room on each side of the anchor, inside the viewport's padding. */
function roomAround(anchor, viewport, offset, padding) {
  return {
    top: anchor.top - offset - padding,
    bottom: viewport.height - anchor.bottom - offset - padding,
    left: anchor.left - offset - padding,
    right: viewport.width - anchor.right - offset - padding,
  };
}

/**
 * The panel's position: `{ top, left, side, align, maxHeight, maxWidth }` in viewport pixels
 * (for `position: fixed`).
 *
 * - `anchor`: the anchor's rectangle ({ top, left, right, bottom, width, height }, as
 *   getBoundingClientRect gives it); `floating`: the panel's { width, height }.
 * - `placement`: 'bottom-start' (default), 'bottom-end', 'top', 'right-start', …
 * - The panel flips to the opposite side only when that side has more room than the preferred one
 *   and the preferred one is too small, so a menu near the bottom opens upwards.
 * - It then slides along the anchor to stay `padding` px inside the viewport; a panel wider (or
 *   taller) than the viewport starts at the padding and is capped by maxWidth (maxHeight).
 */
export function computePlacement({ anchor, floating, viewport, placement = 'bottom-start', offset = 6, padding = 8 }) {
  const { side: wanted, align } = parsePlacement(placement);
  const room = roomAround(anchor, viewport, offset, padding);
  const vertical = wanted === 'top' || wanted === 'bottom';
  const size = vertical ? floating.height : floating.width;
  const other = OPPOSITE[wanted];
  const side = size > room[wanted] && room[other] > room[wanted] ? other : wanted;

  let top;
  let left;
  if (vertical) {
    top = side === 'bottom' ? anchor.bottom + offset : anchor.top - offset - Math.min(floating.height, Math.max(room.top, 0));
    if (align === 'start') left = anchor.left;
    else if (align === 'end') left = anchor.right - floating.width;
    else left = anchor.left + anchor.width / 2 - floating.width / 2;
    left = clamp(left, padding, Math.max(padding, viewport.width - padding - floating.width));
  } else {
    left = side === 'right' ? anchor.right + offset : anchor.left - offset - floating.width;
    if (align === 'start') top = anchor.top;
    else if (align === 'end') top = anchor.bottom - floating.height;
    else top = anchor.top + anchor.height / 2 - floating.height / 2;
    top = clamp(top, padding, Math.max(padding, viewport.height - padding - floating.height));
    // No room on either side (a submenu on a phone): overlap the anchor rather than leave the screen.
    left = clamp(left, padding, Math.max(padding, viewport.width - padding - floating.width));
  }

  const maxHeight = Math.max(80, vertical ? room[side] : viewport.height - 2 * padding);
  const maxWidth = Math.max(80, viewport.width - 2 * padding);
  return { top: Math.round(top), left: Math.round(left), side, align, maxHeight: Math.floor(maxHeight), maxWidth };
}
