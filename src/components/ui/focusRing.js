// The kit's focus ring, in a module of its own: IconButton (the close button of every Dialog, the
// Dashboard's New Cover Letter among them) needs only this, and importing it from Button.jsx put the
// Button component on the start-up path (71-startup-chunks). Button.jsx re-exports it.

/** The kit's focus ring: every interactive element wears it for keyboard focus only. */
export const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 focus-visible:ring-offset-1 focus-visible:ring-offset-white';
