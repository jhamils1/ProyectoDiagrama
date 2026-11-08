import { afterEach, expect, test, vi } from 'vitest'
import { Buffer } from 'node:buffer'
import { cachedResource, putVerifiedResource } from './resourceCache'

function memoryCache() {
  const entries = new Map<string, Response>()
  const cache = {
    async put(key: string, value: Response) { entries.set(key, value.clone()) },
    async match(key: string) { return entries.get(key)?.clone() },
  } as unknown as Cache
  vi.stubGlobal('self', { location: { origin: 'https://test.local' } })
  return { cache, entries }
}
afterEach(() => vi.unstubAllGlobals())

test('reconstructs a large verified resource byte for byte and detects missing parts', async () => {
  const {cache, entries} = memoryCache()
  const data = new Uint8Array(32 * 1024 * 1024 + 7)
  data[0] = 17; data[data.length - 1] = 233
  const hash = 'a'.repeat(64)
  const headers = new Headers({ 'x-modela-sha256': hash, 'content-length': String(data.length) })
  await putVerifiedResource(cache, '/ai/weights', data.buffer, headers, new AbortController().signal, () => {})
  const restored = await cachedResource(cache, '/ai/weights')
  expect(restored?.headers.get('content-length')).toBe(String(data.length))
  expect(Buffer.from(await restored!.arrayBuffer()).equals(Buffer.from(data))).toBe(true)
  entries.delete([...entries.keys()].find(key => key.includes('modela-part'))!)
  expect(await cachedResource(cache, '/ai/weights')).toBeUndefined()
})

test('existing small or monolithic entries remain readable', async () => {
  const { cache } = memoryCache()
  await cache.put('/ai/file', new Response('model', {headers: {'x-modela-sha256':'b'.repeat(64)}}))
  expect(await (await cachedResource(cache, '/ai/file'))?.text()).toBe('model')
})

test('an interrupted preparation never publishes a complete marker', async () => {
  const { cache } = memoryCache()
  const controller = new AbortController()
  controller.abort()
  await expect(putVerifiedResource(cache, '/ai/weights', new ArrayBuffer(32*1024*1024+1),
    new Headers({'x-modela-sha256':'c'.repeat(64)}), controller.signal, () => {})).rejects.toThrow()
  expect(await cachedResource(cache, '/ai/weights')).toBeUndefined()
})
