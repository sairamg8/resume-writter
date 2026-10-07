import { Copy, MoreHorizontal, Pencil, Pin, PinOff, SquarePen, Trash2 } from 'lucide-react';
import { Menu } from '@/components/ui/Menu';
import { IconButton } from '@/components/ui/IconButton';
import { KEEP_HINT, LAST_ORIGINAL_HINT } from '@/constants/cardHints';

/**
 * A card's more menu (the kit's Menu), loaded on the first hover, focus or press of the card's ⋯ button
 * (lazyPiece.jsx) — never with the start-up code. ResumeCard keeps plain Edit, Copy and Delete buttons for
 * the time its code cannot be had. `open` / `onOpenChange` are the card's, so a press made while this
 * code was still arriving opens it once it has. `onKeep`: only in a demo account (Keep as my original).
 */
export function CardMenu({ resume, original, lastOriginal, onOpen, onDuplicate, onDelete, onRename, onKeep, open, onOpenChange }) {
  const items = [
    { label: 'Edit', icon: SquarePen, onSelect: () => onOpen(resume.id) },
    { label: 'Rename', icon: Pencil, onSelect: onRename },
    { label: 'Copy', icon: Copy, onSelect: () => onDuplicate(resume.id) },
    ...(onKeep ? [original
      ? { label: 'Stop keeping', icon: PinOff, description: KEEP_HINT, onSelect: () => onKeep(resume.id, false) }
      : { label: 'Keep as my original', icon: Pin, description: KEEP_HINT, onSelect: () => onKeep(resume.id, true) }] : []),
    { type: 'separator' },
    { label: 'Delete', icon: Trash2, danger: true, disabled: lastOriginal, description: lastOriginal ? LAST_ORIGINAL_HINT : undefined, onSelect: () => onDelete(resume.id) },
  ];
  return (
    <Menu
      open={open}
      onOpenChange={onOpenChange}
      label="Document actions"
      trigger={<IconButton icon={MoreHorizontal} label="More" size="sm" data-testid="resume-card-more" />}
      items={items}
    />
  );
}
