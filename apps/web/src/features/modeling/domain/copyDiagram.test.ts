import { expect, it } from 'vitest'
import { createDiagram, createClass, applyCommand, validateDiagram } from './model'
import { copyLocalDiagram } from './copyDiagram'

it('copia un borrador con UUID independientes, remapea extremos y conserva el original', () => {
  let source = createDiagram('Borrador')
  source = applyCommand(source, { type: 'addClass', value: createClass(source) })
  source = applyCommand(source, { type: 'addClass', value: createClass(source) })
  source.classes[0].attributes.push({
    id: crypto.randomUUID(),
    name: 'id',
    dataType: 'UUID',
    visibility: 'private',
    identifier: true,
    required: true,
  })
  source.relations.push({
    id: crypto.randomUUID(),
    type: 'association',
    sourceId: source.classes[0].id,
    targetId: source.classes[1].id,
    name: 'contiene',
    sourceMultiplicity: '1',
    targetMultiplicity: '*',
  })
  const before = structuredClone(source)
  const copy = copyLocalDiagram(source)
  expect(source).toEqual(before)
  expect(copy.id).not.toBe(source.id)
  expect(copy.classes[0].attributes[0].id).not.toBe(source.classes[0].attributes[0].id)
  expect(copy.relations[0].sourceId).toBe(copy.classes[0].id)
  expect(copy.relations[0].targetId).toBe(copy.classes[1].id)
  expect(copy.localRevision).toBe(0)
  expect(validateDiagram(copy)).toEqual(copy)
})
