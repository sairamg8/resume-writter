/**
 * Resume contact icons for @react-pdf — paths match canvas brandIcons.
 */
import { Svg, Path, Circle, Rect } from '@react-pdf/renderer';

const SW = '1.75';

export function MailIcon({ size = 9, color = '#555555' }) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Rect x="3" y="5" width="18" height="14" rx="2.5" fill="none" stroke={color} strokeWidth={SW} />
      <Path
        d="m3.5 7.5 7.6 5.2a1.5 1.5 0 0 0 1.8 0l7.6-5.2"
        fill="none"
        stroke={color}
        strokeWidth={SW}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function PhoneIcon({ size = 9, color = '#555555' }) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Rect x="7" y="2.5" width="10" height="19" rx="2.25" fill="none" stroke={color} strokeWidth={SW} />
      <Path d="M10 5.25h4" fill="none" stroke={color} strokeWidth={SW} strokeLinecap="round" />
      <Circle cx="12" cy="17.5" r="0.9" fill={color} stroke="none" />
    </Svg>
  );
}

export function MapPinIcon({ size = 9, color = '#555555' }) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Path
        d="M12 21s-6.5-5.2-6.5-10.2a6.5 6.5 0 1 1 13 0C18.5 15.8 12 21 12 21z"
        fill="none"
        stroke={color}
        strokeWidth={SW}
        strokeLinejoin="round"
      />
      <Circle cx="12" cy="10.5" r="2.25" fill="none" stroke={color} strokeWidth={SW} />
    </Svg>
  );
}

export function GlobeIcon({ size = 9, color = '#555555' }) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Circle cx="12" cy="12" r="9" fill="none" stroke={color} strokeWidth={SW} />
      <Path d="M3 12h18" fill="none" stroke={color} strokeWidth={SW} strokeLinecap="round" />
      <Path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z" fill="none" stroke={color} strokeWidth={SW} />
    </Svg>
  );
}

export function LinkedinPdfIcon({ size = 9, color = '#555555' }) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Rect x="3" y="3" width="18" height="18" rx="3" fill="none" stroke={color} strokeWidth={SW} />
      <Path d="M8 11v6" fill="none" stroke={color} strokeWidth={SW} strokeLinecap="round" />
      <Circle cx="8" cy="8" r="0.9" fill={color} stroke="none" />
      <Path
        d="M12 17v-4.2c0-1.4.7-2.3 1.9-2.3 1.1 0 1.6.7 1.6 2.2V17"
        fill="none"
        stroke={color}
        strokeWidth={SW}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M12 11.5V17" fill="none" stroke={color} strokeWidth={SW} strokeLinecap="round" />
    </Svg>
  );
}

export function GithubPdfIcon({ size = 9, color = '#555555' }) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Path
        d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12 12 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21"
        fill="none"
        stroke={color}
        strokeWidth={SW}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/* ── Filled / solid pack (Emily Carter–style) ───────────────────────── */

export function FilledMailPdf({ size = 9, color = '#555555' }) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Path
        d="M2.75 6.5A2.75 2.75 0 0 1 5.5 3.75h13A2.75 2.75 0 0 1 21.25 6.5v11a2.75 2.75 0 0 1-2.75 2.75h-13A2.75 2.75 0 0 1 2.75 17.5v-11zm1.85.9 6.7 4.55c.4.27.9.27 1.3 0l6.7-4.55v-.4c0-.55-.45-1-1-1h-13c-.55 0-1 .45-1 1v.4z"
        fill={color}
      />
    </Svg>
  );
}

export function FilledPhonePdf({ size = 9, color = '#555555' }) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Path
        d="M7.05 2.6c.7-1.15 2.2-1.55 3.4-.9l1.65.9c.95.5 1.3 1.7.85 2.7l-.65 1.55c-.25.6-.1 1.3.4 1.7l2.05 2.05c.45.45 1.15.6 1.7.4l1.55-.65c1-.45 2.2-.1 2.7.85l.9 1.65c.65 1.2.25 2.7-.9 3.4-1.55.9-3.45 1.55-5.3 1.55-6.35 0-11.5-5.15-11.5-11.5 0-1.85.65-3.75 1.55-5.3.5-.85 1.5-1.3 2.55-1z"
        fill={color}
      />
    </Svg>
  );
}

export function FilledPinPdf({ size = 9, color = '#555555' }) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Path
        fill={color}
        fillRule="evenodd"
        d="M12 2.5c-3.9 0-7 3.05-7 6.8 0 4.55 5.4 10.55 6.55 11.75a.7.7 0 0 0 .9 0C13.6 19.85 19 13.85 19 9.3c0-3.75-3.1-6.8-7-6.8zm0 9.3a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"
      />
    </Svg>
  );
}

export function FilledGlobePdf({ size = 9, color = '#555555' }) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Path
        fill={color}
        fillRule="evenodd"
        d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-7.5 9.2h3.05c.15-2.05.7-3.9 1.5-5.35A8.05 8.05 0 0 0 4.5 11.2zm4.55 1.6H4.5a8.05 8.05 0 0 0 4.55 5.35c-.8-1.45-1.35-3.3-1.5-5.35zm1.5 0h3.9c-.15 2.2-.75 4.15-1.65 5.55-.4.6-.8 1.05-1.3 1.4-.5-.35-.9-.8-1.3-1.4-.9-1.4-1.5-3.35-1.65-5.55zm0-1.6c.15-2.2.75-4.15 1.65-5.55.4-.6.8-1.05 1.3-1.4.5.35.9.8 1.3 1.4.9 1.4 1.5 3.35 1.65 5.55h-5.9zm5.4 0h3.05a8.05 8.05 0 0 0-4.55-5.35c.8 1.45 1.35 3.3 1.5 5.35zm0 1.6c-.15 2.05-.7 3.9-1.5 5.35a8.05 8.05 0 0 0 4.55-5.35h-3.05z"
      />
    </Svg>
  );
}

export function FilledLinkedinPdf({ size = 9, color = '#555555' }) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" fill={color} />
      <Circle cx="8.2" cy="8.1" r="1.15" fill="#ffffff" />
      <Rect x="7.15" y="9.9" width="2.05" height="7.35" fill="#ffffff" />
      <Path
        d="M11.2 9.9h1.96v1h.03c.27-.52.94-1.07 1.94-1.07 2.07 0 2.45 1.36 2.45 3.13v4.29h-2.05v-3.8c0-.9-.02-2.07-1.26-2.07-1.26 0-1.45.99-1.45 2v3.87H11.2V9.9z"
        fill="#ffffff"
      />
    </Svg>
  );
}

export function FilledGithubPdf({ size = 9, color = '#555555' }) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Path
        d="M12 2C6.48 2 2 6.58 2 12.26c0 4.52 2.87 8.35 6.84 9.7.5.1.68-.22.68-.48 0-.24-.01-.87-.01-1.7-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.36 1.12 2.94.86.09-.67.35-1.12.63-1.38-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.32.1-2.75 0 0 .84-.27 2.75 1.05A9.3 9.3 0 0 1 12 6.84c.85 0 1.71.12 2.51.34 1.9-1.32 2.74-1.05 2.74-1.05.55 1.43.2 2.49.1 2.75.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.8-4.57 5.06.36.32.68.94.68 1.9 0 1.38-.01 2.48-.01 2.82 0 .26.18.58.69.48A10.27 10.27 0 0 0 22 12.26C22 6.58 17.52 2 12 2z"
        fill={color}
      />
    </Svg>
  );
}
