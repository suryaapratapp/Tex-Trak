import './lib/tz'
import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

// A customer opening the link from their email sees only their delivery: no sign-in, none of the app.
const PublicDelivery = lazy(() => import('./pages/PublicDelivery'))
const m = location.pathname.match(/^\/track\/([A-Za-z0-9]{32,})\/?$/) ?? new URLSearchParams(location.search).get('track')?.match(/^([A-Za-z0-9]{32,})$/)
createRoot(document.getElementById('root')!).render(<StrictMode>{m ? <Suspense fallback={null}><PublicDelivery token={m[1]} /></Suspense> : <App />}</StrictMode>)
