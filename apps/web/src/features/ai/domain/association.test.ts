import { expect, it, vi } from 'vitest'
import { associationMessages, associationRequest } from './association'
import {
  requestedEditorOperations,
  reviewedEditorCommand,
  describeOperation,
} from './editorProposal'
import { labDiagram } from './corpus'
import { applyCommand } from '../../modeling/domain/model'
import { interpret } from './interpret'

const examples = [
  [
    'Crear una asociación entre Cliente y Pedido, donde un Cliente puede tener muchos Pedidos y cada Pedido pertenece a un solo Cliente.',
    'Cliente',
    'Pedido',
  ],
  [
    'Un Usuario puede tener muchos Proyectos y cada Proyecto pertenece a un Usuario.',
    'Usuario',
    'Proyecto',
  ],
  [
    'Un Departamento tiene muchos Empleados y cada Empleado pertenece a un Departamento.',
    'Departamento',
    'Empleado',
  ],
]
it('no confunde nombres de clases con instrucciones de asociación', () => {
  expect(requestedEditorOperations('Crea la clase Asociacion.')).toMatchObject([
    { type: 'addClass', name: 'Asociacion' },
  ])
  expect(requestedEditorOperations('Agrega muchos de tipo Long a Lancha.')).toMatchObject([
    { type: 'addAttribute', name: 'muchos' },
  ])
})
it.each(examples)(
  'interpreta el contrato natural sin crear clases: %s',
  (instruction, source, target) => {
    const base = labDiagram([source, target])
    const requested = requestedEditorOperations(instruction, base)
    expect(requested).toEqual([
      {
        type: 'addRelation',
        source,
        target,
        kind: 'association',
        sourceMultiplicity: '1',
        targetMultiplicity: '0..*',
      },
    ])
    const command = reviewedEditorCommand(instruction, base, {
      status: 'propose',
      operations: requested,
    })
    expect(base.relations).toHaveLength(0)
    const saved = applyCommand(base, command)
    expect(saved.classes).toEqual(base.classes)
    expect(saved.relations[0]).toMatchObject({
      type: 'association',
      sourceId: base.classes[0].id,
      targetId: base.classes[1].id,
      sourceMultiplicity: '1',
      targetMultiplicity: '0..*',
    })
    expect(describeOperation(requested[0])).toContain(`${source} 1 — 0..* ${target}`)
  },
)
it.each([
  'Asocia Cliente con Pedido.',
  'Crear una asociación entre Cliente y Pedido.',
  'Un Cliente puede tener muchos Pedidos.',
  'Un Cliente puede tener muchos Pedidos y cada Pedido pertenece a un Usuario.',
])('solicita aclaración sin completar datos: %s', (instruction) => {
  expect(() => requestedEditorOperations(instruction, labDiagram(['Cliente', 'Pedido']))).toThrow(
    /Aclara|coinciden/,
  )
})
it('exige clases existentes e indica crear primero; no acepta plural como nombre de clase', () => {
  expect(() => requestedEditorOperations(examples[0][0], labDiagram(['Cliente']))).toThrow(
    'Primero debes crearla',
  )
  expect(() =>
    requestedEditorOperations(examples[1][0], labDiagram(['Usuario', 'Proyectos'])),
  ).toThrow('Proyecto no existe')
})
it('conserva multiplicidad explícita y rechaza inversiones, herencia u operaciones extra', () => {
  const instruction = 'Asocia Cliente con Pedido, multiplicidad origen 1 y destino 1..*.'
  const base = labDiagram(['Cliente', 'Pedido'])
  const op = associationRequest(instruction)!
  expect(op).toMatchObject({ targetMultiplicity: '1..*' })
  for (const operations of [
    [{ ...op, sourceMultiplicity: '0..*', targetMultiplicity: '1' }],
    [{ ...op, source: 'Pedido', target: 'Cliente' }],
    [{ ...op, kind: 'generalization' }],
    [op, { type: 'addClass', name: 'Extra', abstract: false }],
  ])
    expect(() =>
      reviewedEditorCommand(instruction, base, { status: 'propose', operations } as never),
    ).toThrow('no coincide')
})
it('permite que el motor corrija una multiplicidad equivocada sin reparar su JSON', async () => {
  const instruction = examples[0][0],
    base = labDiagram(['Cliente', 'Pedido'])
  const operation = associationRequest(instruction)!
  const output = (op: unknown) => ({
    raw: JSON.stringify({ status: 'propose', operations: [op] }),
    elapsedMs: 1,
    inputTokens: 1,
    outputTokens: 1,
    tokenLimitReached: false,
  })
  const generate = vi
    .fn()
    .mockResolvedValueOnce(output({ ...operation, targetMultiplicity: '1' }))
    .mockResolvedValueOnce(output(operation))
  const result = await interpret(instruction, base, generate, {
    messages: associationMessages(instruction, base),
    validate: (p) => {
      reviewedEditorCommand(instruction, base, p)
    },
  })
  expect(generate).toHaveBeenCalledTimes(2)
  expect(result.attempts).toHaveLength(2)
  expect(base.relations).toHaveLength(0)
})
