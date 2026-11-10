import { z } from 'zod'
import { canonicalDataType } from './dataTypeAliases'
import { validateDiagram, type Diagram, type ModelCommand, type UmlAttribute, type UmlRelation } from '../../modeling/domain/model'

// A vision model's output is untrusted: accept only this small, explicit format.
const imageModel = z.object({
  classes: z.array(z.object({
    name: z.string().min(1).max(80),
    attributes: z.array(z.object({ name: z.string().min(1).max(80), type: z.string().max(80) })).max(100),
  })).min(1).max(50),
  relations: z.array(z.object({
    source: z.string().min(1).max(80), target: z.string().min(1).max(80),
    type: z.enum(['association', 'generalization']),
    sourceMultiplicity: z.string().max(80), targetMultiplicity: z.string().max(80),
  })).max(100),
})
export type ImageModel = z.infer<typeof imageModel>

export function parseImageModel(raw: string): ImageModel {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try { return imageModel.parse(JSON.parse(cleaned)) }
  catch { throw new Error('No se pudo interpretar el diagrama. Prueba con una imagen más clara o completa el diagrama manualmente.') }
}

export function imageModelCommand(base: Diagram, model: ImageModel): ModelCommand {
  const ids = new Map<string, string>()
  const classes = model.classes.map((item, index) => {
    const id = crypto.randomUUID()
    const key = item.name.trim().toLowerCase()
    if (ids.has(key)) throw new Error(`La clase ${item.name} aparece más de una vez.`)
    ids.set(key, id)
    return {
      id, name: item.name, abstract: false,
      position: { x: 100 + (index % 3) * 330, y: 100 + Math.floor(index / 3) * 270 },
      attributes: item.attributes.map((a): UmlAttribute => ({
        id: crypto.randomUUID(), name: a.name,
        dataType: canonicalDataType(a.type) as UmlAttribute['dataType'],
        visibility: 'private', identifier: false, required: false,
      })), methods: [],
    }
  })
  const relations: UmlRelation[] = model.relations.map((r) => {
    const sourceId = ids.get(r.source.trim().toLowerCase()), targetId = ids.get(r.target.trim().toLowerCase())
    if (!sourceId || !targetId) throw new Error('Una relación menciona una clase que no fue reconocida.')
    if (r.type === 'association' && (!r.sourceMultiplicity || !r.targetMultiplicity))
      throw new Error('Una asociación no tiene multiplicidades claras. Completa esa relación manualmente.')
    return { id: crypto.randomUUID(), type: r.type, name: '', sourceId, targetId,
      sourceMultiplicity: r.type === 'generalization' ? '1' : r.sourceMultiplicity,
      targetMultiplicity: r.type === 'generalization' ? '1' : r.targetMultiplicity }
  })
  const combined = validateDiagram({ ...base, classes: [...base.classes, ...classes], relations: [...base.relations, ...relations] })
  return { type: 'applyReviewedEdit', expectedSnapshot: JSON.stringify(base), classes: combined.classes, relations: combined.relations }
}
