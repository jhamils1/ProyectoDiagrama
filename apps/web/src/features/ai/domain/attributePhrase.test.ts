import { expect, it } from 'vitest'
import { requestedEditorOperations, reviewedEditorCommand } from './editorProposal'
import { labDiagram } from './corpus'
import { applyCommand } from '../../modeling/domain/model'

it.each([
  ['String', 'String'], ['string', 'String'], ['int', 'Integer'],
  ['boolean', 'Boolean'], ['bool', 'Boolean'], ['float', 'Float'],
  ['double', 'Double'], ['Decimal', 'Decimal'], ['LONG', 'Long'],
])('interpreta el tipo %s y conserva su significado', (input, expected) => {
  const instruction = `Agrega el atributo modelo de tipo ${input} en la clase vehiculo.`
  const base = labDiagram(['vehiculo'])
  const operations = requestedEditorOperations(instruction)
  const command = reviewedEditorCommand(instruction, base, { status: 'propose', operations })
  expect(applyCommand(base, command).classes[0].attributes[0].dataType).toBe(expected)
})

it('rechaza tipos desconocidos sin sustituirlos', () => {
  expect(() => requestedEditorOperations('Agrega modelo de tipo GeoPoint a vehiculo.')).toThrow('Tipo no admitido')
})

it.each([
  ['Crea la clase vehiculo con atributo marca', 'vehiculo', 'marca'],
  ['Crea la clase Producto con el atributo precio.', 'Producto', 'precio'],
])('crea clase y atributo juntos: %s', (instruction, className, name) => {
  const base = labDiagram([])
  const operations = requestedEditorOperations(instruction)
  expect(operations).toEqual([
    { type: 'addClass', name: className, abstract: false },
    { type: 'addAttribute', className, name, dataType: '', required: false },
  ])
  const proposal = { status: 'propose' as const, operations }
  const command = reviewedEditorCommand(instruction, base, proposal)
  expect(base.classes).toHaveLength(0)
  const saved = applyCommand(base, command)
  expect(saved.classes).toHaveLength(1)
  expect(saved.classes[0]).toMatchObject({ name: className, attributes: [{ name, dataType: '' }] })
  expect(() => reviewedEditorCommand(instruction, saved, proposal)).toThrow()
  expect(() => reviewedEditorCommand(instruction, base, {
    status: 'propose', operations: [operations[0], {
      type: 'addAttribute', className, name, dataType: 'String', required: false,
    }],
  })).toThrow()
})

it('acepta la frase exacta del usuario conservando nombres y tipo vacío', () => {
  const instruction = 'agrega el atributo modelo en la clase vehiculo'
  const base = labDiagram(['vehiculo'])
  const operations = requestedEditorOperations(instruction)
  expect(operations).toEqual([
    { type: 'addAttribute', name: 'modelo', className: 'vehiculo', dataType: '', required: false },
  ])
  const saved = applyCommand(
    base,
    reviewedEditorCommand(instruction, base, { status: 'propose', operations }),
  )
  expect(saved.classes[0].attributes[0]).toMatchObject({ name: 'modelo', dataType: '' })
})
it('conserva el tipo y obligatoriedad si se indican en la forma ampliada', () => {
  expect(
    requestedEditorOperations(
      'Agrega el atributo modelo de tipo String obligatorio en la clase vehiculo.',
    ),
  ).toEqual([
    {
      type: 'addAttribute',
      name: 'modelo',
      className: 'vehiculo',
      dataType: 'String',
      required: true,
    },
  ])
})
