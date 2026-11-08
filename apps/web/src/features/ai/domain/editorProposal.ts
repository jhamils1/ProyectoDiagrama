import type { Diagram, ModelCommand } from '../../modeling/domain/model'
import { operationSchema, type AiOperation, type AiProposal } from './proposal'
import { validateProposal } from './validation'
import { associationRequest, validateAssociationClasses } from './association'
import { canonicalDataType } from './dataTypeAliases'

export const editorExamples = [
  'Crea la clase Carga.',
  'Crea la clase vehiculo con atributo marca.',
  'Agrega capacidad de tipo Long a Lancha.',
  'Agrega modelo a Lancha.',
  'Agrega el atributo modelo en la clase Lancha.',
  'Agrega licencia de tipo String obligatoria a Capitan.',
  'Crea Faro y agrega altura de tipo Decimal a Faro.',
  'Lancha hereda de Embarcacion.',
  'La clase automóvil hereda de vehiculo.',
  'Renombra Lancha a Velero.',
  'Crear una asociación entre Cliente y Pedido, donde un Cliente puede tener muchos Pedidos y cada Pedido pertenece a un solo Cliente.',
]
const identifier = '([A-Za-zÁÉÍÓÚÜÑáéíóúüñ_][A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9_]{0,79})'
const pattern = (value: string) => new RegExp(`^${value}\\.?$`, 'i')

/** Lenguaje acotado visible al usuario; solo valida intención, nunca aplica por sí solo. */
export function requestedEditorOperations(instruction: string, diagram?: Diagram): AiOperation[] {
  const association = associationRequest(instruction)
  if (association) {
    if (diagram) validateAssociationClasses(association, diagram)
    return [association]
  }
  const text = instruction.trim().replace(/\s+/g, ' ')
  let match = text.match(pattern(`Crea (?:la )?clase ${identifier}`))
  if (match) return [operationSchema.parse({ type: 'addClass', name: match[1] })]
  match = text.match(
    pattern(`Crea (?:la )?clase ${identifier} con (?:el )?atributo ${identifier}`),
  )
  if (match)
    return [
      operationSchema.parse({ type: 'addClass', name: match[1] }),
      operationSchema.parse({
        type: 'addAttribute',
        className: match[1],
        name: match[2],
        dataType: '',
      }),
    ]
  match = text.match(pattern(`Renombra ${identifier} a ${identifier}`))
  if (match)
    return [operationSchema.parse({ type: 'renameClass', name: match[1], newName: match[2] })]
  match = text.match(
    pattern(
      `Agrega (?:el atributo )?${identifier}(?: de tipo ${identifier}| sin tipo)?( obligatori[oa])? (?:a (?:la clase )?|en la clase )${identifier}`,
    ),
  )
  if (match)
    return [
      operationSchema.parse({
        type: 'addAttribute',
        name: match[1],
        dataType: canonicalDataType(match[2] ?? ''),
        required: !!match[3],
        className: match[4],
      }),
    ]
  match = text.match(
    pattern(
      `Crea ${identifier} y agrega ${identifier}(?: de tipo ${identifier}| sin tipo)? a ${identifier}`,
    ),
  )
  if (match && match[1] === match[4])
    return [
      operationSchema.parse({ type: 'addClass', name: match[1] }),
      operationSchema.parse({
        type: 'addAttribute',
        name: match[2],
        dataType: canonicalDataType(match[3] ?? ''),
        className: match[4],
      }),
    ]
  match = text.match(pattern(`(?:La clase )?${identifier} hereda de (?:la clase )?${identifier}`))
  if (match)
    return [
      operationSchema.parse({
        type: 'addRelation',
        source: match[1],
        target: match[2],
        kind: 'generalization',
        sourceMultiplicity: '1',
        targetMultiplicity: '1',
      }),
    ]
  throw new Error(
    'Instrucción no disponible. Usa una de las formas de los ejemplos, cambiando nombres y tipos. Métodos, composición, agregación, borrado y otras modificaciones todavía no están disponibles por IA.',
  )
}

export function reviewedEditorCommand(
  instruction: string,
  base: Diagram,
  proposal: AiProposal,
): ModelCommand {
  const requested = requestedEditorOperations(instruction, base)
  if (proposal.status !== 'propose')
    throw new Error('La IA no produjo una propuesta. Revisa la instrucción o inténtalo de nuevo.')
  const canonical = (operations: AiOperation[]) =>
    JSON.stringify(operations.map((op) => operationSchema.parse(op)))
  if (canonical(requested) !== canonical(proposal.operations))
    throw new Error(
      'La propuesta no coincide con los cambios solicitados. No se aplicó nada; puedes intentar nuevamente.' +
        (requested[0]?.type === 'addRelation' && requested[0].kind === 'association'
          ? ` La solicitud indica exactamente una asociación: source=${requested[0].source}, target=${requested[0].target}, kind=association, sourceMultiplicity=${requested[0].sourceMultiplicity}, targetMultiplicity=${requested[0].targetMultiplicity}. Copia esos nombres singulares exactos y no agregues operaciones.`
          : ''),
    )
  const preview = validateProposal(instruction, base, proposal)
  return {
    type: 'applyReviewedEdit',
    expectedSnapshot: JSON.stringify(base),
    classes: preview.classes,
    relations: preview.relations,
  }
}

export function describeOperation(op: AiOperation): string {
  switch (op.type) {
    case 'addClass':
      return `Crear clase ${op.name}${op.abstract ? ' abstracta' : ''}.`
    case 'renameClass':
      return `Renombrar ${op.name} a ${op.newName}.`
    case 'addAttribute':
      return `Agregar ${op.className}.${op.name}: ${op.dataType || 'sin tipo'}, ${op.required ? 'obligatorio' : 'opcional'}, privado.`
    case 'addRelation':
      return op.kind === 'association'
        ? `Asociación UML: ${op.source} ${op.sourceMultiplicity} — ${op.targetMultiplicity} ${op.target}. Se relacionan clases existentes.`
        : `${op.source} hereda de ${op.target}.`
    case 'deleteClass':
      return `Eliminar ${op.name}.`
  }
}
