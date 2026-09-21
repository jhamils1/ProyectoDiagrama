import { useCallback, useEffect, useRef, useState } from 'react'
import { EditorView, type EditorController } from '../../../App'
import { api, ApiError, errorMessage } from '../../../shared/api'
import { projectCopies, copyKey, type ProjectCopy } from '../infrastructure/projectCopies'
import { synchronizeCopy, unavailable } from '../application/syncProjectCopy'
import type { ConflictChoice, ProposalResponse } from '../application/useProjectEditor'
import { ConflictDialog } from './ConflictDialog'

export function OfflineProjectEditor({
  userId,
  projectId,
  diagramId,
}: {
  userId: string
  projectId: string
  diagramId: string
}) {
  const [copy, setCopy] = useState<ProjectCopy | null>(null)
  const current = useRef<ProjectCopy | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('Abriendo copia local…')
  const [reviewing, setReviewing] = useState(true)
  const [online, setOnline] = useState(false)
  const [viewGeneration, setViewGeneration] = useState(0)
  const drafts = useRef(new Set<string>())
  const syncFlight = useRef<Promise<void> | null>(null)
  const saveRequested = useRef(false)
  const busy = useRef(false),
    alive = useRef(false),
    epoch = useRef(0)
  const setEditing = useCallback((area: string, pending: boolean) => {
    if (pending) drafts.current.add(area)
    else drafts.current.delete(area)
  }, [])
  const apply = useCallback((value: ProjectCopy) => {
    current.current = value
    setCopy(value)
  }, [])
  const sync = useRef<() => Promise<void>>(async () => {})
  useEffect(() => {
    let canceled = false
    alive.current = true
    const invalidate = () => {
      epoch.current++
    }
    const store = projectCopies()
    const key = copyKey(userId, projectId, diagramId)
    const hide = (e: unknown) => {
      epoch.current++
      current.current = null
      setCopy(null)
      setError(errorMessage(e))
    }
    async function run() {
      if (canceled || busy.current || saveRequested.current || drafts.current.size) return
      busy.current = true
      const lifecycle = epoch.current
      try {
        const value = await synchronizeCopy(userId, projectId, diagramId)
        if (canceled || lifecycle !== epoch.current) return
        setOnline(true)
        setError(null)
        if (!drafts.current.size) apply(value)
        setMessage(
          value.conflict
            ? 'Propuesta guardada: resuelve el conflicto con conexión.'
            : drafts.current.size
              ? 'Edición en curso · tus campos se conservan'
              : value.pending
                ? 'Guardado en este equipo · pendiente de sincronizar'
                : 'Sincronizado · copia disponible sin conexión',
        )
      } catch (e) {
        if (canceled || lifecycle !== epoch.current) return
        setOnline(false)
        if (unavailable(e)) {
          try {
            const local = await store.get(userId, projectId, diagramId)
            if (canceled || lifecycle !== epoch.current) return
            if (!drafts.current.size) apply(local)
            setMessage(
              local.pending?.attempted
                ? 'Envío sin confirmar. Conservamos la propuesta y reintentaremos al conectar.'
                : local.pending
                  ? 'Sin conexión · cambios guardados en este equipo, pendientes de sincronizar'
                  : 'Sin conexión · copia disponible en este equipo',
            )
          } catch (localError) {
            if (!canceled) hide(localError)
          }
        } else {
          if (e instanceof ApiError && e.status === 401) await store.lock()
          if (e instanceof ApiError && [403, 404].includes(e.status))
            await store.deny(key).catch(() => {})
          if (!canceled) hide(e)
        }
      } finally {
        busy.current = false
        if (!canceled) setLoading(false)
      }
    }
    const schedule = () => {
      if (syncFlight.current) return syncFlight.current
      const task = run().finally(() => {
        if (syncFlight.current === task) syncFlight.current = null
      })
      syncFlight.current = task
      return task
    }
    sync.current = schedule
    void schedule()
    const timer = setInterval(() => {
      void schedule()
    }, 5000)
    // This audit is independent of delayed network requests and detects logout in other tabs.
    const audit = setInterval(() => {
      if (current.current)
        void store.get(userId, projectId, diagramId).catch((e) => {
          if (!canceled) hide(e)
        })
    }, 1000)
    const reconnect = () => {
      void schedule()
    }
    window.addEventListener('online', reconnect)
    return () => {
      canceled = true
      alive.current = false
      invalidate()
      clearInterval(timer)
      clearInterval(audit)
      window.removeEventListener('online', reconnect)
    }
  }, [userId, projectId, diagramId, apply])
  async function resolve(choices: Record<string, ConflictChoice>, discard = false) {
    const proposal = current.current?.conflict
    if (!proposal || busy.current) return
    busy.current = true
    setSaving(true)
    const lifecycle = epoch.current
    try {
      const result = await api<ProposalResponse>(
        `/projects/${projectId}/diagrams/${diagramId}/changes/${proposal.id}/${discard ? 'discard' : 'resolve'}`,
        {
          method: 'POST',
          body: discard
            ? undefined
            : JSON.stringify({ comparedRevision: proposal.comparedRevision, choices }),
        },
      )
      const updated = await projectCopies().acknowledge(
        copyKey(userId, projectId, diagramId),
        result,
      )
      if (alive.current && lifecycle === epoch.current) {
        apply(updated)
        setError(
          result.status === 'PENDIENTE'
            ? 'El servidor cambió. Revisa nuevamente las elecciones.'
            : null,
        )
        setMessage(
          result.status === 'PENDIENTE'
            ? 'Conflicto pendiente de resolución'
            : 'Sincronizado · copia disponible sin conexión',
        )
      }
    } catch (e) {
      if (alive.current && lifecycle === epoch.current) setError(errorMessage(e))
    } finally {
      busy.current = false
      setSaving(false)
    }
  }
  const editor: EditorController = {
    active: copy?.document ?? null,
    diagrams: copy ? [copy.document] : [],
    loading,
    saving,
    error,
    loadFailed: !copy,
    dismissError: () => setError(null),
    selectDiagram: () => {},
    newDiagram: async () => false,
    execute: async (command) => {
      if (!current.current || saveRequested.current) return false
      const editingCopy = current.current
      saveRequested.current = true
      setSaving(true)
      const lifecycle = epoch.current
      let ownsBusy = false
      try {
        if (syncFlight.current) await syncFlight.current
        if (!alive.current || lifecycle !== epoch.current || busy.current) return false
        busy.current = true
        ownsBusy = true
        const updated = await projectCopies().edit(editingCopy, command)
        if (!alive.current || lifecycle !== epoch.current) return false
        apply(updated)
        setError(null)
        setMessage('Guardado en este equipo · pendiente de sincronizar')
        return true
      } catch (e) {
        if (alive.current) setError(errorMessage(e))
        return false
      } finally {
        if (ownsBusy) busy.current = false
        saveRequested.current = false
        setSaving(false)
      }
    },
  }
  return (
    <>
      <EditorView
        key={viewGeneration}
        editor={editor}
        remote={{
          projectName: copy?.project.nombre ?? 'Copia de proyecto',
          backHref: '/workspace?copies=1',
          readOnly:
            !copy ||
            copy.base.permiso === 'CONSULTA' ||
            !!copy.conflict ||
            !!copy.pending?.attempted,
          reload: () => {
            if (
              drafts.current.size &&
              !window.confirm(
                'Se descartarán los campos sin guardar. Los cambios ya guardados en este equipo se conservan. ¿Actualizar?',
              )
            )
              return
            drafts.current.clear()
            setViewGeneration((n) => n + 1)
            void sync.current()
          },
          setEditing,
          syncMessage: message,
          presence: [],
          connection: 'reconnecting',
          localCopy: true,
          generationSource: {
            projectId, diagramId, revision: copy?.base.revision ?? 0,
            ready: online && !!copy && !copy.pending && !copy.conflict,
          },
          conflictPending: !!copy?.conflict,
          review: () => setReviewing(true),
        }}
      />
      {copy?.conflict && reviewing && (
        <ConflictDialog
          key={`${copy.conflict.id}:${copy.conflict.comparedRevision}`}
          proposal={copy.conflict}
          busy={saving || !online || copy.base.permiso === 'CONSULTA'}
          error={error}
          close={() => setReviewing(false)}
          resolve={resolve}
        />
      )}
    </>
  )
}
