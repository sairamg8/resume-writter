import { useLocation, useNavigate } from 'react-router-dom';

/**
 * The notice a document import leaves for the editor (importDocument: the route's state), and its
 * Dismiss, which takes it off the history entry so a reload or Back does not bring it again.
 */
export function useImportNotice() {
  const location = useLocation();
  const navigate = useNavigate();
  const notice = typeof location.state?.importNotice === 'string' ? location.state.importNotice : null;
  const dismiss = () => {
    const { importNotice: _gone, ...rest } = location.state || {};
    navigate({ pathname: location.pathname, search: location.search, hash: location.hash }, { replace: true, state: Object.keys(rest).length ? rest : null });
  };
  return { notice, dismiss };
}
