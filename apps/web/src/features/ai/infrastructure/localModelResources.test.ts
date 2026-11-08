import { afterEach, expect, test, vi } from 'vitest'
import { createHash, webcrypto } from 'node:crypto'
import { File as NodeFile } from 'node:buffer'
import { cacheSelectedModel } from './localModelResources'
import type { ResourceManifest } from './resources'

vi.mock('../../modeling/infrastructure/prepareOfflineApp', () => ({ prepareOfflineApp: vi.fn() }))

function setup() {
  const entries = new Map<string, Response>()
  const cache = {
    async put(key: string, value: Response) { entries.set(key, value.clone()) },
    async match(key: string) { return entries.get(key)?.clone() },
  } as unknown as Cache
  vi.stubGlobal('self', { location: { origin: 'https://test.local' } })
  vi.stubGlobal('crypto', webcrypto)
  const fetchSpy = vi.fn(() => { throw new Error('No debe enviarse ningún archivo') })
  vi.stubGlobal('fetch', fetchSpy)
  const data = 'archivo local de prueba'
  const hash = createHash('sha256').update(data).digest('hex')
  const manifest: ResourceManifest = { id: 'test', revision: 'test', dtype: 'test', transformers: 'test', runtime: 'test',
    files: [{ url: '/ai/models/model.bin', bytes: Buffer.byteLength(data), sha256: hash }] }
  function file(content = data, path = 'ai/models/model.bin') {
    const result = new NodeFile([content], 'model.bin')
    Object.defineProperty(result, 'webkitRelativePath', { value: path })
    return result as unknown as File
  }
  return { cache, entries, fetchSpy, manifest, file }
}
afterEach(() => vi.unstubAllGlobals())

test('prepara archivos locales verificados sin enviarlos por red', async () => {
  const { cache, entries, fetchSpy, manifest, file } = setup()
  await cacheSelectedModel([file()], manifest, cache, () => {}, new AbortController().signal)
  expect(await entries.get('/ai/models/model.bin')?.text()).toBe('archivo local de prueba')
  expect(entries.has('/ai/manifest-qwen3-1.7b-external.json')).toBe(true)
  expect(fetchSpy).not.toHaveBeenCalled()
})

test('rechaza archivos modificados y no publica el manifiesto', async () => {
  const { cache, entries, manifest, file } = setup()
  await expect(cacheSelectedModel([file('archivo local de pruebX')], manifest, cache, () => {}, new AbortController().signal)).rejects.toThrow()
  expect(entries.has('/ai/manifest-qwen3-1.7b-external.json')).toBe(false)
})

test('rechaza una carpeta incompleta o ambigua', async () => {
  const { cache, entries, manifest, file } = setup()
  const signal = new AbortController().signal
  await expect(cacheSelectedModel([], manifest, cache, () => {}, signal)).rejects.toThrow()
  await expect(cacheSelectedModel([file(), file()], manifest, cache, () => {}, signal)).rejects.toThrow()
  expect(entries.has('/ai/manifest-qwen3-1.7b-external.json')).toBe(false)
})
