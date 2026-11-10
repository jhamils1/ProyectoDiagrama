import { useEffect, useRef, useState } from 'react'
import { api, ApiError, errorMessage } from '../../shared/api'

export type ConversationMessage = {
  id: string; sequence: number; authorId: string | null; authorName: string
  content: string; createdAt: string; diagramRevision: number; kind?: string; executorName?: string | null
  answerScope?: 'DIAGRAMA' | 'ACTIVIDAD' | 'CONCEPTO' | 'DESCONOCIDO' | null
  continuationQuestion?: string | null
  proposalInstruction?: string | null
  proposalData?: string | null
}
type AssistantStatus = { id: string; status: 'PENDIENTE' | 'PROCESANDO' | 'COMPLETADA' | 'FALLIDA'; error: string | null; mode?: 'LOCAL' | 'INTERNET'; executorName?: string | null; executionExpired?: boolean }
type ConversationPage = { items: ConversationMessage[]; nextBefore: number | null; nextAfter: number | null; assistant?: AssistantStatus | null }
type Session = {
  controller: AbortController; denied: boolean; ready: boolean; after: number
  sending: boolean; readingOlder: boolean
}
const merge = (previous: ConversationMessage[], incoming: ConversationMessage[]) =>
  [...new Map([...previous, ...incoming].map(message => [message.id, message])).values()]
    .sort((a, b) => a.sequence - b.sequence)

