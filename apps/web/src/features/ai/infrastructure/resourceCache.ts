const PART_SIZE = 32 * 1024 * 1024
const PARTS = 'x-modela-parts'
const SHA = 'x-modela-sha256'

function partUrl(url: string, hash: string, index: number) {
  const key = new URL(url, self.location.origin)
  key.searchParams.set('modela-part', `${hash}-${index}`)
  return key.href
}

/** Chromium can reject a single 1.4 GB cache entry even with adequate quota. */
export async function putVerifiedResource(cache: Cache, url: string, bytes: ArrayBuffer, headers: Headers,
  signal: AbortSignal, progress: (text: string) => void) {
  if (bytes.byteLength <= PART_SIZE) {
    await cache.put(url, new Response(bytes, { headers }))
    return
  }
  const hash = headers.get(SHA)!
  const count = Math.ceil(bytes.byteLength / PART_SIZE)
  for (let index = 0; index < count; index++) {
    signal.throwIfAborted()
    progress(`Guardando Qwen: parte ${index + 1}/${count}…`)
    const part = bytes.slice(index * PART_SIZE, Math.min((index + 1) * PART_SIZE, bytes.byteLength))
    await cache.put(partUrl(url, hash, index), new Response(part, {
      headers: { [SHA]: hash, 'content-length': String(part.byteLength) },
    }))
  }
  signal.throwIfAborted()
  const indexHeaders = new Headers(headers)
  indexHeaders.set(PARTS, String(count))
  indexHeaders.set('x-modela-total-bytes', String(bytes.byteLength))
  indexHeaders.set('content-length', '0')
  // Publish the marker last. A partial download is never reported as ready.
  await cache.put(url, new Response(null, { headers: indexHeaders }))
}

export async function cachedResource(cache: Cache, url: string, includeBody = true): Promise<Response | undefined> {
  const entry = await cache.match(url)
  if (!entry || !entry.headers.has(PARTS)) return entry
  const count = Number(entry.headers.get(PARTS))
  const total = Number(entry.headers.get('x-modela-total-bytes'))
  const hash = entry.headers.get(SHA) ?? ''
  if (!/^[a-f0-9]{64}$/.test(hash) || !Number.isInteger(count) || count < 1 || count > 100
    || !Number.isSafeInteger(total) || total <= 0 || Math.ceil(total / PART_SIZE) !== count) return undefined
  // Validate all parts before letting the engine start.
  for (let index = 0; index < count; index++) {
    const part = await cache.match(partUrl(url, hash, index))
    if (!part || part.headers.get(SHA) !== hash
      || Number(part.headers.get('content-length')) !== Math.min(PART_SIZE, total - index * PART_SIZE)) return undefined
  }
  if (!includeBody) return entry
  let next = 0
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        if (next === count) { controller.close(); return }
        const part = await cache.match(partUrl(url, hash, next++))
        if (!part) throw new Error('La caché de Qwen perdió una parte. Prepara los recursos otra vez.')
        controller.enqueue(new Uint8Array(await part.arrayBuffer()))
      } catch (e) { controller.error(e) }
    },
  })
  const headers = new Headers(entry.headers)
  headers.delete(PARTS)
  headers.set('content-length', String(total))
  return new Response(body, { headers })
}
