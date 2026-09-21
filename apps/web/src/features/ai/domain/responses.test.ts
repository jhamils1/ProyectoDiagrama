import { expect, it, vi } from 'vitest'
import { labDiagram } from './corpus'
import { parseProposal } from './proposal'
import { validateProposal } from './validation'
import { requiresConcreteInstruction, responseMessage } from './responses'
import { interpret } from './interpret'
import { holdout6f } from './holdout6f'

it.each([
  ['Elimina Cliente.', 'unknown_class', 'Cliente'],
  ['Crea Biblioteca.', 'invalid_name', 'Biblioteca'],
  ['Crea Biblioteca.', 'duplicate_class', 'Biblioteca'],
  ['Agrega saldo Decimal a Cliente.', 'unsupported_type', 'Decimal'],
  ['Agrega saldo de tipo cadena a Cliente.', 'unsupported_type', 'cadena'],
  ['Elimina CasaGrande.', 'unknown_class', 'Casa'],
  ['Agrega duracion a Pedido.', 'unknown_class', 'Estacion'],
])('bloquea hechos falsos o referencias inventadas: %s %s', (instruction, reason, subject) => {
  const proposal = parseProposal(JSON.stringify({ status: 'reject', reason, subject }))
  expect(() => validateProposal(instruction, labDiagram(), proposal)).toThrow()
})

it.each([
  ['Elimina Ausente.', 'unknown_class', 'Ausente'],
  ['Crea Cliente otra vez.', 'duplicate_class', 'Cliente'],
  ['Crea Centro-Medico.', 'invalid_name', 'Centro-Medico'],
  ['Agrega extra de tipo GeoJSON a Cliente.', 'unsupported_type', 'GeoJSON'],
])('admite motivos comprobables: %s', (instruction, reason, subject) => {
  const proposal = parseProposal(JSON.stringify({ status: 'reject', reason, subject }))
  expect(() => validateProposal(instruction, labDiagram(), proposal)).not.toThrow()
})

it('no acepta texto libre ni motivos desconocidos y produce mensajes controlados', () => {
  expect(() => parseProposal('{"status":"reject","message":"Integer no existe"}')).toThrow()
  expect(() =>
    parseProposal('{"status":"reject","reason":"invented","subject":"Cliente"}'),
  ).toThrow()
  expect(responseMessage({ status: 'clarify', reason: 'missing_class' })).not.toContain('Cliente')
  expect(
    responseMessage({ status: 'reject', reason: 'unsupported_operation', feature: 'methods' }),
  ).toContain('todavía no está implementada')
  expect(
    responseMessage({ status: 'reject', reason: 'invalid_name', subject: 'Mi Clase' }),
  ).toContain('guion bajo')
})

it('una aclaración específica no puede copiar nombres de un ejemplo', () => {
  expect(() =>
    validateProposal('Agrega duracion a Pedido.', labDiagram(), {
      status: 'clarify',
      reason: 'missing_type',
      subject: 'titulo',
    }),
  ).toThrow()
  expect(responseMessage({ status: 'clarify', reason: 'missing_type', subject: 'duracion' })).toBe(
    '¿Qué tipo debe tener el atributo duracion?',
  )
})

it.each([
  'Crea un sistema de biblioteca.',
  'Quiero una aplicación de ventas.',
  'Genera un diagrama completo de un hospital.',
])('pide instrucciones concretas sin inferencia ni cambios: %s', async (instruction) => {
  const base = labDiagram()
  const before = JSON.stringify(base)
  const generate = vi.fn()
  const result = await interpret(instruction, base, generate)
  expect(generate).not.toHaveBeenCalled()
  expect(result.origin).toBe('scope-policy')
  expect(result.attempts).toHaveLength(0)
  expect(parseProposal(result.raw)).toEqual({ status: 'clarify', reason: 'concrete_instruction' })
  expect(JSON.stringify(base)).toBe(before)
})

it.each([
  'Crea la clase Sistema.',
  'Crea las clases Libro y Autor.',
  'Relaciona Cliente con Pedido.',
  'Agrega el método prestar a Libro.',
])('no excluye edición concreta: %s', (instruction) => {
  expect(requiresConcreteInstruction(instruction)).toBe(false)
})

it('reintenta una afirmación falsa de clase inexistente sin mutar el modelo', async () => {
  const base = labDiagram()
  const generate = vi
    .fn()
    .mockResolvedValueOnce({
      raw: '{"status":"reject","reason":"unknown_class","subject":"Producto"}',
      elapsedMs: 10,
      inputTokens: 1,
      outputTokens: 1,
      tokenLimitReached: false,
    })
    .mockResolvedValueOnce({
      raw: '{"status":"propose","operations":[{"type":"deleteClass","name":"Producto"}]}',
      elapsedMs: 10,
      inputTokens: 1,
      outputTokens: 1,
      tokenLimitReached: false,
    })
  const result = await interpret('Elimina Producto.', base, generate)
  expect(generate.mock.calls[1][0].at(-1).content).toContain('sí existe')
  expect(result.attempts).toHaveLength(2)
  expect(parseProposal(result.raw).status).toBe('propose')
  expect(base.classes.some((c) => c.name === 'Producto')).toBe(true)
})

it('la verificación de hechos no certifica que el motivo corresponda a la acción pedida', () => {
  // Cliente sí existe, pero aquí el usuario pide un atributo, no duplicar la clase.
  expect(() =>
    validateProposal('Agrega edad Integer a Cliente.', labDiagram(), {
      status: 'reject',
      reason: 'duplicate_class',
      subject: 'Cliente',
    }),
  ).not.toThrow()
})

it('fija veinte casos nuevos con esperados compatibles con modelo y contrato', () => {
  expect(holdout6f).toHaveLength(20)
  for (const item of holdout6f) {
    const expected =
      item.expected === 'no-proposal'
        ? item.expectedResponse!
        : { status: 'propose' as const, operations: item.expected }
    const parsed = parseProposal(JSON.stringify(expected))
    expect(() =>
      validateProposal(item.instruction, labDiagram(item.classNames), parsed),
    ).not.toThrow()
  }
})
