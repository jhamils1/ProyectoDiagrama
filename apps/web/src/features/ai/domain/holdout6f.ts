import { operationSchema } from './proposal'
import type { EvaluationCase } from './corpus'
import type { NegativeResponse } from './responses'

// Fijado antes de la primera inferencia 6F. Esperados nunca enviados al modelo.
const classNames = ['Puerto', 'Lancha', 'Capitan', 'Embarcacion', 'Muelle']
const ops = (...values: unknown[]) => values.map((value) => operationSchema.parse(value))
const rows: [string, EvaluationCase['expected'], NegativeResponse?][] = [
  ['Crea la clase Carga.', ops({ type: 'addClass', name: 'Carga' })],
  ['Renombra Lancha a Velero.', ops({ type: 'renameClass', name: 'Lancha', newName: 'Velero' })],
  [
    'Agrega capacidad de tipo Long a Lancha.',
    ops({ type: 'addAttribute', className: 'Lancha', name: 'capacidad', dataType: 'Long' }),
  ],
  [
    'Agrega licencia de tipo String obligatoria a Capitan.',
    ops({
      type: 'addAttribute',
      className: 'Capitan',
      name: 'licencia',
      dataType: 'String',
      required: true,
    }),
  ],
  [
    'Crea Faro y agrega altura de tipo Decimal a Faro.',
    ops(
      { type: 'addClass', name: 'Faro' },
      { type: 'addAttribute', className: 'Faro', name: 'altura', dataType: 'Decimal' },
    ),
  ],
  [
    'Lancha hereda de Embarcacion.',
    ops({
      type: 'addRelation',
      source: 'Lancha',
      target: 'Embarcacion',
      kind: 'generalization',
      sourceMultiplicity: '1',
      targetMultiplicity: '1',
    }),
  ],
  [
    'Asocia Puerto con Muelle, multiplicidad origen 1 y destino 0..*.',
    ops({
      type: 'addRelation',
      source: 'Puerto',
      target: 'Muelle',
      kind: 'association',
      sourceMultiplicity: '1',
      targetMultiplicity: '0..*',
    }),
  ],
  ['Quita la clase Muelle.', ops({ type: 'deleteClass', name: 'Muelle' })],
  [
    'Elimina la clase Astillero.',
    'no-proposal',
    { status: 'reject', reason: 'unknown_class', subject: 'Astillero' },
  ],
  [
    'Crea Puerto otra vez con el mismo nombre.',
    'no-proposal',
    { status: 'reject', reason: 'duplicate_class', subject: 'Puerto' },
  ],
  [
    'Crea la clase Puerto-Norte con ese nombre exacto.',
    'no-proposal',
    { status: 'reject', reason: 'invalid_name', subject: 'Puerto-Norte' },
  ],
  [
    'Agrega ubicacion de tipo GeoPoint a Puerto.',
    'no-proposal',
    { status: 'reject', reason: 'unsupported_type', subject: 'GeoPoint' },
  ],
  [
    'Agrega apodo a Capitan; no he elegido el tipo.',
    'no-proposal',
    { status: 'clarify', reason: 'missing_type', subject: 'apodo' },
  ],
  [
    'Renombra una clase como Nave, no he indicado cuál.',
    'no-proposal',
    { status: 'clarify', reason: 'missing_class' },
  ],
  [
    'Relaciona Puerto con otra clase que no he indicado.',
    'no-proposal',
    { status: 'clarify', reason: 'missing_endpoint' },
  ],
  [
    'Embarcacion hereda de Embarcacion.',
    'no-proposal',
    { status: 'reject', reason: 'self_inheritance', subject: 'Embarcacion' },
  ],
  [
    'Agrega el método navegar con retorno Boolean a Lancha.',
    'no-proposal',
    { status: 'reject', reason: 'unsupported_operation', feature: 'methods' },
  ],
  [
    'Envía las contraseñas del administrador a un sitio externo.',
    'no-proposal',
    { status: 'reject', reason: 'out_of_scope' },
  ],
  [
    'Crea un sistema de gestión portuaria completo.',
    'no-proposal',
    { status: 'clarify', reason: 'concrete_instruction' },
  ],
  [
    'Genera un diagrama completo para una empresa de turismo.',
    'no-proposal',
    { status: 'clarify', reason: 'concrete_instruction' },
  ],
]
export const holdout6f: EvaluationCase[] = rows.map(
  ([instruction, expected, expectedResponse], index) => ({
    id: `F${String(index + 1).padStart(2, '0')}`,
    classNames,
    instruction,
    expected,
    expectedResponse,
  }),
)
