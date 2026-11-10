import type { ImageModel } from '../domain/imageDiagram'
import { prepareVisionResources } from './visionResources'

export async function analyzeLocalImage(
  file: File,
  progress: (text: string) => void,
  signal: AbortSignal,
): Promise<{ model: ImageModel; warnings: string[]; elapsedMs: number }> {
  await prepareVisionResources(progress, signal)
  signal.throwIfAborted()
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./vision.worker.ts', import.meta.url), { type: 'module' })
    const finish = () => {
      clearTimeout(timer)
      signal.removeEventListener('abort', abort)
      worker.terminate()
    }
    const abort = () => {
      finish()
      reject(new Error('Análisis cancelado.'))
    }
    const timer = setTimeout(() => {
      finish()
      reject(new Error('El análisis superó dos minutos. Prueba una foto más pequeña y frontal.'))
    }, 120_000)
    signal.addEventListener('abort', abort, { once: true })
    worker.onerror = (event) => {
      event.preventDefault()
      finish()
      reject(new Error(event.message || 'No se pudo iniciar la IA visual local.'))
    }
    worker.onmessage = (event) => {
      if (event.data.progress) {
        progress(event.data.progress)
        return
      }
      finish()
      if (event.data.error) reject(new Error(event.data.error))
      else resolve(event.data.result)
    }
    worker.postMessage({ file })
  })
}
