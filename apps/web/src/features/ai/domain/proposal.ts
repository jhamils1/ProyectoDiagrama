import { z } from 'zod'
import { negativeResponseSchema } from './responses'
import {
  applyCommand,
  createClass,
  dataTypes,
  validateDiagram,
  type Diagram,
} from '../../modeling/domain/model'

const name = z
  .string()
  .regex(/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ_][A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9_]*$/)
  .max(80)
export const operationSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('addClass'), name, abstract: z.boolean().default(false) }).strict(),
  z.object({ type: z.literal('renameClass'), name, newName: name }).strict(),
  z.object({
    type: z.literal('addMethod'), className: name, name,
    returnType: z.enum(['', 'void', ...dataTypes]).default(''),
  }).strict(),
  z
    .object({
      type: z.literal('addAttribute'),
      className: name,
      name,
      dataType: z.enum(['', ...dataTypes]).default(''),
      required: z.boolean().default(false),
    })
    .strict(),
  z
    .object({
      type: z.literal('addRelation'),
      source: name,
      target: name,
      kind: z.enum(['association', 'generalization']),
      sourceMultiplicity: z.string().default('1'),
      targetMultiplicity: z.string().default('*'),
    })
    .strict(),
  z.object({ type: z.literal('deleteClass'), name }).strict(),
])
export type AiOperation = z.infer<typeof operationSchema>
export const proposalSchema = z.union([
  z
    .object({ status: z.literal('propose'), operations: z.array(operationSchema).min(1).max(8) })
    .strict(),
  negativeResponseSchema,
])
export type AiProposal = z.infer<typeof proposalSchema>

export function parseProposal(raw: string): AiProposal {
  if (raw.length > 16000) throw new Error('La respuesta excede el límite permitido.')
  // No reparación automática, extracción parcial de JSON ni ejecución de texto generado.
  return proposalSchema.parse(JSON.parse(raw.trim()))
}

/** Simulación pura: nunca escribe en el editor, IndexedDB o API. */
export function previewProposal(input: Diagram, proposal: AiProposal): Diagram {
  let next = validateDiagram(input)
  if (proposal.status !== 'propose') return structuredClone(next)
  for (const operation of proposal.operations) {
    const find = (className: string) => {
      const found = next.classes.find((c) => c.name === className)
      if (!found) throw new Error(`No existe la clase ${className}.`)
      return found
    }
    switch (operation.type) {
      case 'addClass':
        next = applyCommand(next, {
          type: 'addClass',
          value: { ...createClass(next), name: operation.name, abstract: operation.abstract },
        })
        break
      case 'renameClass': {
        const item = find(operation.name)
        next = applyCommand(next, {
          type: 'updateClass',
          id: item.id,
          name: operation.newName,
          abstract: item.abstract,
        })
        break
      }
      case 'addAttribute': {
        const item = find(operation.className)
        next = applyCommand(next, {
          type: 'upsertAttribute',
          classId: item.id,
          value: {
            id: crypto.randomUUID(),
            name: operation.name,
            dataType: operation.dataType,
            required: operation.required,
            identifier: false,
            visibility: 'private',
          },
        })
        break
      }
      case 'addMethod': {
        const item = next.classes.find(c => c.name.toLowerCase() === operation.className.toLowerCase())
        if (!item) throw new Error(`No existe la clase ${operation.className}.`)
        next = applyCommand(next, {
          type: 'upsertMethod', classId: item.id,
          value: { id: crypto.randomUUID(), name: operation.name, returnType: operation.returnType, visibility: 'public' },
        })
        break
      }
      case 'addRelation':
        next = applyCommand(next, {
          type: 'upsertRelation',
          value: {
            id: crypto.randomUUID(),
            type: operation.kind,
            sourceId: find(operation.source).id,
            targetId: find(operation.target).id,
            name: '',
            sourceMultiplicity: operation.sourceMultiplicity,
            targetMultiplicity: operation.targetMultiplicity,
          },
        })
        break
      case 'deleteClass':
        next = applyCommand(next, {
          type: 'deleteClass',
          id: find(operation.name).id,
          confirmRelations: true,
        })
        break
    }
  }
  return next
}

