import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiError, errorMessage } from '../../../shared/api'
import { applyCommand, validateDiagram, type Diagram, type ModelCommand } from '../domain/model'
import type { EditorController } from '../../../App'
import {
  connectDiagramLive,
  type Presence,
  type ConnectionStatus,
} from '../infrastructure/diagramLive'

export type DiagramEnvelope = {
  document: Diagram
  revision: number
  versionActual: number
  permiso: string
}
export type ConflictChoice = { source: 'local' | 'server' | 'custom'; value?: unknown }
export type ProposalResponse = {
  id: string
  status: 'PENDIENTE' | 'APLICADO' | 'DESCARTADO'
  baseRevision: number
  comparedRevision: number
  proposed: Diagram
  conflicts: { path: string; label: string; base: unknown; local: unknown; server: unknown }[]
  current: DiagramEnvelope
}
export function useProjectEditor(projectId: string, diagramId: string) {
  const [envelope, setEnvelope] = useState<DiagramEnvelope | null>(null)
  const current = useRef<DiagramEnvelope | null>(null)
  const [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null),
    [blocked, setBlocked] = useState(false)
  const [generation, setGeneration] = useState(0)
  const [viewGeneration, setViewGeneration] = useState(0)
  const [conflict, setConflict] = useState<ProposalResponse | null>(null)
  const conflictRef = useRef<ProposalResponse | null>(null)
  const [reviewing, setReviewing] = useState(false)
  const attempt = useRef<{
    signature: string
    body: { id: string; baseRevision: number; document: Diagram }
  } | null>(null)
  const busy = useRef(false)
  const stopped = useRef(false)
  const epoch = useRef(0)
  const drafts = useRef(new Set<string>())
  const [syncMessage, setSyncMessage] = useState('Buscando cambios de otras sesiones…')
  const [presence, setPresence] = useState<Presence>([])
  const [connection, setConnection] = useState<ConnectionStatus>('connecting')
  const refreshNow = useRef<() => void>(() => {})
  const setEditing = useCallback((area: string, pending: boolean) => {
    if (pending) drafts.current.add(area)
    else drafts.current.delete(area)
  }, [])
  const path = `/projects/${projectId}/diagrams/${diagramId}`
  const retainProposal = useCallback((proposal: ProposalResponse) => {
    conflictRef.current = proposal
    setConflict(proposal)
    setBlocked(true)
    setReviewing(true)
    setViewGeneration((n) => n + 1)
    setSyncMessage(
      'Otra persona guardó cambios incompatibles. Tu propuesta está guardada para resolverla.',
    )
  }, [])
  useEffect(() => {
    let canceled = false
    const lifecycle = ++epoch.current
    const invalidate = () => {
      if (epoch.current === lifecycle) epoch.current++
    }
    stopped.current = false
    drafts.current.clear()
    let timer: ReturnType<typeof setTimeout>
    let disconnect = () => {}
    let connected = false
    let polling = false
    let requested = false
    let request: AbortController | undefined
    function deny(e: unknown) {
      if (e instanceof ApiError && [401, 403, 404].includes(e.status)) {
        epoch.current++
        stopped.current = true
        current.current = null
        setEnvelope(null)
        setBlocked(true)
        setError(errorMessage(e))
        setPresence([])
        conflictRef.current = null
        setConflict(null)
        setReviewing(false)
        disconnect()
        return true
      }
      return false
    }
    async function readRemote() {
      if (canceled) return
      // Keep checking authorization even while a write response is delayed. Model replacement
      // remains guarded below; a 401/403/404 must invalidate that delayed response immediately.
      if (current.current) {
        const before = current.current
        request = new AbortController()
        const timeout = setTimeout(() => request?.abort(), 10_000)
        try {
          const state = await api<Pick<DiagramEnvelope, 'revision' | 'permiso'>>(`${path}/state`, {
            signal: request.signal,
          })
          if (canceled || busy.current || stopped.current || current.current !== before) return
          // Permission changes must take effect even while a form is open.
          const authorized = { ...before, permiso: state.permiso }
          current.current = authorized
          setEnvelope(authorized)
          if (state.revision > before.revision) {
            if (drafts.current.size || conflictRef.current || attempt.current) {
              setSyncMessage(
                'Hay cambios de otra sesión. Tus campos se conservan; recarga para verlos.',
              )
              return
            }
            const latest = await api<DiagramEnvelope>(path, { signal: request.signal })
            validateDiagram(latest.document)
            if (canceled || busy.current || stopped.current || current.current !== authorized)
              return
            if (drafts.current.size || conflictRef.current || attempt.current) {
              setSyncMessage(
                'Hay cambios de otra sesión. Tus campos se conservan; recarga para verlos.',
              )
              return
            }
            if (latest.revision >= authorized.revision) {
              current.current = latest
              setEnvelope(latest)
            }
          }
          if (!conflictRef.current)
            setSyncMessage(
              connected
                ? 'Conexión en vivo activa'
                : 'Actualización automática activa · cada 3 segundos',
            )
        } catch (e) {
          if (!canceled) {
            if (!deny(e) && !busy.current && !stopped.current)
              setSyncMessage(
                'No se pudieron consultar cambios. Se volverá a intentar automáticamente.',
              )
          }
        } finally {
          clearTimeout(timeout)
        }
      }
    }
    async function poll() {
      if (polling) {
        requested = true
        return
      }
      polling = true
      try {
        do {
          requested = false
          await readRemote()
        } while (requested && !canceled && !stopped.current)
      } finally {
        polling = false
      }
    }
    refreshNow.current = () => {
      void poll()
    }
    async function tick() {
      await poll()
      if (!canceled && current.current) timer = setTimeout(tick, connected ? 15000 : 3000)
    }
    api<DiagramEnvelope>(path)
      .then(async (data) => {
        validateDiagram(data.document)
        const pending = await api<string[]>(`${path}/changes`)
        const proposal = pending.length
          ? await api<ProposalResponse>(`${path}/changes/${pending[0]}`)
          : null
        if (!canceled) {
          current.current = data
          setEnvelope(data)
          setBlocked(false)
          setError(null)
          conflictRef.current = null
          setConflict(null)
          setSyncMessage('Actualización automática activa · cada 3 segundos')
          if (proposal?.status === 'PENDIENTE') retainProposal(proposal)
          disconnect = connectDiagramLive(path, {
            status: (status) => {
              if (canceled) return
              connected = status === 'connected'
              setConnection(status)
              if (!connected) {
                setPresence([])
                clearTimeout(timer)
                timer = setTimeout(tick, 3000)
              }
            },
            state: (state) => {
              if (canceled) return
              setPresence(state.users)
              // Refresh after every validated signal, including reconnect and permission changes.
              // readRemote retains draft/busy/epoch guards and checks HTTP authorization again.
              void poll()
            },
            denied: () => {
              if (!canceled)
                deny(
                  new ApiError(
                    403,
                    'SIN_ACCESO',
                    'La sesión o el acceso al diagrama ya no están disponibles.',
                  ),
                )
            },
          })
          clearTimeout(timer)
          timer = setTimeout(tick, 3000)
        }
      })
      .catch((e) => {
        if (!canceled) {
          current.current = null
          setEnvelope(null)
          conflictRef.current = null
          setConflict(null)
          setReviewing(false)
          setError(errorMessage(e))
          setBlocked(true)
        }
      })
      .finally(() => {
        if (!canceled) setLoading(false)
      })
    return () => {
      canceled = true
      clearTimeout(timer)
      request?.abort()
      disconnect()
      refreshNow.current = () => {}
      invalidate()
    }
  }, [path, generation, retainProposal])
  async function execute(command: ModelCommand) {
    const previous = current.current
    if (!previous || busy.current || blocked || previous.permiso === 'CONSULTA') return false
    busy.current = true
    const lifecycle = epoch.current
    setSaving(true)
    setError(null)
    try {
      const signature = JSON.stringify(command)
      if (attempt.current?.signature !== signature)
        attempt.current = {
          signature,
          body: {
            id: crypto.randomUUID(),
            baseRevision: previous.revision,
            document: applyCommand(previous.document, command),
          },
        }
      const result = await api<ProposalResponse>(`${path}/changes`, {
        method: 'POST',
        body: JSON.stringify(attempt.current.body),
      })
      const saved = result.current
      validateDiagram(saved.document)
      if (epoch.current !== lifecycle) return false
      attempt.current = null
      if (result.status === 'PENDIENTE') {
        retainProposal(result)
        setError('Otra persona guardó cambios incompatibles. Revisa tu propuesta pendiente.')
        return false
      }
      current.current = saved
      setEnvelope(saved)
      return true
    } catch (e) {
      if (epoch.current !== lifecycle) return false
      setError(errorMessage(e))
      if (e instanceof ApiError && [401, 404].includes(e.status)) {
        current.current = null
        setEnvelope(null)
      }
      if (e instanceof ApiError && e.status >= 400 && e.status < 500) attempt.current = null
      if (e instanceof ApiError && [401, 403, 404, 409].includes(e.status)) {
        setBlocked(true)
        stopped.current = true
        setSyncMessage('Actualización pausada. Recarga para recuperar la versión autorizada.')
      }
      return false
    } finally {
      busy.current = false
      setSaving(false)
      refreshNow.current()
    }
  }
  async function resolveProposal(choices: Record<string, ConflictChoice>, discard = false) {
    const proposal = conflictRef.current
    if (!proposal || busy.current) return
    busy.current = true
    setSaving(true)
    setError(null)
    const lifecycle = epoch.current
    try {
      const result = await api<ProposalResponse>(
        `${path}/changes/${proposal.id}/${discard ? 'discard' : 'resolve'}`,
        {
          method: 'POST',
          body: discard
            ? undefined
            : JSON.stringify({ comparedRevision: proposal.comparedRevision, choices }),
        },
      )
      if (epoch.current !== lifecycle) return
      if (result.status === 'PENDIENTE') {
        retainProposal(result)
        setError('El servidor cambió mientras decidías. Revisa nuevamente la comparación.')
        return
      }
      validateDiagram(result.current.document)
      current.current = result.current
      setEnvelope(result.current)
      conflictRef.current = null
      setConflict(null)
      setReviewing(false)
      setBlocked(false)
      setGeneration((n) => n + 1)
    } catch (e) {
      if (epoch.current !== lifecycle) return
      setError(errorMessage(e))
      if (e instanceof ApiError && [401, 403, 404].includes(e.status)) {
        setBlocked(true)
        if (e.status !== 403) {
          current.current = null
          setEnvelope(null)
          conflictRef.current = null
          setConflict(null)
          setReviewing(false)
        }
      }
    } finally {
      busy.current = false
      setSaving(false)
    }
  }
  const editor: EditorController = {
    active: envelope?.document ?? null,
    diagrams: envelope ? [envelope.document] : [],
    loading,
    saving,
    error,
    loadFailed: !envelope,
    execute,
    newDiagram: async () => false,
    selectDiagram: () => {},
    dismissError: () => setError(null),
  }
  return {
    editor,
    envelope,
    hasDrafts: () => drafts.current.size > 0,
    revision: envelope?.revision ?? 0,
    setEditing,
    syncMessage,
    presence,
    connection,
    conflict,
    reviewing,
    setReviewing,
    resolveProposal,
    viewGeneration,
    readOnly: blocked || !envelope || envelope.permiso === 'CONSULTA',
    reload: () => {
      if (
        busy.current ||
        !window.confirm(
          'Se abrirá la versión del servidor. Los campos sin guardar se descartarán. ¿Continuar?',
        )
      )
        return
      setLoading(true)
      attempt.current = null
      setGeneration((n) => n + 1)
    },
    generation,
  }
}
