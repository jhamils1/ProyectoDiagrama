import { useEffect, useRef, useState } from 'react'
import { api, ApiError, errorMessage } from '../../shared/api'
import { prepareResources, preparedManifest, ResourcesNotPreparedError } from '../ai/infrastructure/resources'
import { TextClient, TextEngineError, type Generation } from '../ai/infrastructure/textClient'
import { prepareLocalModel } from '../ai/infrastructure/localModelResources'

type Claim = { id: string; token: string; expiresAt: string; messages: { role: string; content: string }[] }
type Run = {
  controller: AbortController; client: TextClient | null; timer?: ReturnType<typeof setTimeout>
  claim?: Claim; result?: { token: string; content: string; failed: boolean; failureReason?: string }; failure?: string
}
const MODEL = 'qwen3-1.7b-external'

export function useSharedQwen(project: string, diagram: string, denied: boolean) {
  const path = `/projects/${project}/diagrams/${diagram}/conversation/assistant`
  const run = useRef<Run | null>(null)
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)
  const [needsPreparation, setNeedsPreparation] = useState(false)
  const [failed, setFailed] = useState(false)
  const [status, setStatus] = useState('Cuando preguntes, comprobaremos si un participante puede atender la consulta.')
  function alive(state: Run) { return run.current === state && !state.controller.signal.aborted }
  function signal(state: Run) { return AbortSignal.any([state.controller.signal, AbortSignal.timeout(10000)]) }
  function release(state: Run) {
    if (state.claim) void api(`${path}/${state.claim.id}/release`, {
      method: 'POST', body: JSON.stringify({ token: state.claim.token }),
    }).catch(() => { /* The server lease also expires if the tab closes or the network fails. */ })
  }
  function dispose() {
    const state = run.current
    run.current = null
    if (!state) return
    state.controller.abort()
    clearTimeout(state.timer)
    state.client?.cancel()
    release(state)
  }
  function stop() {
    dispose(); setBusy(false); setReady(false)
    setNeedsPreparation(false); setFailed(true)
    setStatus('Preparación detenida en este navegador. La consulta sigue pendiente y otro participante puede atenderla.')
  }
  function yieldToOther() {
    dispose(); setBusy(false); setReady(false); setNeedsPreparation(false); setFailed(false)
    setStatus('La consulta se está procesando. Puede estar ejecutándose en otra ventana o dispositivo.')
  }
  useEffect(() => {
    if (denied) { dispose(); setBusy(false); setReady(false) }
    return dispose
    // The dialog is keyed by diagram; only its authorization changes during its lifetime.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [path, denied])

  async function poll(state: Run) {
    if (!alive(state)) return
    try {
      if (!state.claim) {
        const claim = await api<Claim | undefined>(`${path}/claim`, { method: 'POST', signal: signal(state) })
        if (!alive(state)) {
          if (claim) release({ ...state, claim })
          return
        }
        state.claim = claim
      }
      if (!state.claim) return
      if (Date.parse(state.claim.expiresAt) <= Date.now()) throw new ApiError(409, 'VENCIDA', 'La ejecución venció. Vuelve a cargar la IA para retomar la consulta.')
      if (!state.result) {
        setStatus('Pensando… Mantén esta ventana abierta mientras se genera la respuesta.')
        try {
          const answer = await state.client!.request<Generation>('chat', state.claim.messages)
          if (!alive(state)) return
          if (answer.raw.length > 4000) throw new Error('Qwen no produjo una respuesta válida.')
          state.result = { token: state.claim.token, content: answer.raw.trim() || 'Actualmente no tengo una respuesta adecuada para esa pregunta. ¿Puedes reformularla o darme más detalles?', failed: false }
          if (answer.tokenLimitReached) state.result.content = state.result.content.slice(0, 3900) + '\n[Respuesta limitada por la longitud máxima de generación.]'
        } catch (e) {
          if (!alive(state)) return
          state.failure = errorMessage(e)
          state.result = { token: state.claim.token, content: '', failed: true,
            failureReason: e instanceof TextEngineError && e.code === 'CONTEXT_TOO_LONG' ? e.code : undefined }
        }
      }
      await api(`${path}/${state.claim.id}/complete`, {
        method: 'POST', body: JSON.stringify(state.result), signal: signal(state),
      })
      if (!alive(state)) return
      state.claim = undefined; state.result = undefined
      if (state.failure) {
        const message = state.failure
        dispose(); setReady(false); setFailed(true); setStatus(message)
        return
      }
      setStatus('Respuesta compartida. IA lista para la próxima pregunta del equipo.')
    } catch (e) {
      if (!alive(state)) return
      if (e instanceof ApiError && [400, 401, 403, 404, 409].includes(e.status)) {
        dispose(); setReady(false); setFailed(true); setStatus(errorMessage(e)); return
      }
      // Keep the same claim and result after an uncertain completion; retry without reinference.
      setStatus('No se pudo confirmar la conexión. Reintentando sin duplicar la respuesta…')
    } finally {
      if (alive(state)) state.timer = setTimeout(() => void poll(state), 3000)
    }
  }

  async function start(prepare: boolean, localFiles?: File[]) {
    if (run.current || denied) return
    const state: Run = { controller: new AbortController(), client: null }
    run.current = state; setBusy(true); setFailed(false); setNeedsPreparation(false)
    const progress = (message: string) => { if (alive(state)) setStatus(message) }
    try {
      if (!prepare) {
        try {
        await preparedManifest(MODEL, AbortSignal.any([state.controller.signal, AbortSignal.timeout(30000)]), progress)
        } catch (e) {
          if (!(e instanceof ResourcesNotPreparedError)) throw e
          if (alive(state)) {
            dispose(); setNeedsPreparation(true)
            setStatus('Este navegador necesita preparar aproximadamente 1,46 GB de recursos de IA. Puedes elegir los archivos de tu PC, descargarlos del servidor si están disponibles o esperar a otro participante.')
          }
          return
        }
      }
      if (localFiles) await prepareLocalModel(localFiles, progress, state.controller.signal)
      else if (prepare) await prepareResources(progress, state.controller.signal, MODEL)
      if (!alive(state)) return
      state.client = new TextClient()
      await state.client.request('load', undefined, MODEL, 'legacy', progress)
      if (!alive(state)) return
      setReady(true)
      setStatus('IA lista en este navegador. Esperando consultas del equipo…')
      void poll(state)
    } catch (e) {
      if (alive(state)) {
        dispose(); setReady(false); setFailed(true)
        setStatus(e instanceof TypeError ? 'No se pudieron descargar los recursos de IA. Comprueba la conexión y vuelve a intentarlo.' : errorMessage(e))
      }
    } finally {
      if (!state.controller.signal.aborted || run.current === null) setBusy(false)
    }
  }
  return { ready, busy, status, needsPreparation, failed, prepare: () => start(true),
    prepareLocal: (files: File[]) => start(true, files), start: () => start(false), stop, yieldToOther }
}
