import { z } from 'zod'

export const dataTypes = [
  'String',
  'Integer',
  'Long',
  'Decimal',
  'Float',
  'Double',
  'Boolean',
  'Date',
  'DateTime',
  'UUID',
] as const
export const visibilities = ['private', 'public', 'protected', 'package'] as const
export const visibilitySymbols = { private: '−', public: '+', protected: '#', package: '~' }
const name = z
  .string()
  .trim()
  .min(1, 'El nombre es obligatorio.')
  .max(80, 'Máximo 80 caracteres.')
  .regex(
    /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ_][A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9_]*$/,
    'Usa letras (incluidas tildes y ñ), números y guion bajo; comienza con una letra o guion bajo.',
  )
const uuid = z.uuid()
const multiplicity = z
  .string()
  .max(80)
  .regex(/^(\*|\d+|\d+\.\.(\d+|\*))$/, 'Multiplicidad inválida. Usa 1, *, 0..1 o un intervalo.')
  .refine((value) => {
    const [min, max] = value.split('..')
    return !max || max === '*' || Number(min) <= Number(max)
  }, 'El límite inferior no puede superar al superior.')

export const attributeSchema = z.object({
  id: uuid,
  name,
  dataType: z.enum(['', ...dataTypes]).default(''),
  visibility: z.enum(visibilities),
  identifier: z.boolean(),
  required: z.boolean(),
})
export const classSchema = z.object({
  id: uuid,
  name,
  abstract: z.boolean(),
  position: z.object({
    x: z.number().finite().min(-100000).max(100000),
    y: z.number().finite().min(-100000).max(100000),
  }),
  attributes: z.array(attributeSchema).max(100),
})
export const relationSchema = z.object({
  id: uuid,
  type: z.enum(['association', 'generalization']),
  sourceId: uuid,
  targetId: uuid,
  name: z.string().trim().max(80),
  sourceMultiplicity: multiplicity,
  targetMultiplicity: multiplicity,
})
export const diagramSchema = z.object({
  schemaVersion: z.literal(1),
  id: uuid,
  name: z.string().trim().min(1, 'El diagrama necesita un nombre.').max(100),
  localRevision: z.number().int().nonnegative(),
  updatedAt: z.iso.datetime(),
  classes: z.array(classSchema).max(200),
  relations: z.array(relationSchema).max(500),
})
export type UmlAttribute = z.infer<typeof attributeSchema>
export type UmlClass = z.infer<typeof classSchema>
export type UmlRelation = z.infer<typeof relationSchema>
export type Diagram = z.infer<typeof diagramSchema>
export class ModelError extends Error {}

export function validateDiagram(input: unknown): Diagram {
  const result = diagramSchema.safeParse(input)
  if (!result.success) throw new ModelError(result.error.issues[0].message)
  const diagram = result.data
  const allIds = [
    diagram.id,
    ...diagram.classes.flatMap((c) => [c.id, ...c.attributes.map((a) => a.id)]),
    ...diagram.relations.map((r) => r.id),
  ]
  if (new Set(allIds).size !== allIds.length)
    throw new ModelError('Los identificadores de los elementos deben ser únicos.')
  const uniqueNames = (names: string[]) =>
    new Set(names.map((n) => n.toLowerCase())).size === names.length
  if (!uniqueNames(diagram.classes.map((c) => c.name)))
    throw new ModelError('Ya existe una clase con ese nombre.')
  for (const c of diagram.classes) {
    if (!uniqueNames(c.attributes.map((a) => a.name)))
      throw new ModelError('Ya existe un atributo con ese nombre en la clase.')
    if (c.attributes.filter((a) => a.identifier).length > 1)
      throw new ModelError('Esta primera versión admite un solo atributo identificador por clase.')
    if (c.attributes.some((a) => a.identifier && !a.required))
      throw new ModelError('Un atributo identificador debe ser obligatorio.')
  }
  const classIds = new Set(diagram.classes.map((c) => c.id))
  const relationKeys = new Set<string>()
  const parents = new Map<string, string>()
  for (const r of diagram.relations) {
    if (!classIds.has(r.sourceId) || !classIds.has(r.targetId))
      throw new ModelError('Ambos extremos deben pertenecer a este diagrama.')
    const key = JSON.stringify([r.type, r.sourceId, r.targetId, r.name.toLowerCase()])
    if (relationKeys.has(key)) throw new ModelError('Ya existe esa relación.')
    relationKeys.add(key)
    if (r.type === 'generalization') {
      if (r.sourceId === r.targetId) throw new ModelError('Una clase no puede heredar de sí misma.')
      if (parents.has(r.sourceId))
        throw new ModelError('Esta primera versión admite una sola superclase.')
      parents.set(r.sourceId, r.targetId)
    }
  }
  for (const origin of parents.keys()) {
    const visited = new Set<string>()
    let current: string | undefined = origin
    while (current) {
      if (visited.has(current)) throw new ModelError('La herencia no puede formar un ciclo.')
      visited.add(current)
      current = parents.get(current)
    }
  }
  return diagram
}

