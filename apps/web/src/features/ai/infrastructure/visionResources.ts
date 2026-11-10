import lock from '../../../../../../scripts/ai/vision-lock.json'
import { cachedResource, putVerifiedResource } from './resourceCache'
import { prepareOfflineApp } from '../../modeling/infrastructure/prepareOfflineApp'

export const VISION_MANIFEST = '/ai/manifest-vision.json'
export async function prepareVisionResources(
  progress: (text: string) => void,
  signal: AbortSignal,
) {
  if (!import.meta.env.DEV) await prepareOfflineApp()
  signal.throwIfAborted()
  const cache = await caches.open('modela-ai-v1')
  const previous = await cache.match(VISION_MANIFEST)
  const response =
    previous ?? (await fetch(VISION_MANIFEST, { headers: { 'x-modela-prepare': '1' }, signal }))
  if (!response.ok)
    throw new Error(
      'Prepara el modelo visual en esta PC con npm run ai:prepare-vision y vuelve a iniciar la web.',
    )
  const manifest = (await response.clone().json()) as {
    id: string
    revision: string
    files: { url: string; bytes: number; sha256: string }[]
  }
  if (
    manifest.id !== lock.id ||
    manifest.revision !== lock.revision ||
    !Array.isArray(manifest.files) ||
    manifest.files.length !== lock.files.length + 2
  )
    throw new Error(
      'Los recursos visuales no corresponden a esta versión. Ejecuta npm run ai:prepare-vision.',
    )
  for (const item of lock.files) {
    if (
      !manifest.files.some(
        (f) =>
          f.url === `/ai/models/florence2-base/${item.name}` &&
          f.bytes === item.bytes &&
          f.sha256 === item.sha256,
      )
    )
      throw new Error('La lista de archivos del modelo visual es incorrecta.')
  }
  for (const [i, file] of manifest.files.entries()) {
    if (
      (!file.url.startsWith('/ai/models/florence2-base/') &&
        !/^\/ai\/runtime\/ort-wasm-simd-threaded\.asyncify\.(mjs|wasm)$/.test(file.url)) ||
      file.url.includes('..') ||
      !/^[a-f0-9]{64}$/.test(file.sha256) ||
      file.bytes <= 0 ||
      file.bytes > 120_000_000
    )
      throw new Error('Archivo visual no permitido.')
    signal.throwIfAborted()
    progress(
      `Preparando IA visual ${i + 1}/${manifest.files.length}: ${file.url.split('/').at(-1)}`,
    )
    if (
      (await cachedResource(cache, file.url, false))?.headers.get('x-modela-sha256') === file.sha256
    )
      continue
    const asset = await fetch(file.url, { signal, headers: { 'x-modela-prepare': '1' } })
    if (!asset.ok)
      throw new Error('Faltan archivos de Florence-2. Ejecuta npm run ai:prepare-vision.')
    const bytes = await asset.arrayBuffer()
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
      .map((n) => n.toString(16).padStart(2, '0'))
      .join('')
    if (bytes.byteLength !== file.bytes || hash !== file.sha256)
      throw new Error('Un archivo de Florence-2 está incompleto o cambió. Vuelve a prepararlo.')
    await putVerifiedResource(
      cache,
      file.url,
      bytes,
      new Headers({ 'content-length': String(bytes.byteLength), 'x-modela-sha256': hash }),
      signal,
      progress,
    )
  }
  signal.throwIfAborted()
  await cache.put(VISION_MANIFEST, response)
}
