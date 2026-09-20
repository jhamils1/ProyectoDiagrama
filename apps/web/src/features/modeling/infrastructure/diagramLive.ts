import { z } from 'zod'

const stateSchema = z.object({
  type: z.literal('state'),
  revision: z.number().int().nonnegative(),
  permiso: z.enum(['ADMINISTRACION', 'EDICION', 'CONSULTA']),
  users: z
    .array(
      z.object({
        id: z.uuid(),
        name: z.string().max(200),
        sessions: z.number().int().min(1).max(20),
      }),
    )
    .max(500),
})
export type LiveState = z.infer<typeof stateSchema>
export type Presence = LiveState['users']
export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting'

// One channel per mounted editor. Only notifications are received; all writes use the HTTP API.
export function connectDiagramLive(
  path: string,
  callbacks: {
    state: (state: LiveState) => void
    status: (status: ConnectionStatus) => void
    denied: () => void
  },
) {
  let disposed = false
  let socket: WebSocket | undefined
  let retry: ReturnType<typeof setTimeout>
  let watchdog: ReturnType<typeof setInterval>
  let delay = 1000
  let lastMessage = 0
  function connect() {
    if (disposed) return
    callbacks.status(delay === 1000 ? 'connecting' : 'reconnecting')
    const url = new URL(`/api${path}/live`, window.location.href)
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    const active = new WebSocket(url)
    socket = active
    lastMessage = Date.now()
    watchdog = setInterval(() => {
      if (Date.now() - lastMessage > 25000) active.close()
    }, 5000)
    active.onmessage = (event) => {
      if (disposed || socket !== active) return
      try {
        const state = stateSchema.parse(JSON.parse(event.data))
        lastMessage = Date.now()
        delay = 1000
        active.send('pong')
        callbacks.status('connected')
        callbacks.state(state)
      } catch {
        active.close(1008, 'Invalid event')
      }
    }
    active.onclose = (event) => {
      clearInterval(watchdog)
      if (disposed || socket !== active) return
      callbacks.status('reconnecting')
      if (event.code === 4403) {
        disposed = true
        callbacks.denied()
        return
      }
      retry = setTimeout(connect, delay)
      delay = Math.min(delay * 2, 30000)
    }
    active.onerror = () => active.close()
  }
  connect()
  return () => {
    disposed = true
    clearTimeout(retry)
    clearInterval(watchdog)
    socket?.close(1000, 'Editor closed')
  }
}
