import { afterEach, expect, test, vi } from 'vitest'
import { TextClient, TextEngineError } from './textClient'

class WorkerStub {
  static last: WorkerStub
  onmessage?: (event: { data: unknown }) => void
  onerror?: (event: unknown) => void
  terminate = vi.fn()
  postMessage = vi.fn()
  constructor() { WorkerStub.last = this }
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })
test('progress does not resolve the load and a stalled worker is stopped', async () => {
  vi.useFakeTimers(); vi.stubGlobal('Worker', WorkerStub)
  const client = new TextClient(), progress = vi.fn()
  const request = client.request('load', undefined, 'qwen3-1.7b-external', 'legacy', progress)
  const assertion = expect(request).rejects.toThrow('3 minutos')
  WorkerStub.last.onmessage?.({data:{id:1,progress:'Cargando GPU'}})
  expect(progress).toHaveBeenCalledWith('Cargando GPU')
  await vi.advanceTimersByTimeAsync(180001)
  await assertion
  expect(WorkerStub.last.terminate).toHaveBeenCalledOnce()
})
test('load and chat use the same worker and cancellation rejects pending work', async () => {
  vi.stubGlobal('Worker', WorkerStub)
  const client = new TextClient()
  const loaded = client.request('load')
  WorkerStub.last.onmessage?.({data:{id:1,result:{device:'webgpu'}}})
  await expect(loaded).resolves.toEqual({device:'webgpu'})
  const request = client.request('chat', [{role:'user',content:'Hola'}])
  const assertion = expect(request).rejects.toThrow('cancelada')
  client.cancel()
  await assertion
  expect(WorkerStub.last.postMessage).toHaveBeenCalledTimes(2)
})
test('preserves the machine-readable context limit error', async () => {
  vi.stubGlobal('Worker', WorkerStub)
  const client = new TextClient()
  const request = client.request('chat')
  WorkerStub.last.onmessage?.({ data: { id: 1, error: 'Contexto demasiado largo', errorCode: 'CONTEXT_TOO_LONG' } })
  await expect(request).rejects.toMatchObject({ name: 'TextEngineError', code: 'CONTEXT_TOO_LONG' } satisfies Partial<TextEngineError>)
})
