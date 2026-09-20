import { useEffect, useRef, useState } from 'react'
import { projectCopies } from '../infrastructure/projectCopies'
import { synchronizeCopy } from './syncProjectCopy'
import { ApiError, errorMessage } from '../../../shared/api'

// One sequential worker for closed editors in this workspace. The active copy retains its
// own polling/draft guards. Cross-tab retries are safe through frozen bodies and server receipts.
export function useProjectSynchronization(userId: string | undefined, activeKey: string | null) {
  const [syncing, setSyncing] = useState(false)
  const [summary, setSummary] = useState(
    'Las copias pendientes se sincronizan con este espacio abierto.',
  )
  const run = useRef<() => Promise<void>>(async () => {})
  useEffect(() => {
    if (!userId) {
      run.current = async () => {}
      return
    }
    let canceled = false,
      running = false
    async function synchronize() {
      if (canceled || running) return
      running = true
      try {
        const values = await projectCopies().list(userId!)
        const pending = values.filter((c) => c.key !== activeKey && (c.pending || c.conflict))
        if (!canceled) setSyncing(pending.length > 0)
        let failures = 0,
          conflicts = 0
        for (const copy of pending) {
          if (canceled) break
          try {
            const saved = await synchronizeCopy(userId!, copy.project.id, copy.document.id)
            if (saved.conflict) conflicts++
          } catch (e) {
            failures++
            if (e instanceof ApiError && e.status === 401) break
            // A network outage affects the whole batch; retry later instead of timing out per copy.
            if (e instanceof ApiError && e.status === 0) {
              if (!canceled)
                setSummary(
                  'Sin conexión con el servidor. Los pendientes se conservan y se reintentarán.',
                )
              return
            }
          }
        }
        const remaining = (await projectCopies().list(userId!)).filter(
          (c) => c.key !== activeKey && c.pending,
        ).length
        if (!canceled)
          setSummary(
            failures
              ? `${failures} copia(s) requieren atención. Las demás se procesaron.`
              : conflicts
                ? `${conflicts} conflicto(s) pendientes: abre la copia para resolverlos.`
                : remaining
                  ? `${remaining} copia(s) pendientes de sincronizar.`
                  : 'Sincronización automática activa · sin pendientes en copias cerradas',
          )
      } catch (e) {
        if (!canceled) setSummary(errorMessage(e))
      } finally {
        running = false
        if (!canceled) setSyncing(false)
      }
    }
    run.current = synchronize
    void synchronize()
    const interval = setInterval(() => {
      void synchronize()
    }, 5000)
    const online = () => {
      void synchronize()
    }
    window.addEventListener('online', online)
    return () => {
      canceled = true
      clearInterval(interval)
      window.removeEventListener('online', online)
    }
  }, [userId, activeKey])
  return {
    syncing,
    summary,
    synchronize: () => {
      void run.current()
    },
  }
}
