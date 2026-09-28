import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createHashRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import App from './App.jsx'

// A data router (still the hash's addresses), so a page can hold a navigation with useBlocker: the
// job form asks before the browser's Back or a link drops what was typed (R4-DUX-06). The app's
// own <Routes> (AppRoutes) sit under its one catch-all route, as they sat under <HashRouter>.
const router = createHashRouter([{ path: '*', element: <App /> }])

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
