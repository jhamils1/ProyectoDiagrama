import type { Diagram } from '../../modeling/domain/model'
import { type AiOperation } from './proposal'

const name = '([A-Za-zÁÉÍÓÚÜÑáéíóúüñ_][A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9_]{0,79})'
export function associationRequest(instruction: string): AiOperation | null {
  const text = instruction.trim().replace(/\s+/g, ' ').replace(/\.$/, '')
  const explicit = text.match(
    new RegExp(
      `^Asocia ${name} con ${name}, multiplicidad origen (1) y destino (0\\.\\.\\*|1\\.\\.\\*)$`,
      'i',
    ),
  )
  let source: string,
    target: string,
    targetMultiplicity = '0..*'
  if (explicit) {
    source = explicit[1]
    target = explicit[2]
    targetMultiplicity = explicit[4]
  } else {
    const natural = text.match(
      new RegExp(
        `^(?:(?:Crear|Crea) una asociaci[oó]n entre ${name} y ${name}, donde )?[Uu]n ${name} (?:puede tener|tiene) muchos ${name} y cada ${name} pertenece a un (?:solo )?${name}$`,
        'i',
      ),
    )
    if (!natural) {
      if (
        /^(?:asocia\b|crea(?:r)?\s+una\s+asociaci[oó]n\b|un\s+\S+\s+(?:puede tener|tiene)\b)/i.test(
          text,
        )
      )
        throw new Error(
          'Aclara las multiplicidades de ambos extremos. Por ejemplo: Un Cliente puede tener muchos Pedidos y cada Pedido pertenece a un solo Cliente. También puedes indicar origen 1 y destino 0..* o 1..*. No se aplicaron cambios.',
        )
      return null
    }
    source = natural[3]
    target = natural[5]
    if (
      natural[6] !== source ||
      (natural[4] !== `${target}s` && natural[4] !== `${target}es`) ||
      (natural[1] && (natural[1] !== source || natural[2] !== target))
    )
      throw new Error(
        'Los nombres de las clases no coinciden en la instrucción. Aclara los dos extremos usando sus nombres exactos; no se crearán clases automáticamente.',
      )
  }
  return {
    type: 'addRelation',
    source,
    target,
    kind: 'association',
    sourceMultiplicity: '1',
    targetMultiplicity,
  }
}

export function validateAssociationClasses(operation: AiOperation, diagram: Diagram) {
  if (operation.type !== 'addRelation' || operation.kind !== 'association') return
  for (const name of [operation.source, operation.target]) {
    if (!diagram.classes.some((c) => c.name === name))
      throw new Error(
        `La clase ${name} no existe. Primero debes crearla; la asociación no crea clases automáticamente.`,
      )
  }
}

export function associationMessages(instruction: string, diagram: Diagram) {
  return [
    {
      role: 'system',
      content: `Interpreta una instrucción de asociación UML entre clases existentes. Devuelve SOLO JSON con este contrato: {"status":"propose","operations":[{"type":"addRelation","source":"CLASE_ORIGEN","target":"CLASE_DESTINO","kind":"association","sourceMultiplicity":"1","targetMultiplicity":"0..*"}]}. Copia los nombres singulares exactos de las clases indicadas. No crees clases ni atributos. "Un A tiene/puede tener muchos Bs y cada B pertenece a un (solo) A" indica source=A, target=B, sourceMultiplicity=1, targetMultiplicity=0..*. Muchos permite cero o más según la convención de esta aplicación. Si se indican multiplicidades numéricas explícitas, cópialas exactamente. No asumas multiplicidades cuando falten. /no_think`,
    },
    {
      role: 'user',
      content: JSON.stringify({ classes: diagram.classes.map((c) => c.name), instruction }),
    },
  ]
}