export type ModelCommand =
  | {
      type: 'applyReviewedEdit'
      expectedSnapshot: string
      classes: UmlClass[]
      relations: UmlRelation[]
    }
  | { type: 'renameDiagram'; name: string }
  | { type: 'addClass'; value: UmlClass }
  | { type: 'updateClass'; id: string; name: string; abstract: boolean }
  | { type: 'moveClass'; id: string; position: UmlClass['position'] }
  | { type: 'deleteClass'; id: string; confirmRelations: boolean }
  | { type: 'upsertAttribute'; classId: string; value: UmlAttribute }
  | { type: 'deleteAttribute'; classId: string; id: string }
  | { type: 'upsertRelation'; value: UmlRelation }
  | { type: 'deleteRelation'; id: string }

export function applyCommand(input: Diagram, command: ModelCommand): Diagram {
  const next = structuredClone(input)
  const getClass = (id: string) => {
    const c = next.classes.find((item) => item.id === id)
    if (!c) throw new ModelError('La clase ya no existe.')
    return c
  }
  switch (command.type) {
    case 'applyReviewedEdit':
      if (JSON.stringify(input) !== command.expectedSnapshot)
        throw new ModelError(
          'El diagrama cambió desde la vista previa. Genera una propuesta nueva.',
        )
      next.classes = structuredClone(command.classes)
      next.relations = structuredClone(command.relations)
      break
    case 'renameDiagram':
      next.name = command.name
      break
    case 'addClass':
      next.classes.push(command.value)
      break
    case 'updateClass':
      Object.assign(getClass(command.id), { name: command.name, abstract: command.abstract })
      break
    case 'moveClass':
      getClass(command.id).position = command.position
      break
    case 'deleteClass': {
      getClass(command.id)
      const related = next.relations.filter(
        (r) => r.sourceId === command.id || r.targetId === command.id,
      )
      if (related.length && !command.confirmRelations)
        throw new ModelError('Confirma la eliminación de la clase y sus relaciones.')
      next.classes = next.classes.filter((c) => c.id !== command.id)
      next.relations = next.relations.filter(
        (r) => r.sourceId !== command.id && r.targetId !== command.id,
      )
      break
    }
    case 'upsertAttribute': {
      const c = getClass(command.classId)
      const index = c.attributes.findIndex((a) => a.id === command.value.id)
      if (index < 0) c.attributes.push(command.value)
      else c.attributes[index] = command.value
      break
    }
    case 'deleteAttribute': {
      const c = getClass(command.classId)
      if (!c.attributes.some((a) => a.id === command.id))
        throw new ModelError('El atributo ya no existe.')
      c.attributes = c.attributes.filter((a) => a.id !== command.id)
      break
    }
    case 'upsertRelation': {
      const index = next.relations.findIndex((r) => r.id === command.value.id)
      if (index < 0) next.relations.push(command.value)
      else next.relations[index] = command.value
      break
    }
    case 'deleteRelation':
      if (!next.relations.some((r) => r.id === command.id))
        throw new ModelError('La relación ya no existe.')
      next.relations = next.relations.filter((r) => r.id !== command.id)
      break
  }
  next.localRevision += 1
  next.updatedAt = new Date().toISOString()
  return validateDiagram(next)
}

export function createDiagram(title = 'Mi primer diagrama'): Diagram {
  return validateDiagram({
    schemaVersion: 1,
    id: crypto.randomUUID(),
    name: title,
    localRevision: 0,
    updatedAt: new Date().toISOString(),
    classes: [],
    relations: [],
  })
}

export function createClass(diagram: Diagram): UmlClass {
  let n = diagram.classes.length + 1
  while (diagram.classes.some((c) => c.name.toLowerCase() === `clase${n}`)) n++
  return {
    id: crypto.randomUUID(),
    name: `Clase${n}`,
    abstract: false,
    attributes: [],
    position: {
      x: 100 + (diagram.classes.length % 3) * 330,
      y: 100 + Math.floor(diagram.classes.length / 3) * 270,
    },
  }
}
