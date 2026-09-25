// The workspace UI kit (Boards + Job Tracker) — import from '@/components/ui'. Each component's
// contract is in the JSDoc above it; the design rules are docs/tracking/boards-jobs-plan/01-design-and-kit.md.
export { Avatar } from './Avatar.jsx';
export { Badge, TONE_CLASSES } from './Badge.jsx';
export { Button, buttonClass, FOCUS_RING } from './Button.jsx';
export { Chip } from './Chip.jsx';
export { ConfirmDialog, ConfirmProvider, useConfirm, useConfirmOptional } from './ConfirmDialog.jsx';
export { DatePill } from './DatePill.jsx';
export { Dialog } from './Dialog.jsx';
export { EmptyState } from './EmptyState.jsx';
export { Field, controlClass, useFieldIds } from './Field.jsx';
export { IconButton } from './IconButton.jsx';
export { InlineEdit } from './InlineEdit.jsx';
export { Kbd, isMacPlatform } from './Kbd.jsx';
export { Menu } from './Menu.jsx';
export { MultiSelectPopover } from './MultiSelectPopover.jsx';
export { NavTabs } from './NavTabs.jsx';
export { Popover } from './Popover.jsx';
export { Portal } from './Portal.jsx';
export { ProgressBar } from './ProgressBar.jsx';
export { SearchInput } from './SearchInput.jsx';
export { SegmentedControl } from './SegmentedControl.jsx';
export { Select } from './Select.jsx';
export { ShortcutsDialog } from './ShortcutsDialog.jsx';
export { Skeleton } from './Skeleton.jsx';
export { Tabs, TabPanel, TabCount } from './Tabs.jsx';
export { TextArea } from './TextArea.jsx';
export { TextField } from './TextField.jsx';
export { Toast, ToastProvider, useToast } from './Toast.jsx';
export { Tooltip } from './Tooltip.jsx';
export { cx, mergeRefs, composeHandlers, focusNeighbour, tabbables } from './compose.js';
// The kit's two hooks for pages, re-exported so one import serves a page.
export { useHotkeys } from '../../hooks/useHotkeys.js';
export { useUrlState } from '../../hooks/useUrlState.js';
// The kit's own building blocks, for a page's custom picker or overlay.
export { useFocusTrap } from './useFocusTrap.js';
export { usePresence, prefersReducedMotion } from './usePresence.js';
export { useScrollLock } from './useScrollLock.js';
export { useFloating } from './useFloating.js';
export { useDismiss } from './useDismiss.js';
