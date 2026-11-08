import 'fake-indexeddb/auto'
import { expect, it } from 'vitest'
import { applyCommand } from '../../modeling/domain/model'
import { DiagramRepository } from '../../modeling/infrastructure/diagramRepository'
import { labDiagram } from './corpus'
import { editorExamples, requestedEditorOperations, reviewedEditorCommand } from './editorProposal'

it.each(['crea clase factura', 'crea la clase factura'])('prepara sin modelo: %s', instruction => {
  const base = labDiagram([])
  const command = reviewedEditorCommand(instruction, base, {
    status: 'propose', operations: requestedEditorOperations(instruction),
  })
  expect(applyCommand(base, command).classes.map(c => c.name)).toEqual(['factura'])
  expect(base.classes).toHaveLength(0)
})

it.each(editorExamples)('admite y revisa el comando de presentación: %s', (instruction) => {
  const base = labDiagram(['Lancha', 'Capitan', 'Embarcacion', 'Cliente', 'Pedido', ...(instruction.startsWith('La clase') ? ['automóvil', 'vehiculo'] : [])])
  const before = JSON.stringify(base)
  const command = reviewedEditorCommand(instruction, base, {
    status: 'propose',
    operations: requestedEditorOperations(instruction),
  })
  expect(JSON.stringify(base)).toBe(before)
  const changed = applyCommand(base, command)
  expect(changed.localRevision).toBe(base.localRevision + 1)
})

it.each([
  'Agrega el método navegar con retorno Boolean a Lancha.',
  'Elimina Lancha.',
  'Asocia Lancha con Capitan.',
  'Crea un sistema de biblioteca.',
  'Cambia capacidad de Lancha a Integer.',
])('no infiere una operación alternativa fuera de alcance: %s', (instruction) => {
  expect(() => requestedEditorOperations(instruction)).toThrow()
})

it('rechaza una clase extra, tipo cambiado y obligatoriedad no pedida', () => {
  const base = labDiagram(['Lancha'])
  const instruction = 'Agrega capacidad de tipo Long a Lancha.'
  const requested = requestedEditorOperations(instruction)
  for (const operations of [
    [...requested, ...requestedEditorOperations('Crea la clase Extra.')],
    requestedEditorOperations('Agrega capacidad de tipo Integer a Lancha.'),
    requestedEditorOperations('Agrega capacidad de tipo Long obligatoria a Lancha.'),
  ])
    expect(() =>
      reviewedEditorCommand(instruction, base, { status: 'propose', operations }),
    ).toThrow('no coincide')
})

it('guarda clase y atributo juntos una sola vez y conserva UUID al reintentar', async () => {
  const base = labDiagram([])
  const repo = new DiagramRepository(crypto.randomUUID())
  try {
    await repo.save(base, null)
    const instruction = 'Crea Faro y agrega altura de tipo Decimal a Faro.'
    const command = reviewedEditorCommand(instruction, base, {
      status: 'propose',
      operations: requestedEditorOperations(instruction),
    })
    const first = applyCommand(base, command)
    const retry = applyCommand(base, command)
    expect(retry.classes).toEqual(first.classes)
    await repo.save(first, base.localRevision)
    expect((await repo.list())[0].classes[0].attributes[0].name).toBe('altura')
    await expect(repo.save(retry, base.localRevision)).rejects.toThrow('otra pestaña')
    expect(() => applyCommand(first, command)).toThrow('cambió')
    expect(() => applyCommand({ ...base, id: crypto.randomUUID() }, command)).toThrow('cambió')
  } finally {
    await repo.close()
  }
})

it('una propuesta inválida no crea parcialmente una clase', () => {
  const base = labDiagram([])
  const before = JSON.stringify(base)
  expect(() =>
    reviewedEditorCommand('Crea Faro y agrega altura de tipo GeoPoint a Faro.', base, {
      status: 'propose',
      operations: [],
    }),
  ).toThrow()
  expect(JSON.stringify(base)).toBe(before)
})
