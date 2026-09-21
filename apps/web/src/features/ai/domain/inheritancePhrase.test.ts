import { expect, it } from 'vitest'
import { labDiagram } from './corpus'
import { requestedEditorOperations, reviewedEditorCommand } from './editorProposal'
import { applyCommand } from '../../modeling/domain/model'

it.each(['La clase automóvil hereda de vehiculo', 'automóvil hereda de la clase vehiculo.'])('%s conserva dirección y nombres', (instruction) => {
  const base = labDiagram(['automóvil', 'vehiculo'])
  const operations = requestedEditorOperations(instruction)
  expect(operations).toEqual([{ type: 'addRelation', source: 'automóvil', target: 'vehiculo', kind: 'generalization', sourceMultiplicity: '1', targetMultiplicity: '1' }])
  const command = reviewedEditorCommand(instruction, base, { status: 'propose', operations })
  expect(base.relations).toHaveLength(0)
  const saved = applyCommand(base, command)
  expect(saved.classes).toHaveLength(2)
  expect(saved.relations[0]).toMatchObject({ sourceId: base.classes[0].id, targetId: base.classes[1].id, type: 'generalization' })
  expect(() => reviewedEditorCommand(instruction, labDiagram(['vehiculo']), { status: 'propose', operations })).toThrow()
  const reverse = 'La clase vehiculo hereda de automóvil'
  expect(() => reviewedEditorCommand(reverse, saved, { status: 'propose', operations: requestedEditorOperations(reverse) })).toThrow()
})
