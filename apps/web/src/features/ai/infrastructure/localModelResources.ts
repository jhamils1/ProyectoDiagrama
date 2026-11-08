import pinnedManifest from '../../../../../../scripts/ai/model-external-lock.json'
import { prepareOfflineApp } from '../../modeling/infrastructure/prepareOfflineApp'
import { AI_CACHE, type ResourceManifest } from './resources'
import { cachedResource, putVerifiedResource } from './resourceCache'

const MANIFEST_URL = '/ai/manifest-qwen3-1.7b-external.json'

/** Only files explicitly selected by this person are read; no file is sent to the server. */
export async function prepareLocalModel(files: File[], progress: (message: string) => void, signal: AbortSignal) {
  if (!import.meta.env.DEV) await prepareOfflineApp()
  const cache = await caches.open(AI_CACHE)
  await cacheSelectedModel(files, pinnedManifest, cache, progress, AbortSignal.any([signal, AbortSignal.timeout(20 * 60_000)]))
  return { manifest: pinnedManifest }
}

/** Manifest is supplied by application code, never by a selected file. */
export async function cacheSelectedModel(files: File[], manifest: ResourceManifest, cache: Cache,
  progress: (message: string) => void, signal: AbortSignal) {
  const selected = manifest.files.map(expected => {
    const relative = expected.url.replace(/^\/ai\//, '')
    const matches = files.filter(file => {
      const path = (file.webkitRelativePath || '').replace(/\\/g, '/')
      return path === relative || path.endsWith('/' + relative)
    })
    // Some browsers do not expose folder-relative paths. Names and sizes only
    // identify candidates; the pinned SHA-256 decides which file is accepted.
    const candidates = matches.length ? matches : files.filter(file => file.name === relative.split('/').at(-1) && file.size === expected.bytes)
    const sized = candidates.filter(file => file.size === expected.bytes)
    if (!sized.length)
      throw new Error(`No se encontró el archivo correcto ${relative}. Selecciona la carpeta public/ai completa.`)
    return sized
  })
  for (const [index, expected] of manifest.files.entries()) {
    signal.throwIfAborted()
    const existing = await cachedResource(cache, expected.url, false)
    if (existing?.headers.get('x-modela-sha256') === expected.sha256) continue
    let verified: { file: File; bytes: ArrayBuffer; hash: string } | undefined
    for (const file of selected[index]) {
      progress(`Leyendo archivo local ${index + 1}/${selected.length}: ${file.name}…`)
      const bytes = await file.arrayBuffer()
      signal.throwIfAborted()
      progress(`Verificando archivo local: ${file.name}…`)
      const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
        .map(value => value.toString(16).padStart(2, '0')).join('')
      if (hash === expected.sha256) { verified = { file, bytes, hash }; break }
    }
    if (!verified) throw new Error(`El archivo ${expected.url.split('/').at(-1)} no coincide con la versión de Qwen requerida.`)
    const { file, bytes, hash } = verified
    signal.throwIfAborted()
    const contentType = file.name.endsWith('.wasm') ? 'application/wasm'
      : file.name.endsWith('.mjs') ? 'application/javascript' : file.name.endsWith('.json') ? 'application/json' : 'application/octet-stream'
    const headers = new Headers({ 'content-type': contentType, 'content-length': String(bytes.byteLength), 'x-modela-sha256': hash })
    try { await putVerifiedResource(cache, expected.url, bytes, headers, signal, progress) }
    catch (error) {
      if (signal.aborted) throw error
      throw new Error('El navegador no pudo guardar los archivos de Qwen. Comprueba el espacio disponible.')
    }
  }
  signal.throwIfAborted()
  // Publish the manifest only after every required file has been verified and stored.
  await cache.put(MANIFEST_URL, new Response(JSON.stringify(manifest), { headers: { 'content-type': 'application/json' } }))
}
