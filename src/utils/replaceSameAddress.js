// A press on a link to the page the browser is already on takes that page's place in the history, as the
// browser's own links do. React Router's Link decides that from the location it last RENDERED, and the app's
// router renders a navigation in a transition: while the next page's code is still on its way, the rendered
// location is the old one, so a second press (a double click) was a link to somewhere else, and pushed the
// page a second time. Back from it then "did nothing", landing on the same page again. The router's own
// location is already the new one by then, so the router is asked instead.
import { createPath, parsePath } from 'react-router-dom';

/**
 * `router` (a data router) whose `navigate` replaces the current entry when it is given the address it
 * stands at. Only an address as text and without its own state: a different search or hash, or a state
 * the page reads (a marker for Back), is a different place and still pushes. Returns `router`.
 */
export function replaceSameAddress(router) {
  const navigate = router.navigate.bind(router);
  router.navigate = (to, options) => {
    if (typeof to !== 'string' || options?.replace === true || options?.state !== undefined) return navigate(to, options);
    const at = router.state.navigation?.location ?? router.state.location;
    return navigate(to, createPath(parsePath(to)) === createPath(at) ? { ...options, replace: true } : options);
  };
  return router;
}