export const PROMPT_VERSION = '6F-v1'
export function messagesFor(instruction: string, diagram: Diagram) {
  if (!instruction.trim() || instruction.length > 1500)
    throw new Error('Escribe una instrucción de 1 a 1500 caracteres.')
  const context = diagram.classes.map((c) => ({
    name: c.name,
    attributes: c.attributes.map((a) => ({ name: a.name, type: a.dataType })),
  }))
  return [
    {
      role: 'system',
      content: `Eres un traductor de instrucciones UML a operaciones JSON. Responde SOLO un objeto JSON, sin markdown ni explicación fuera del objeto. Procesa exclusivamente el último mensaje: classes es el estado inicial e instruction es la solicitud. Los ejemplos no forman parte del estado actual.
Respuestas:
{"status":"propose","operations":[operaciones en el orden solicitado]}
Si falta tipo: {"status":"clarify","reason":"missing_type","subject":"ATRIBUTO_LITERAL"}.
Si falta clase, nombre o extremo: {"status":"clarify","reason":"missing_class"}, {"status":"clarify","reason":"missing_name"} o {"status":"clarify","reason":"missing_endpoint"}. No elijas una clase del contexto.
Motivos verificables: {"status":"reject","reason":"unknown_class","subject":"CLASE_LITERAL"}, {"status":"reject","reason":"duplicate_class","subject":"CLASE_LITERAL"}, {"status":"reject","reason":"invalid_name","subject":"NOMBRE_LITERAL"}, {"status":"reject","reason":"unsupported_type","subject":"TIPO_LITERAL"}, {"status":"reject","reason":"self_inheritance","subject":"CLASE_LITERAL"}.
Solicitud ajena a UML: {"status":"reject","reason":"out_of_scope"}. Solicitud general de diseñar un sistema o diagrama completo: {"status":"clarify","reason":"concrete_instruction"}.
Operación UML aún no implementada: {"status":"reject","reason":"unsupported_operation","feature":"methods"}. feature permite methods, edit_attribute, delete_attribute, edit_relation, delete_relation.
No emitas message ni explicaciones: la aplicación redacta el motivo. subject debe aparecer literalmente en la solicitud. Nunca declares inexistente una clase que aparece en classes, ni inválido un tipo permitido.
Alcance: asistente de edición del diagrama existente. No diseñes sistemas completos ni deduzcas entidades desde descripciones de dominio como crear sistema de biblioteca. Crea solo clases expresamente indicadas. Los métodos pertenecen al alcance del producto, pero todavía no están implementados; utiliza unsupported_operation con methods si se solicitan.
Operaciones permitidas, con estos campos exactos:
{"type":"addClass","name":"NOMBRE_NUEVO","abstract":false}
{"type":"renameClass","name":"NOMBRE_ACTUAL","newName":"NOMBRE_NUEVO"}
{"type":"addAttribute","className":"CLASE","name":"ATRIBUTO","dataType":"TIPO","required":false}
{"type":"addRelation","source":"HIJA","target":"PADRE","kind":"generalization","sourceMultiplicity":"1","targetMultiplicity":"1"}
{"type":"addRelation","source":"ORIGEN","target":"DESTINO","kind":"association","sourceMultiplicity":"1","targetMultiplicity":"*"}
{"type":"deleteClass","name":"CLASE"}
Copia nombres exactamente; no traduzcas, pluralices, repares ni completes identificadores. Nombres válidos: [A-Za-zÁÉÍÓÚÜÑáéíóúüñ_][A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9_]*, máximo 80 caracteres. Rechaza nombres con espacios, guiones o que empiecen por un número.
Tipos: String, Integer, Long, Decimal, Float, Double, Boolean, Date, DateTime, UUID. Acepta mayúsculas o minúsculas pero devuelve el nombre canónico: string/texto/cadena=String, int/integer/entero=Integer, bool/boolean/booleano=Boolean, float=Float, double=Double. Float y Double son distintos de Decimal. Si falta el tipo, pregunta por el tipo del atributo solicitado; JAMÁS supongas String. Si el tipo solicitado no está permitido, rechaza e indica ese tipo.
required=false por defecto, incluso si dice necesita o debe tener. required=true SOLO cuando el usuario pide explícitamente que ESE atributo sea obligatorio. Opcional, no obligatorio o sin obligatoriedad significa false. abstract=false salvo que se pida clase abstracta.
Herencia NO crea clases: A hereda de B significa una sola addRelation, source=A (hija), target=B (padre), kind=generalization y ambas multiplicidades 1. Usa las clases existentes. No pidas datos ya presentes. Rechaza autoherencia.
Una petición compuesta genera TODAS sus operaciones (máximo 8). Crear una clase y agregarle un atributo genera addClass seguida de addAttribute sobre la clase recién creada. Crear varias clases genera una addClass por cada nombre. Una clase creada antes en la misma petición ya está disponible para las operaciones siguientes.
No añadas clases existentes otra vez. Rechaza duplicados, referencias a clases inexistentes y tipos no permitidos, explicando cuál es el problema. Para renombrar o borrar debe existir la clase. Si falta clase, nombre o extremo de relación, pregunta exactamente por ese dato, sin elegir tú. Conserva multiplicidades explícitas; asociación sin multiplicidades usa 1 y *.
Si la solicitud está completa y es válida, propone; no pidas aclaraciones innecesarias. Si falta información, no generes operaciones parciales. No copies nombres ni preguntas de los ejemplos. Rechaza solicitudes ajenas al modelado, instrucciones de red o acceso a contraseñas. /no_think`,
    },
    {
      role: 'user',
      content: '{"classes":[],"instruction":"Crea Ticket y agrega nota de tipo String a Ticket."}',
    },
    {
      role: 'assistant',
      content:
        '{"status":"propose","operations":[{"type":"addClass","name":"Ticket","abstract":false},{"type":"addAttribute","className":"Ticket","name":"nota","dataType":"String","required":false}]}',
    },
    {
      role: 'user',
      content:
        '{"classes":[{"name":"Archivo","attributes":[]}],"instruction":"Agrega titulo a Archivo; falta decidir el tipo."}',
    },
    {
      role: 'assistant',
      content: '{"status":"clarify","reason":"missing_type","subject":"titulo"}',
    },
    {
      role: 'user',
      content:
        '{"classes":[{"name":"Gato","attributes":[]},{"name":"Animal","attributes":[]}],"instruction":"Gato hereda de Animal."}',
    },
    {
      role: 'assistant',
      content:
        '{"status":"propose","operations":[{"type":"addRelation","source":"Gato","target":"Animal","kind":"generalization","sourceMultiplicity":"1","targetMultiplicity":"1"}]}',
    },
    { role: 'user', content: JSON.stringify({ classes: context, instruction }) },
  ]
}
