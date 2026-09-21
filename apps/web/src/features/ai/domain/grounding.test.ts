import { expect, it } from 'vitest'
import { validateGrounding } from './grounding'
import { parseProposal } from './proposal'
import { corpus } from './corpus'
import { holdout } from './holdout'
import { holdout6c } from './holdout6c'

it('conserva los esperados positivos de los tres corpus fijados antes de medir', () => {
  for (const item of [...corpus, ...holdout, ...holdout6c]) {
    const expected = item.expected
    if (expected !== 'no-proposal')
      expect(() =>
        validateGrounding(item.instruction, { status: 'propose', operations: expected }),
      ).not.toThrow()
  }
})

it.each([
  ['Crea Casa.', '{"type":"addClass","name":"Casas"}'],
  ['Crea CasaGrande.', '{"type":"addClass","name":"Casa"}'],
  [
    'Relaciona A con algo.',
    '{"type":"addRelation","source":"A","target":"B","kind":"association"}',
  ],
  ['Añade x a A.', '{"type":"addAttribute","className":"A","name":"x","dataType":"String"}'],
  [
    'Asocia A y B, origen 1 y destino 0..*.',
    '{"type":"addRelation","source":"A","target":"B","kind":"association","sourceMultiplicity":"1","targetMultiplicity":"*"}',
  ],
  ['Crea A de nuevo.', '{"type":"renameClass","name":"A","newName":"A"}'],
])('rechaza datos sin respaldo o cambios vacíos: %s', (instruction, operation) => {
  expect(() =>
    validateGrounding(
      instruction,
      parseProposal(`{"status":"propose","operations":[${operation}]}`),
    ),
  ).toThrow()
})

it('admite alias documentados y no pretende detectar todas las omisiones semánticas', () => {
  expect(() =>
    validateGrounding(
      'Añade x de tipo cadena a A.',
      parseProposal(
        '{"status":"propose","operations":[{"type":"addAttribute","className":"A","name":"x","dataType":"String"}]}',
      ),
    ),
  ).not.toThrow()
  expect(() =>
    validateGrounding(
      'Crea A y B.',
      parseProposal('{"status":"propose","operations":[{"type":"addClass","name":"A"}]}'),
    ),
  ).not.toThrow()
})

it.each(['Consulta necesita inicio de tipo DateTime.', 'Añade x de tipo String a A.'])(
  'rechaza obligatoriedad inventada: %s',
  (instruction) => {
    const isConsult = instruction.startsWith('Consulta')
    const proposal = parseProposal(
      JSON.stringify({
        status: 'propose',
        operations: [
          {
            type: 'addAttribute',
            className: isConsult ? 'Consulta' : 'A',
            name: isConsult ? 'inicio' : 'x',
            dataType: isConsult ? 'DateTime' : 'String',
            required: true,
          },
        ],
      }),
    )
    expect(() => validateGrounding(instruction, proposal)).toThrow('No se solicitó obligatoriedad')
  },
)

it('la mención léxica no certifica el alcance ni la negación: requiere revisión semántica', () => {
  const proposal = parseProposal(
    '{"status":"propose","operations":[{"type":"addAttribute","className":"A","name":"x","dataType":"String","required":true}]}',
  )
  // Límite deliberado: no se presenta esta comprobación como comprensión del texto.
  expect(() =>
    validateGrounding('Añade x de tipo String a A, no obligatorio.', proposal),
  ).not.toThrow()
  expect(() =>
    validateGrounding(
      'Añade x de tipo String a A y otro atributo obligatorio y de tipo Long.',
      proposal,
    ),
  ).not.toThrow()
})
