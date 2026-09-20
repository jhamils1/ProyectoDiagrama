import { validateDiagram, type Diagram } from './model'

export function copyLocalDiagram(original: Diagram): Diagram {
  const copy = structuredClone(validateDiagram(original))
  const ids = new Map(copy.classes.map((c) => [c.id, crypto.randomUUID()]))
  copy.id = crypto.randomUUID()
  copy.localRevision = 0
  copy.updatedAt = new Date().toISOString()
  for (const c of copy.classes) {
    c.id = ids.get(c.id)!
    for (const a of c.attributes) a.id = crypto.randomUUID()
  }
  for (const r of copy.relations) {
    r.id = crypto.randomUUID()
    r.sourceId = ids.get(r.sourceId)!
    r.targetId = ids.get(r.targetId)!
  }
  return validateDiagram(copy)
}
