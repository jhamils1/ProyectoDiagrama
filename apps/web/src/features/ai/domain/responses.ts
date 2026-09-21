import { z } from 'zod'
import { dataTypes, type Diagram } from '../../modeling/domain/model'
import { typeAliases } from './dataTypeAliases'

const subject = z.string().min(1).max(120)
export const negativeResponseSchema = z.discriminatedUnion('reason', [
  z.object({ status: z.literal('clarify'), reason: z.literal('missing_type'), subject }).strict(),
  z
    .object({
      status: z.literal('clarify'),
      reason: z.enum(['missing_class', 'missing_name', 'missing_endpoint', 'concrete_instruction']),
    })
    .strict(),
  z
    .object({
      status: z.literal('reject'),
      reason: z.enum(['unknown_class', 'duplicate_class', 'invalid_name', 'unsupported_type']),
      subject,
    })
    .strict(),
  z
    .object({ status: z.literal('reject'), reason: z.literal('self_inheritance'), subject })
    .strict(),
  z.object({ status: z.literal('reject'), reason: z.literal('out_of_scope') }).strict(),
  z
    .object({
      status: z.literal('reject'),
      reason: z.literal('unsupported_operation'),
      feature: z.enum([
        'methods',
        'edit_attribute',
        'delete_attribute',
        'edit_relation',
        'delete_relation',
      ]),
    })
    .strict(),
])
export type NegativeResponse = z.infer<typeof negativeResponseSchema>

function mentioned(instruction: string, value: string) {
  let index = instruction.indexOf(value)
  while (index >= 0) {
    const before = instruction.slice(0, index)
    const after = instruction.slice(index + value.length)
    if (!/[\p{L}\p{N}_]$/u.test(before) && !/^[\p{L}\p{N}_]/u.test(after)) return true
    index = instruction.indexOf(value, index + 1)
  }
  return false
}

export function validateResponse(
  instruction: string,
  diagram: Diagram,
  response: NegativeResponse,
) {
  if ('subject' in response && !mentioned(instruction, response.subject))
    throw new Error('El motivo cita un nombre o dato que no aparece exactamente en la solicitud.')
  const exists =
    'subject' in response &&
    diagram.classes.some((c) => c.name.toLowerCase() === response.subject.toLowerCase())
  switch (response.reason) {
    case 'unknown_class':
      if (exists)
        throw new Error('La clase citada sí existe en el contexto. Revisa tu interpretación.')
      break
    case 'duplicate_class':
      if (!exists) throw new Error('La clase citada no está duplicada en el contexto.')
      break
    case 'invalid_name':
      if (/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ_][A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9_]*$/.test(response.subject) && response.subject.length <= 80)
        throw new Error('El nombre citado sí cumple el formato permitido.')
      break
    case 'unsupported_type':
      if (
        Object.values(typeAliases).flat().some(
          (t) => t.toLowerCase() === response.subject.toLowerCase(),
        )
      )
        throw new Error('El tipo citado sí está permitido; no rechaces por ese motivo.')
      break
    case 'self_inheritance':
      if (!exists) throw new Error('La clase citada no existe para comprobar una autoherencia.')
      break
  }
}

export function responseMessage(response: NegativeResponse): string {
  switch (response.reason) {
    case 'missing_type':
      return `¿Qué tipo debe tener el atributo ${response.subject}?`
    case 'missing_class':
      return '¿Qué clase del diagrama quieres modificar?'
    case 'missing_name':
      return '¿Qué nombre quieres utilizar?'
    case 'missing_endpoint':
      return '¿Cuáles son las dos clases que quieres relacionar?'
    case 'concrete_instruction':
      return 'Indica las clases, atributos, métodos o relaciones y los cambios concretos que quieres realizar en este diagrama. No genero sistemas completos desde una descripción del dominio.'
    case 'unknown_class':
      return `La clase ${response.subject} no existe en el diagrama actual.`
    case 'duplicate_class':
      return `Ya existe una clase llamada ${response.subject}.`
    case 'invalid_name':
      return `El nombre ${response.subject} no es válido: usa hasta 80 letras sin acentos, números o guion bajo, comenzando con letra o guion bajo.`
    case 'unsupported_type':
      return `El tipo ${response.subject} no está admitido. Tipos disponibles: ${dataTypes.join(', ')}.`
    case 'self_inheritance':
      return `La clase ${response.subject} no puede heredar de sí misma.`
    case 'out_of_scope':
      return 'Esta solicitud no corresponde a una edición concreta del modelo UML.'
    case 'unsupported_operation': {
      const labels = {
        methods: 'La edición de métodos',
        edit_attribute: 'La modificación de atributos mediante IA',
        delete_attribute: 'La eliminación de atributos mediante IA',
        edit_relation: 'La modificación de relaciones mediante IA',
        delete_relation: 'La eliminación de relaciones mediante IA',
      }
      return `${labels[response.feature]} todavía no está implementada en este asistente.`
    }
  }
}

/** Protección de formulaciones explícitas, no un parser general de intención. */
export function requiresConcreteInstruction(instruction: string) {
  const normalized = instruction.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  return (
    /\b(?:crea(?:r)?|genera(?:r)?|disena(?:r)?|construye|construir|quiero)\s+(?:(?:un|una|el|la)\s+)?(?:sistema|aplicacion|plataforma)\b/.test(
      normalized,
    ) ||
    /\b(?:crea(?:r)?|genera(?:r)?|disena(?:r)?)\s+(?:(?:un|el)\s+)?(?:diagrama|modelo)\s+completo\b/.test(
      normalized,
    )
  )
}
