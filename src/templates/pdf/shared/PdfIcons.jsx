import { Svg, Path, Circle, Rect } from '@react-pdf/renderer';

export function MailIcon({ size = 9, color = '#555555' }) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Rect x="2" y="4" width="20" height="16" rx="2" fill="none" stroke={color} strokeWidth="2" />
      <Path d="M22 7 13.03 12.7a1.94 1.94 0 0 1-2.06 0L2 7" fill="none" stroke={color} strokeWidth="2" />
    </Svg>
  );
}

export function PhoneIcon({ size = 9, color = '#555555' }) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.49 12.58 19.79 19.79 0 0 1 1.43 4a2 2 0 0 1 1.99-2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.29 6.29l.75-.75a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" fill="none" stroke={color} strokeWidth="2" />
    </Svg>
  );
}

export function MapPinIcon({ size = 9, color = '#555555' }) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" fill="none" stroke={color} strokeWidth="2" />
      <Circle cx="12" cy="10" r="3" fill="none" stroke={color} strokeWidth="2" />
    </Svg>
  );
}

export function GlobeIcon({ size = 9, color = '#555555' }) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Circle cx="12" cy="12" r="10" fill="none" stroke={color} strokeWidth="2" />
      <Path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" fill="none" stroke={color} strokeWidth="2" />
      <Path d="M2 12h20" fill="none" stroke={color} strokeWidth="2" />
    </Svg>
  );
}

export function LinkedinPdfIcon({ size = 9, color = '#555555' }) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Rect x="2" y="2" width="20" height="20" rx="2" fill="none" stroke={color} strokeWidth="2" />
      <Path d="M7 10v8" fill="none" stroke={color} strokeWidth="2" />
      <Circle cx="7" cy="7" r="1.5" fill={color} stroke="none" />
      <Path d="M11 10v8" fill="none" stroke={color} strokeWidth="2" />
      <Path d="M11 14a3 3 0 0 1 6 0v4" fill="none" stroke={color} strokeWidth="2" />
    </Svg>
  );
}

export function GithubPdfIcon({ size = 9, color = '#555555' }) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" fill="none" stroke={color} strokeWidth="2" />
    </Svg>
  );
}
