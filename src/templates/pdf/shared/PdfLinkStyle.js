import { createContext, useContext } from 'react';
import { linkLook } from '@/utils/linkStyle';

/**
 * Design → Links of the document being drawn ({ style, accent }: settings.linkStyle and the accent,
 * R2-147). renderResumePdf and renderCoverLetterPdf provide it around the template, as Lists' bullet
 * style, so every link — ContactValue's and a description's — prints it without each section passing
 * it down. Nothing provided: links print as they always have.
 */
export const LinkStyle = createContext(null);

/** The colour behind the links inside it, where that is not the white page: a banner, a band, the Sidebar's column. */
export const LinkGround = createContext(null);

/** The react-pdf style a link adds here: an underline, or its accent colour (linkLook); {} for Plain. */
export function useLinkLook() {
  const chosen = useContext(LinkStyle);
  const ground = useContext(LinkGround);
  if (!chosen) return {};
  const look = linkLook(chosen.style, chosen.accent, ground);
  return { ...(look.underline && { textDecoration: 'underline' }), ...(look.color && { color: look.color }) };
}
