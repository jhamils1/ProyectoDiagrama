import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { applyCommand, createClass, createDiagram } from '../domain/model'
import { DiagramRepository, LocalConflictError } from './diagramRepository'

const repositories: DiagramRepository[] = []
const repo = (name = crypto.randomUUID()) => {
  const r = new DiagramRepository(name)
  repositories.push(r)
  return r
}
afterEach(async () => {
  await Promise.all(repositories.splice(0).map((r) => r.close()))
})
describe('P-CU07/08: persistencia local real mediante API IndexedDB', () => {
  it('recupera el mismo diagrama tras cerrar y abrir el almacenamiento', async () => {
    const name = crypto.randomUUID(),
      first = repo(name),
      d = createDiagram()
    await first.save(d, null)
    const edited = applyCommand(d, { type: 'addClass', value: createClass(d) })
    await first.save(edited, d.localRevision)
    await first.close()
    expect(await repo(name).list()).toEqual([edited])
  })
  it('conserva borradores separados', async () => {
    const r = repo(),
      a = createDiagram('Uno'),
      b = createDiagram('Dos')
    await r.save(a, null)
    await r.save(b, null)
    expect((await r.list()).map((d) => d.id).sort()).toEqual([a.id, b.id].sort())
  })
  it('dos pestañas no pueden sobrescribir la misma revisión', async () => {
    const name = crypto.randomUUID(),
      a = repo(name),
      b = repo(name),
      d = createDiagram()
    await a.save(d, null)
    const first = applyCommand(d, { type: 'renameDiagram', name: 'Primera propuesta' })
    const second = applyCommand(d, { type: 'renameDiagram', name: 'Segunda propuesta' })
    const results = await Promise.allSettled([a.save(first, 0), b.save(second, 0)])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult
    expect(rejected.reason).toBeInstanceOf(LocalConflictError)
    expect(['Primera propuesta', 'Segunda propuesta']).toContain((await a.list())[0].name)
    expect((await a.list())[0].localRevision).toBe(1)
  })
  it('no reemplaza datos si se intenta guardar un documento inválido', async () => {
    const r = repo(),
      d = createDiagram()
    await r.save(d, null)
    await expect(r.save({ ...d, name: '' }, 0)).rejects.toThrow()
    expect(await r.list()).toEqual([d])
  })
  it('rechaza creación duplicada y salto de revisión', async () => {
    const r = repo(),
      d = createDiagram()
    await r.save(d, null)
    await expect(r.save(d, null)).rejects.toBeInstanceOf(LocalConflictError)
    await expect(r.save({ ...d, localRevision: 3 }, 0)).rejects.toThrow('exactamente en uno')
    expect(await r.list()).toEqual([d])
  })
})
