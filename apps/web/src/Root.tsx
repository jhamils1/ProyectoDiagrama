import { lazy, Suspense } from 'react'
import App from './App'
const AccountWorkspace = lazy(() => import('./features/access/AccountWorkspace'))
const AiLab = lazy(() => import('./features/ai/ui/AiLab'))
export function Root() {
  if (window.location.pathname === '/ai-lab')
    return (
      <Suspense fallback={<p>Cargando laboratorio…</p>}>
        <AiLab />
      </Suspense>
    )
  return window.location.pathname.startsWith('/workspace') ? (
    <Suspense fallback={<p className="loading-copy">Cargando espacio de trabajo…</p>}>
      <AccountWorkspace />
    </Suspense>
  ) : (
    <App />
  )
}
