import { prepareOfflineApp } from '../../modeling/infrastructure/prepareOfflineApp'
import { modelCatalog, type ModelKey } from './modelCatalog'

export const AI_CACHE = 'modela-ai-v1'
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
  await prepareOfflineApp()
  const response = await fetch(selection.manifestUrl, {
    cache: 'no-store',
    signal,
    headers: { 'x-modela-prepare': '1' },
  })
  if (!response.ok)
    throw new Error('Primero ejecuta npm.cmd run ai:prepare y vuelve a compilar la aplicación.')
  let manifest: ResourceManifest
  try {
    manifest = await response.clone().json()
  } catch {
    throw new Error('Faltan los recursos locales. Ejecuta ai:prepare y build.')
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
    const existing = await cache.match(file.url)
    if (existing?.headers.get('x-modela-sha256') === file.sha256) continue
    const asset = await fetch(file.url, {
      cache: 'no-store',
      signal,
      headers: { 'x-modela-prepare': '1' },
    })
    if (!asset.ok) throw new Error(`Falta el recurso ${file.url}. Ejecuta ai:prepare y build.`)
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
    await cache.put(file.url, new Response(bytes, { headers }))
  }
  signal.throwIfAborted()
  await cache.put(selection.manifestUrl, response)
  // Solicitud no garantiza persistencia; se informa el resultado al usuario.
  const persistent = (await navigator.storage?.persist?.().catch(() => false)) ?? false
  return { manifest, persistent }
}

export async function preparedManifest(
  modelKey: ModelKey = 'qwen3-0.6b',
): Promise<ResourceManifest> {
  const selection = modelCatalog[modelKey]
  const cache = await caches.open(AI_CACHE)
  const response = await cache.match(selection.manifestUrl)
  if (!response) throw new Error('Prepara primero los recursos locales.')
  const manifest: ResourceManifest = await response.json()
  if (
    manifest.revision !== selection.revision ||
    manifest.id !== selection.id ||
    manifest.transformers !== '4.3.0' ||
    manifest.files.length !== selection.fileCount ||
    (manifest.format === 'external-v1') !== selection.externalData
  )
    throw new Error('Vuelve a preparar los recursos de esta versión.')
  for (const file of manifest.files) {
    if ((await cache.match(file.url))?.headers.get('x-modela-sha256') !== file.sha256)
      throw new Error('La caché está incompleta. Prepara los recursos nuevamente.')
  }
  return manifest
}
