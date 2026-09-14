/**
 * Resume contact icons — canvas (SVG).
 * Refined monochrome marks (currentColor) so they work on light and dark headers.
 * API matches Lucide: size, strokeWidth, className, style.
 */

function IconShell({ size = 16, strokeWidth = 1.75, className = '', style, children }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden
    >
      {children}
    </svg>
  );
}

/** Envelope */
export function MailIcon({ size = 16, strokeWidth = 1.75, className = '', style }) {
  return (
    <IconShell size={size} strokeWidth={strokeWidth} className={className} style={style}>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m3.5 7.5 7.6 5.2a1.5 1.5 0 0 0 1.8 0l7.6-5.2" />
    </IconShell>
  );
}

/** Smartphone — cleaner than classic handset at small sizes */
export function PhoneIcon({ size = 16, strokeWidth = 1.75, className = '', style }) {
  return (
    <IconShell size={size} strokeWidth={strokeWidth} className={className} style={style}>
      <rect x="7" y="2.5" width="10" height="19" rx="2.25" />
      <path d="M10 5.25h4" />
      <circle cx="12" cy="17.5" r="0.9" fill="currentColor" stroke="none" />
    </IconShell>
  );
}

/** Map pin */
export function MapPinIcon({ size = 16, strokeWidth = 1.75, className = '', style }) {
  return (
    <IconShell size={size} strokeWidth={strokeWidth} className={className} style={style}>
      <path d="M12 21s-6.5-5.2-6.5-10.2a6.5 6.5 0 1 1 13 0C18.5 15.8 12 21 12 21z" />
      <circle cx="12" cy="10.5" r="2.25" />
    </IconShell>
  );
}

/** Globe */
export function GlobeIcon({ size = 16, strokeWidth = 1.75, className = '', style }) {
  return (
    <IconShell size={size} strokeWidth={strokeWidth} className={className} style={style}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z" />
    </IconShell>
  );
}

/**
 * LinkedIn — rounded tile + “in” (stroke-only, works on dark/light).
 */
export function LinkedinIcon({ size = 16, strokeWidth = 1.75, className = '', style }) {
  return (
    <IconShell size={size} strokeWidth={strokeWidth} className={className} style={style}>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M8 11v6" />
      <circle cx="8" cy="8" r="0.9" fill="currentColor" stroke="none" />
      <path d="M12 17v-4.2c0-1.4.7-2.3 1.9-2.3 1.1 0 1.6.7 1.6 2.2V17" />
      <path d="M12 11.5V17" />
    </IconShell>
  );
}

/** GitHub — clean monochrome cat mark (outline-friendly path) */
export function GithubIcon({ size = 16, strokeWidth = 1.75, className = '', style }) {
  return (
    <IconShell size={size} strokeWidth={strokeWidth} className={className} style={style}>
      <path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12 12 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21" />
    </IconShell>
  );
}

// Lucide-compatible aliases used across templates
export const Mail = MailIcon;
export const Phone = PhoneIcon;
export const MapPin = MapPinIcon;
export const Globe = GlobeIcon;
