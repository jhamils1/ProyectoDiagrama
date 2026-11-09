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
  const base = labDiagram(['Lancha', 'Capitan', 'Embarcacion', 'Cliente', 'Pedido', ...(instruction.includes('atributo fecha') ? ['Factura'] : []), ...(instruction.startsWith('La clase') ? ['automóvil', 'vehiculo'] : [])])
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
  'Añade una clase Factura', 'Por favor, crea la clase Factura.',
  '¿Puedes crear la clase Factura?', 'Incorpora clase Factura por favor',
  '¿Podrías incluir una clase llamada Factura?',
])('interpreta la creación explícita de clase: %s', instruction => {
  expect(requestedEditorOperations(instruction)).toMatchObject([{ type: 'addClass', name: 'Factura' }])
})

it.each([
  'Añade el atributo fecha de tipo Date a Factura',
  '¿Puedes incorporar el atributo fecha de tipo Date a Factura?',
  'Por favor agrega fecha de tipo Date en la clase Factura',
  'Incluye un atributo fecha de tipo Date para la clase Factura, por favor.',
])('interpreta variantes explícitas para un atributo: %s', instruction => {
  const base = labDiagram(['Factura'])
  const operations = requestedEditorOperations(instruction, base)
  expect(operations).toMatchObject([{ type: 'addAttribute', name: 'fecha', className: 'Factura', dataType: 'Date' }])
  expect(applyCommand(base, reviewedEditorCommand(instruction, base, { status: 'propose', operations })).classes[0].attributes)
    .toMatchObject([{ name: 'fecha', dataType: 'Date' }])
})

it.each([
  '¿Cómo puedo crear la clase Factura?', '¿Qué pasa si agrego fecha a Factura?',
  'No crees la clase Factura', '¿Debería crear la clase Factura?',
  'Por favor crea la clase Factura y elimina Cliente',
])('no convierte consultas, negaciones ni acciones extra en una edición: %s', instruction => {
  expect(() => requestedEditorOperations(instruction)).toThrow()
})

it('renombra con un nombre y destino expresos', () => {
  expect(requestedEditorOperations('¿Puedes renombrar la clase Factura como Recibo?'))
    .toMatchObject([{ type: 'renameClass', name: 'Factura', newName: 'Recibo' }])
})

it.each([
  'Elimina Lancha.',
  'Asocia Lancha con Capitan.',
  'Crea un sistema de biblioteca.',
  'Cambia capacidad de Lancha a Integer.',
])('no infiere una operación alternativa fuera de alcance: %s', (instruction) => {
  expect(() => requestedEditorOperations(instruction)).toThrow()
})

it.each([
  ['Agrega el método encender con retorno void a Lancha.', 'encender', 'void'],
  ['Agrega un metodo apagar() en la clase Lancha con retorno Boolean', 'apagar', 'Boolean'],
  ['Crea el método calcular a Lancha', 'calcular', ''],
  ['Crea el método navegar para la clase Lancha de tipo Boolean', 'navegar', 'Boolean'],
  ['Añadir un método llamado encender en la clase Lancha con retorno void', 'encender', 'void'],
  ['Incorpora a la clase Lancha el método apagar con retorno void.', 'apagar', 'void'],
  ['¿Puedes incluir el método encender en la clase Lancha que devuelve Boolean?', 'encender', 'Boolean'],
  ['Pon el metodo navegar para Lancha', 'navegar', ''],
])('crea el método solicitado sin inventar su tipo: %s', (instruction, name, returnType) => {
  const base = labDiagram(['Lancha'])
  const operations = requestedEditorOperations(instruction, base)
  const command = reviewedEditorCommand(instruction, base, { status: 'propose', operations })
  expect(applyCommand(base, command).classes[0].methods).toMatchObject([{ name, returnType, visibility: 'public' }])
})

it('rechaza métodos duplicados, clases inexistentes y peticiones con acciones extra', () => {
  const base = labDiagram(['Lancha'])
  const instruction = 'Agrega el método encender con retorno void a Lancha'
  const make = (text: string, diagram = base) => reviewedEditorCommand(text, diagram,
    { status: 'propose', operations: requestedEditorOperations(text, diagram) })
  const updated = applyCommand(base, make(instruction))
  expect(() => make(instruction, updated)).toThrow('Ya existe un método')
  expect(() => make('Agrega el método encender a Barco')).toThrow('No existe la clase')
  expect(() => requestedEditorOperations(`${instruction} y elimina Lancha`)).toThrow()
  expect(() => requestedEditorOperations('No agregues el método encender a Lancha')).toThrow()
  expect(() => requestedEditorOperations('¿Puedes incluir el método encender a Lancha y borrar Lancha?')).toThrow()
  expect(() => make('Agrega el método encender con retorno Inexistente a Lancha')).toThrow('Tipo no admitido')
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
