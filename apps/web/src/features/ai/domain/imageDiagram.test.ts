import { describe, expect, it } from 'vitest'
import { applyCommand, createDiagram } from '../../modeling/domain/model'
import { imageModelCommand, parseImageModel } from './imageDiagram'

describe('modelo de imagen', () => {
  const raw = JSON.stringify({ classes: [
    { name: 'Cliente', attributes: [{ name: 'nombre', type: 'String' }] },
    { name: 'Pedido', attributes: [] },
  ], relations: [{ source: 'Cliente', target: 'Pedido', type: 'association', sourceMultiplicity: '1', targetMultiplicity: '0..*' }] })
  it('agrega clases, atributos y relaciones sin reemplazar el diagrama', () => {
    const base = createDiagram('Prueba')
    const next = applyCommand(base, imageModelCommand(base, parseImageModel(raw)))
    expect(next.classes.map(c => c.name)).toEqual(['Cliente', 'Pedido'])
    expect(next.classes[0].attributes[0]).toMatchObject({ name: 'nombre', dataType: 'String' })
    expect(next.relations[0]).toMatchObject({ sourceId: next.classes[0].id, targetId: next.classes[1].id, targetMultiplicity: '0..*' })
  })
  it('rechaza la salida inválida y las multiplicidades desconocidas', () => {
    expect(() => parseImageModel('texto sin JSON')).toThrow()
    const data = parseImageModel(raw); data.relations[0].targetMultiplicity = ''
    expect(() => imageModelCommand(createDiagram(), data)).toThrow(/multiplicidades/)
  })
  it('evita guardar si el diagrama cambió después de revisar', () => {
    const base = createDiagram(); const command = imageModelCommand(base, parseImageModel(raw))
    expect(() => applyCommand({ ...base, name: 'Modificado' }, command)).toThrow(/cambió/)
  })
})
