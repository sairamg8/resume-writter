import { useLocation, useNavigate } from 'react-router-dom';

/**
 * A page's back arrow: the page before it in this app, or the dashboard when there is none — a
 * direct visit or a link from another site (the router marks the first entry it saw 'default').
 * navigate(-1) alone did nothing there, or left the site (R2-074).
 */
export function useBackOrHome() {
  const navigate = useNavigate();
  const { key } = useLocation();
  return () => (key === 'default' ? navigate('/') : navigate(-1));
}
