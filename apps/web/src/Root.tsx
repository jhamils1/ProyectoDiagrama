import { lazy, Suspense } from 'react'
import App from './App'
const AccountWorkspace = lazy(() => import('./features/access/AccountWorkspace'))
export function Root() {
  return window.location.pathname.startsWith('/workspace') ? (
    <Suspense fallback={<p className="loading-copy">Cargando espacio de trabajo…</p>}>
      <AccountWorkspace />
    </Suspense>
  ) : (
    <App />
  )
}
