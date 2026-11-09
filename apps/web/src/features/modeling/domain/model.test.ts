import { describe, expect, it } from 'vitest'
import {
  applyCommand,
  createClass,
  createDiagram,
  validateDiagram,
  type Diagram,
  type UmlAttribute,
  type UmlRelation,
} from './model'

function withClasses(count = 2) {
  let d = createDiagram()
  for (let i = 0; i < count; i++) d = applyCommand(d, { type: 'addClass', value: createClass(d) })
  return d
}
function relation(d: Diagram, type: UmlRelation['type'] = 'association'): UmlRelation {
  return {
    id: crypto.randomUUID(),
    type,
    sourceId: d.classes[0].id,
    targetId: d.classes[1].id,
    name: '',
    sourceMultiplicity: '1',
    targetMultiplicity: '0..*',
  }
}
function attribute(): UmlAttribute {
  return {
    id: crypto.randomUUID(),
    name: 'precio',
    dataType: 'Decimal',
    visibility: 'private',
    identifier: false,
    required: true,
  }
}
describe('P-CU07: crear un modelo local válido', () => {
  it('crea un borrador vacío con UUID y revisión local inicial', () => {
    const d = createDiagram('Inventario')
    expect(d.classes).toEqual([])
    expect(d.relations).toEqual([])
    expect(d.localRevision).toBe(0)
    expect(validateDiagram(JSON.parse(JSON.stringify(d)))).toEqual(d)
  })
  it('conserva identificadores y el modelo anterior al agregar una clase', () => {
    const original = createDiagram()
    const c = createClass(original)
    const updated = applyCommand(original, { type: 'addClass', value: c })
    expect(original.classes).toHaveLength(0)
    expect(updated.classes[0].id).toBe(c.id)
    expect(updated.id).toBe(original.id)
    expect(updated.localRevision).toBe(1)
  })
  it('rechaza clases duplicadas ignorando mayúsculas y espacios', () => {
    const d = withClasses(1)
    expect(() =>
      applyCommand(d, { type: 'addClass', value: { ...createClass(d), name: ' clase1 ' } }),
    ).toThrow('Ya existe una clase')
  })
  it.each(['', '   ', '123Clase', 'Clase con espacios'])('rechaza nombre inválido %j', (name) => {
    const d = withClasses(1)
    expect(() =>
      applyCommand(d, { type: 'updateClass', id: d.classes[0].id, name, abstract: false }),
    ).toThrow()
  })
})
describe('P-CU08: editar, validar y eliminar', () => {
  it('edita nombre, abstracción y posición sin cambiar el identificador', () => {
    const d = withClasses(1)
    const id = d.classes[0].id
    const renamed = applyCommand(d, { type: 'updateClass', id, name: 'Producto', abstract: true })
    const moved = applyCommand(renamed, { type: 'moveClass', id, position: { x: -50, y: 200 } })
    expect(moved.classes[0]).toMatchObject({
      id,
      name: 'Producto',
      abstract: true,
      position: { x: -50, y: 200 },
    })
  })
  it('crea, edita y elimina un atributo manteniendo su identidad', () => {
    const d = withClasses(1),
      value = attribute(),
      classId = d.classes[0].id
    const added = applyCommand(d, { type: 'upsertAttribute', classId, value })
    const changed = applyCommand(added, {
      type: 'upsertAttribute',
      classId,
      value: { ...value, name: 'costo' },
    })
    expect(changed.classes[0].attributes).toEqual([{ ...value, name: 'costo' }])
    expect(
      applyCommand(changed, { type: 'deleteAttribute', classId, id: value.id }).classes[0]
        .attributes,
    ).toEqual([])
  })
  it('rechaza atributos duplicados y tipos desconocidos', () => {
    const d = withClasses(1),
      value = attribute(),
      classId = d.classes[0].id
    const added = applyCommand(d, { type: 'upsertAttribute', classId, value })
    expect(() =>
      applyCommand(added, {
        type: 'upsertAttribute',
        classId,
        value: { ...value, id: crypto.randomUUID() },
      }),
    ).toThrow('Ya existe un atributo')
    expect(() =>
      validateDiagram({
        ...d,
        classes: [{ ...d.classes[0], attributes: [{ ...value, dataType: 'inventado' }] }],
      }),
    ).toThrow()
  })
  it('rechaza identificadores repetidos y atributos identificadores opcionales', () => {
    const d = withClasses(1)
    expect(() =>
      applyCommand(d, {
        type: 'upsertAttribute',
        classId: d.classes[0].id,
        value: { ...attribute(), id: d.id },
      }),
    ).toThrow('identificadores')
    expect(() =>
      applyCommand(d, {
        type: 'upsertAttribute',
        classId: d.classes[0].id,
        value: { ...attribute(), identifier: true, required: false },
      }),
    ).toThrow('obligatorio')
  })
  it('exige confirmar el borrado con relaciones y elimina dependencias atómicamente', () => {
    const d = withClasses(),
      r = relation(d)
    const linked = applyCommand(d, { type: 'upsertRelation', value: r })
    expect(() =>
      applyCommand(linked, { type: 'deleteClass', id: d.classes[0].id, confirmRelations: false }),
    ).toThrow('Confirma')
    expect(linked.relations).toHaveLength(1)
    const deleted = applyCommand(linked, {
      type: 'deleteClass',
      id: d.classes[0].id,
      confirmRelations: true,
    })
    expect(deleted.classes).toHaveLength(1)
    expect(deleted.relations).toEqual([])
  })
  it('rechaza referencias externas y relaciones duplicadas', () => {
    const d = withClasses(),
      r = relation(d)
    expect(() =>
      applyCommand(d, { type: 'upsertRelation', value: { ...r, targetId: crypto.randomUUID() } }),
    ).toThrow('extremos')
    const linked = applyCommand(d, { type: 'upsertRelation', value: r })
    expect(() =>
      applyCommand(linked, { type: 'upsertRelation', value: { ...r, id: crypto.randomUUID() } }),
    ).toThrow('Ya existe esa relación')
  })
  it('permite asociaciones reflexivas', () => {
    const d = withClasses()
    expect(
      applyCommand(d, {
        type: 'upsertRelation',
        value: { ...relation(d), targetId: d.classes[0].id },
      }).relations,
    ).toHaveLength(1)
  })
  it('rechaza autorreferencia, ciclos y herencia múltiple', () => {
    const d = withClasses(3),
      r = relation(d, 'generalization')
    expect(() =>
      applyCommand(d, { type: 'upsertRelation', value: { ...r, targetId: r.sourceId } }),
    ).toThrow('sí misma')
    const linked = applyCommand(d, { type: 'upsertRelation', value: r })
    expect(() =>
      applyCommand(linked, {
        type: 'upsertRelation',
        value: { ...r, id: crypto.randomUUID(), sourceId: r.targetId, targetId: r.sourceId },
      }),
    ).toThrow('ciclo')
    expect(() =>
      applyCommand(linked, {
        type: 'upsertRelation',
        value: { ...r, id: crypto.randomUUID(), targetId: d.classes[2].id },
      }),
    ).toThrow('una sola superclase')
  })
  it.each(['2..1', 'muchos', '-1'])('rechaza multiplicidad inválida %s', (sourceMultiplicity) => {
    const d = withClasses()
    expect(() =>
      applyCommand(d, { type: 'upsertRelation', value: { ...relation(d), sourceMultiplicity } }),
    ).toThrow()
  })
  it('edita y elimina relaciones existentes', () => {
    const d = withClasses(),
      r = relation(d)
    const linked = applyCommand(d, { type: 'upsertRelation', value: r })
    const renamed = applyCommand(linked, {
      type: 'upsertRelation',
      value: { ...r, name: 'contiene' },
    })
    expect(renamed.relations[0].name).toBe('contiene')
    expect(applyCommand(renamed, { type: 'deleteRelation', id: r.id }).relations).toEqual([])
  })
  it('crea una clase Detalle para una asociación muchos a muchos', () => {
    const d = withClasses()
    const linked = applyCommand(d, {
      type: 'upsertRelation',
      value: { ...relation(d), sourceMultiplicity: '*', targetMultiplicity: '0..*' },
    })
    expect(linked.classes).toHaveLength(3)
    expect(linked.classes[2].name).toBe('Detalle')
    expect(linked.relations[0].associationClassId).toBe(linked.classes[2].id)
  })
  it('al eliminar una clase de asociación conserva la relación sin referencia inválida', () => {
    const d = withClasses()
    const linked = applyCommand(d, { type: 'upsertRelation', value: { ...relation(d), sourceMultiplicity: '*', targetMultiplicity: '0..*' } })
    const associationId = linked.classes[2].id
    const updated = applyCommand(linked, { type: 'deleteClass', id: associationId, confirmRelations: true })
    expect(updated.classes).toHaveLength(2)
    expect(updated.relations).toHaveLength(1)
    expect(updated.relations[0].associationClassId).toBeNull()
  })
})
