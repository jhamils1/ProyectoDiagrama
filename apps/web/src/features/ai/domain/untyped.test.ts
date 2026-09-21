import 'fake-indexeddb/auto'
import { expect, it } from 'vitest'
import { requestedEditorOperations, reviewedEditorCommand } from './editorProposal'
import { labDiagram } from './corpus'
import { applyCommand } from '../../modeling/domain/model'
import { DiagramRepository } from '../../modeling/infrastructure/diagramRepository'

it.each([
  'Agrega modelo a Vehiculo.',
  'Agrega modelo sin tipo a Vehiculo.',
  'Agrega modelo obligatorio a Vehiculo.',
  'Agrega el atributo modelo en la clase Vehiculo.',
  'Agrega el atributo modelo a la clase Vehiculo.',
])('permite un atributo sin inventar tipo: %s', (instruction) => {
  const base = labDiagram(['Vehiculo'])
  const operations = requestedEditorOperations(instruction)
  expect(operations[0]).toMatchObject({ dataType: '' })
  const command = reviewedEditorCommand(instruction, base, { status: 'propose', operations })
  expect(applyCommand(base, command).classes[0].attributes[0].dataType).toBe('')
  expect(() =>
    reviewedEditorCommand(instruction, base, {
      status: 'propose',
      operations: [{ ...operations[0], dataType: 'String' }],
    } as never),
  ).toThrow('no coincide')
})
it('conserva sin tipo en IndexedDB y permite definirlo posteriormente', async () => {
  const base = labDiagram([]),
    instruction = 'Crea Vehiculo y agrega modelo a Vehiculo.'
  const repo = new DiagramRepository(crypto.randomUUID())
  try {
    await repo.save(base, null)
    const command = reviewedEditorCommand(instruction, base, {
      status: 'propose',
      operations: requestedEditorOperations(instruction),
    })
    const changed = applyCommand(base, command)
    await repo.save(changed, base.localRevision)
    expect((await repo.list())[0].classes[0].attributes[0].dataType).toBe('')
    const typed = applyCommand(changed, {
      type: 'upsertAttribute',
      classId: changed.classes[0].id,
      value: { ...changed.classes[0].attributes[0], dataType: 'String' },
    })
    await repo.save(typed, changed.localRevision)
    expect((await repo.list())[0].classes[0].attributes[0].dataType).toBe('String')
  } finally {
    await repo.close()
  }
})
