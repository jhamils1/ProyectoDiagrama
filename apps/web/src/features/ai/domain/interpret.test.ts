import { expect, it, vi } from 'vitest'
import { labDiagram } from './corpus'
import { interpret } from './interpret'

const output = (raw: string) => ({
  raw,
  elapsedMs: 100,
  inputTokens: 20,
  outputTokens: 10,
  tokenLimitReached: false,
})

it('corrige una vez con el error real y suma el coste de ambos intentos sin mutar el diagrama', async () => {
  const diagram = labDiagram()
  const original = JSON.stringify(diagram)
  const generate = vi
    .fn()
    .mockResolvedValueOnce(
      output('{"status":"propose","operations":[{"type":"deleteClass","name":"Ausente"}]}'),
    )
    .mockResolvedValueOnce(
      output('{"status":"reject","reason":"unknown_class","subject":"Ausente"}'),
    )
  const result = await interpret('Elimina Ausente.', diagram, generate)
  expect(generate).toHaveBeenCalledTimes(2)
  expect(generate.mock.calls[1][0].at(-1).content).toContain('No existe la clase Ausente')
  expect(result.attempts).toHaveLength(2)
  expect(result.elapsedMs).toBe(200)
  expect(result.outputTokens).toBe(20)
  expect(JSON.stringify(diagram)).toBe(original)
})

it('no usa resultados esperados para corregir una propuesta válida de intención equivocada', async () => {
  const generate = vi
    .fn()
    .mockResolvedValue(
      output('{"status":"propose","operations":[{"type":"addClass","name":"Factura"}]}'),
    )
  expect((await interpret('Crea Factura y Recibo.', labDiagram(), generate)).attempts).toHaveLength(
    1,
  )
})

it('limita las correcciones y propaga fallos o cancelación del motor', async () => {
  const invalid = vi.fn().mockResolvedValue(output('invalid'))
  expect((await interpret('Crea Factura.', labDiagram(), invalid)).attempts).toHaveLength(2)
  const cancelled = vi.fn().mockRejectedValue(new Error('Cancelado'))
  await expect(interpret('Crea Factura.', labDiagram(), cancelled)).rejects.toThrow('Cancelado')
  expect(cancelled).toHaveBeenCalledTimes(1)
})

it('devuelve obligatoriedad sin respaldo al motor sin corregirla silenciosamente', async () => {
  const diagram = labDiagram()
  const before = JSON.stringify(diagram)
  const generated = (required: boolean) =>
    output(
      JSON.stringify({
        status: 'propose',
        operations: [
          {
            type: 'addAttribute',
            className: 'Pedido',
            name: 'inicio',
            dataType: 'DateTime',
            required,
          },
        ],
      }),
    )
  const generate = vi
    .fn()
    .mockResolvedValueOnce(generated(true))
    .mockResolvedValueOnce(generated(false))
  const result = await interpret('Pedido necesita inicio de tipo DateTime.', diagram, generate)
  expect(generate).toHaveBeenCalledTimes(2)
  expect(generate.mock.calls[1][0].at(-1).content).toContain('No se solicitó obligatoriedad')
  expect(JSON.parse(result.raw).operations[0].required).toBe(false)
  expect(result.elapsedMs).toBe(200)
  expect(JSON.stringify(diagram)).toBe(before)
})