export function useConversation(projectId: string, diagramId: string) {
  const path = `/projects/${projectId}/diagrams/${diagramId}/conversation`
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [before, setBefore] = useState<number | null>(null)
  const [ready, setReady] = useState(false)
  const [denied, setDenied] = useState(false)
  const [sending, setSending] = useState(false)
  const [canceling, setCanceling] = useState(false)
  const [readingOlder, setReadingOlder] = useState(false)
  const [error, setError] = useState('')
  const [syncError, setSyncError] = useState('')
  const [assistant, setAssistant] = useState<AssistantStatus | null>(null)
  const session = useRef<Session | null>(null)
  const attempt = useRef<{ id: string; content: string; ask: boolean; mode: 'LOCAL' | 'INTERNET' } | null>(null)
  const onlineRequest = useRef<{ id: string; controller: AbortController } | null>(null)

  function alive(state: Session) { return !state.controller.signal.aborted && !state.denied }
  function signal(state: Session) {
    return AbortSignal.any([state.controller.signal, AbortSignal.timeout(10000)])
  }
  function deny(state: Session, e: unknown) {
    if (e instanceof ApiError && [401, 403, 404].includes(e.status)) {
      state.denied = true
      state.controller.abort()
      attempt.current = null
      setMessages([])
      setBefore(null)
      setAssistant(null)
      setDenied(true)
      setError(errorMessage(e))
      setSyncError('')
      return true
    }
    return false
  }

  useEffect(() => {
    const state: Session = {
      controller: new AbortController(), denied: false, ready: false, after: 0,
      sending: false, readingOlder: false,
    }
    session.current = state
    let timer: ReturnType<typeof setTimeout>
    async function poll() {
      let more = false
      try {
        const data = await api<ConversationPage>(state.ready ? `${path}?after=${state.after}` : path,
          { signal: signal(state) })
        if (!alive(state)) return
        setMessages(previous => merge(previous, data.items))
        setAssistant(data.assistant ?? null)
        if (data.assistant?.status === 'FALLIDA' && onlineRequest.current?.id === data.assistant.id)
          onlineRequest.current.controller.abort()
        // Only ordered GET pages advance the cursor. A POST can return a later
        // message before concurrent participants' messages have been read.
        if (data.items.length) state.after = data.items[data.items.length - 1].sequence
        if (!state.ready) { setBefore(data.nextBefore); setReady(true); state.ready = true }
        setSyncError('')
        more = data.nextAfter !== null
      } catch (e) {
        if (alive(state) && !deny(state, e)) setSyncError(errorMessage(e))
      } finally {
        if (alive(state)) timer = setTimeout(() => void poll(), more ? 0 : 3000)
      }
    }
    void poll()
    return () => { state.controller.abort(); clearTimeout(timer) }
  }, [path])

  async function loadOlder() {
    const state = session.current
    if (!state || !alive(state) || state.readingOlder || before === null) return
    state.readingOlder = true
    setReadingOlder(true)
    setError('')
    try {
      const data = await api<ConversationPage>(`${path}?before=${before}`, { signal: signal(state) })
      if (alive(state)) {
        setMessages(previous => merge(previous, data.items))
        setBefore(data.nextBefore)
      }
    } catch (e) { if (alive(state) && !deny(state, e)) setError(errorMessage(e)) }
    finally { state.readingOlder = false; if (!state.controller.signal.aborted) setReadingOlder(false) }
  }

  async function send(content: string, ask = false, mode: 'LOCAL' | 'INTERNET' = 'LOCAL') {
    const state = session.current
    const text = content.trim()
    if (!state || !alive(state) || !state.ready || state.sending || !text || text.length > 4000) return false
    state.sending = true
    setSending(true)
    setError('')
    if (attempt.current?.content !== text || attempt.current.ask !== ask || attempt.current.mode !== mode)
      attempt.current = { id: crypto.randomUUID(), content: text, ask, mode }
    try {
      const result = await api<ConversationMessage | AssistantStatus>(ask ? `${path}/assistant` : path, {
        method: 'POST', body: JSON.stringify({ id: attempt.current.id, content: text, ...(ask ? { mode } : {}) }), signal: signal(state),
      })
      if (!alive(state)) return false
      if ('sequence' in result) setMessages(previous => merge(previous, [result]))
      else {
        setAssistant(result)
        if (mode === 'INTERNET' && result.status === 'PENDIENTE') {
          const online = new AbortController()
          onlineRequest.current = { id: result.id, controller: online }
          try {
            const response = await api<AssistantStatus | undefined>(`${path}/assistant/${result.id}/internet`, {
              method: 'POST', signal: AbortSignal.any([state.controller.signal, online.signal, AbortSignal.timeout(75000)]),
            })
            if (alive(state) && response) setAssistant(response)
          } catch (e) {
            if (!online.signal.aborted && alive(state) && !deny(state, e)) setError('No se pudo confirmar la consulta por internet. Revisa el historial antes de volver a preguntar.')
          } finally { if (onlineRequest.current?.controller === online) onlineRequest.current = null }
        }
      }
      attempt.current = null
      return true
    } catch (e) {
      if (alive(state) && !deny(state, e)) {
        setError(errorMessage(e))
        if (e instanceof ApiError && e.status >= 400 && e.status < 500) attempt.current = null
      }
      return false
    } finally { state.sending = false; if (!state.controller.signal.aborted) setSending(false) }
  }

  async function continueInternet() {
    const state = session.current
    if (!state || !alive(state) || state.sending || !assistant || assistant.mode !== 'INTERNET' || assistant.status !== 'PENDIENTE') return
    state.sending = true; setSending(true); setError('')
    const online = new AbortController()
    onlineRequest.current = { id: assistant.id, controller: online }
    try {
      const result = await api<AssistantStatus | undefined>(`${path}/assistant/${assistant.id}/internet`, {
        method: 'POST', signal: AbortSignal.any([state.controller.signal, online.signal, AbortSignal.timeout(75000)]),
      })
      if (alive(state) && result) setAssistant(result)
    } catch (e) { if (!online.signal.aborted && alive(state) && !deny(state, e)) setError(errorMessage(e)) }
    finally { if (onlineRequest.current?.controller === online) onlineRequest.current = null; state.sending = false; if (!state.controller.signal.aborted) setSending(false) }
  }

  async function cancelAssistant() {
    const state = session.current
    if (!state || !alive(state) || canceling || !assistant || !['PENDIENTE', 'PROCESANDO'].includes(assistant.status)) return false
    const id = assistant.id
    setCanceling(true); setError('')
    try {
      const result = await api<AssistantStatus>(`${path}/assistant/${id}/cancel`, { method: 'POST', signal: signal(state) })
      if (alive(state) && result) setAssistant(result)
      if (result.status === 'FALLIDA' && onlineRequest.current?.id === id) onlineRequest.current.controller.abort()
      return result.status === 'FALLIDA'
    } catch (e) {
      if (alive(state)) {
        if (e instanceof ApiError && e.status === 403) setError('Solo quien hizo la pregunta o un administrador puede cancelar esta consulta.')
        else if (!deny(state, e)) setError(errorMessage(e))
      }
      return false
    }
    finally { if (!state.controller.signal.aborted) setCanceling(false) }
  }

  return { messages, before, ready, denied, sending, canceling, readingOlder, error, syncError, assistant, send, loadOlder, continueInternet, cancelAssistant }
}
