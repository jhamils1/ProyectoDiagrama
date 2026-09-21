import type { ModelKey } from './modelCatalog'
import type { DecodingMode } from '../domain/decoding'
export type { Generation } from '../domain/interpret'
export type EngineInfo = {
  loadMs: number
  adapter: Record<string, string>
  userAgent: string
  device: string
  dtype: string
}

export class TextClient {
  private worker = new Worker(new URL('./text.worker.ts', import.meta.url), { type: 'module' })
  private pending:
    { reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> } | undefined
  private sequence = 0
  private closed = false
  request<T>(
    type: 'load' | 'generate',
    messages?: { role: string; content: string }[],
    modelKey?: ModelKey,
    decoding: DecodingMode = 'legacy',
  ): Promise<T> {
    if (this.closed) return Promise.reject(new Error('El motor fue detenido. Cárgalo nuevamente.'))
    if (this.pending) return Promise.reject(new Error('Hay una operación en curso.'))
    return new Promise((resolve, reject) => {
      const id = ++this.sequence
      const finish = () => {
        clearTimeout(this.pending?.timer)
        this.pending = undefined
      }
      this.pending = {
        reject,
        timer: setTimeout(
          () => this.cancel('Se superaron 120 segundos; el motor se detuvo.'),
          120_000,
        ),
      }
      this.worker.onmessage = (event) => {
        if (event.data.id !== id) return
        finish()
        if (event.data.error) reject(new Error(event.data.error))
        else resolve(event.data.result)
      }
      this.worker.onerror = (event) => {
        event.preventDefault()
        this.cancel(event.message || 'El motor local falló.')
      }
      this.worker.postMessage({ id, type, messages, modelKey, decoding })
    })
  }
  cancel(message = 'Operación cancelada; vuelve a cargar el modelo para continuar.') {
    this.closed = true
    this.worker.terminate()
    clearTimeout(this.pending?.timer)
    this.pending?.reject(new Error(message))
    this.pending = undefined
  }
}
