import { prepareOfflineApp } from '../../modeling/infrastructure/prepareOfflineApp'
import { modelCatalog, type ModelKey } from './modelCatalog'
import { cachedResource, putVerifiedResource } from './resourceCache'

export const AI_CACHE = 'modela-ai-v1'
export class ResourcesNotPreparedError extends Error {}
export type ResourceManifest = {
  format?: string
  id: string
  revision: string
  dtype: string
  transformers: string
  runtime: string
  files: { url: string; bytes: number; sha256: string }[]
}
export async function prepareResources(
  progress: (message: string) => void,
  signal: AbortSignal,
  modelKey: ModelKey = 'qwen3-0.6b',
) {
  const selection = modelCatalog[modelKey]
  // Vite development does not register the production service worker. Its absence
  // must not block model preparation; offline app support is a production concern.
  if (!import.meta.env.DEV) await prepareOfflineApp()
  signal = AbortSignal.any([signal, AbortSignal.timeout(20 * 60_000)])
  const response = await fetch(selection.manifestUrl, {
    cache: 'no-store',
    signal,
    headers: { 'x-modela-prepare': '1' },
  })
  if (!response.ok)
    throw new Error('Los archivos de IA no están disponibles en este servidor. Contacta al administrador de la aplicación.')
  let manifest: ResourceManifest
  try {
    manifest = await response.clone().json()
  } catch {
    throw new Error('No se pudo leer la información de los recursos de IA en este servidor.')
  }
  if (
    manifest.revision !== selection.revision ||
    manifest.id !== selection.id ||
    manifest.transformers !== '4.3.0' ||
    manifest.files.length !== selection.fileCount ||
    (manifest.format === 'external-v1') !== selection.externalData
  )
    throw new Error('El manifiesto no corresponde a esta evaluación.')
  const cache = await caches.open(AI_CACHE)
  for (const [index, file] of manifest.files.entries()) {
    if (
      !file.url.startsWith('/ai/') ||
      file.url.includes('..') ||
      !/^[a-f0-9]{64}$/.test(file.sha256)
    )
      throw new Error('Recurso no permitido.')
    progress(
      `Preparando ${index + 1}/${manifest.files.length}: ${file.url.split('/').at(-1)} (${(file.bytes / 1e6).toFixed(1)} MB)`,
    )
    signal.throwIfAborted()
    const existing = await cachedResource(cache, file.url, false)
    if (existing?.headers.get('x-modela-sha256') === file.sha256) continue
    const asset = await fetch(file.url, {
      cache: 'no-store',
      signal,
      headers: { 'x-modela-prepare': '1' },
    })
    if (!asset.ok) throw new Error(`Falta un archivo de IA en el servidor: ${file.url.split('/').at(-1)}. Contacta al administrador.`)
    const bytes = await asset.arrayBuffer()
    progress(`Verificando SHA-256: ${file.url.split('/').at(-1)}…`)
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
      .map((n) => n.toString(16).padStart(2, '0'))
      .join('')
    if (bytes.byteLength !== file.bytes || hash !== file.sha256)
      throw new Error(`Integridad incorrecta: ${file.url}`)
    signal.throwIfAborted()
    const headers = new Headers(asset.headers)
    headers.delete('content-encoding')
    headers.set('content-length', String(bytes.byteLength))
    headers.set('x-modela-sha256', hash)
    progress(`Guardando recurso verificado: ${file.url.split('/').at(-1)}…`)
    try { await putVerifiedResource(cache, file.url, bytes, headers, signal, progress) }
    catch (e) {
      if (signal.aborted) throw e
      throw new Error('El navegador no pudo guardar los archivos de Qwen. Comprueba el espacio libre y los permisos de almacenamiento del sitio.')
    }
  }
  signal.throwIfAborted()
  await cache.put(selection.manifestUrl, response)
  // Solicitud no garantiza persistencia; se informa el resultado al usuario.
  const persistent = (await navigator.storage?.persist?.().catch(() => false)) ?? false
  return { manifest, persistent }
}

export async function preparedManifest(
  modelKey: ModelKey = 'qwen3-0.6b',
  signal: AbortSignal = AbortSignal.timeout(30000),
  progress: (message: string) => void = () => {},
): Promise<ResourceManifest> {
  return boundedManifest(modelKey, signal, progress)
}

async function boundedManifest(modelKey: ModelKey, signal: AbortSignal, progress: (message: string) => void) {
  signal.throwIfAborted()
  let abort!: () => void
  const cancelled = new Promise<never>((_, reject) => {
    abort = () => reject(new Error('Se detuvo la comprobación de archivos. Vuelve a preparar los recursos IA.'))
    signal.addEventListener('abort', abort, { once: true })
  })
  try { return await Promise.race([readManifest(modelKey, signal, progress), cancelled]) }
  finally { signal.removeEventListener('abort', abort) }
}

async function readManifest(modelKey: ModelKey, signal: AbortSignal, progress: (message: string) => void): Promise<ResourceManifest> {
  const selection = modelCatalog[modelKey]
  progress('Comprobando archivos de Qwen guardados en este navegador…')
  const cache = await caches.open(AI_CACHE)
  const response = await cache.match(selection.manifestUrl)
  if (!response) throw new ResourcesNotPreparedError('Prepara primero los recursos locales.')
  const manifest: ResourceManifest = await response.json()
  if (
    manifest.revision !== selection.revision ||
    manifest.id !== selection.id ||
    manifest.transformers !== '4.3.0' ||
    manifest.files.length !== selection.fileCount ||
    (manifest.format === 'external-v1') !== selection.externalData
  )
    throw new ResourcesNotPreparedError('Vuelve a preparar los recursos de esta versión.')
  for (const file of manifest.files) {
    signal.throwIfAborted()
    progress(`Comprobando ${file.url.split('/').at(-1)}…`)
    if ((await cachedResource(cache, file.url, false))?.headers.get('x-modela-sha256') !== file.sha256)
      throw new ResourcesNotPreparedError('La caché está incompleta. Prepara los recursos nuevamente.')
  }
  return manifest
}
