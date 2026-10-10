import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createHashRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { replaceSameAddress } from './utils/replaceSameAddress.js'
import { registerShellWorker } from './utils/shellWorker.js'

// A data router (still the hash's addresses), so a page can hold a navigation with useBlocker: the
// job form asks before the browser's Back or a link drops what was typed (R4-DUX-06). The app's
// own <Routes> (AppRoutes) sit under its one catch-all route, as they sat under <HashRouter>. A press on
// a link to the page it is on replaces that entry, also while the page's code loads (replaceSameAddress).
const router = replaceSameAddress(createHashRouter([{ path: '*', element: <App /> }]))

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)

// The app shell opens offline (public/sw.js): registered after the page has loaded, in a production build only.
registerShellWorker(import.meta.env)
