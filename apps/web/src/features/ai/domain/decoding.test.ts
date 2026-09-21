import { expect, it } from 'vitest'
import { Tensor } from '@huggingface/transformers'
import { StructuredOutputProcessor } from '@huggingface/transformers-structured-output'
import { generationSchema } from './decoding'
import { parseProposal, previewProposal, messagesFor } from './proposal'
import { validateGrounding } from './grounding'
import { holdout6d } from './holdout6d'
import { labDiagram } from './corpus'

// Tokenizador de bytes determinista: prueba el procesador real sin descargar pesos.
const tokenizer = {
  tokens: Array.from({ length: 257 }, (_, id) => new Uint8Array(id < 256 ? [id] : [])),
  eos_token_id: 256,
}
function accepts(raw: string) {
  const processor = new StructuredOutputProcessor(tokenizer, {
    type: 'json_schema',
    json_schema: generationSchema,
  })
  const ids = [0n] // prompt ficticio, no forma parte de la respuesta
  for (const token of [...new TextEncoder().encode(raw), 256]) {
    const scores = new Tensor('float32', new Float32Array(257), [1, 257])
    processor([ids], scores)
    if (!Number.isFinite(scores.data[token] as number)) return false
    ids.push(BigInt(token))
  }
  return true
}

it.each([
  '{"status":"propose","operations":[{"type":"addClass","name":"Casa"}]}',
  '{"status":"propose","operations":[{"type":"addAttribute","className":"Casa","name":"numero","dataType":"Integer","required":false}]}',
  '{"status":"clarify","reason":"missing_type","subject":"titulo"}',
])('la gramática admite respuestas completas y EOS: %s', (raw) => {
  expect(accepts(raw)).toBe(true)
  expect(() => parseProposal(raw)).not.toThrow()
})

it.each([
  '{"status":"propose","operations":[]}',
  '{"status":"propose","operations":[{"type":"eval","name":"Casa"}]}',
  '{"status":"propose","operations":[{"type":"addAttribute","className":"Casa","name":"extra","dataType":"JSONB"}]}',
  '{"status":"clarify","message":"Pregunta","extra":true}',
  '{"status":"clarify","message":"Pregunta"',
])('bloquea contratos inválidos y EOS prematuro: %s', (raw) => {
  expect(accepts(raw)).toBe(false)
})

it('mantiene validación de identificadores posterior, incluso con JSON admitido', () => {
  const raw = '{"status":"propose","operations":[{"type":"addClass","name":"123Casa"}]}'
  expect(accepts(raw)).toBe(true)
  expect(() => parseProposal(raw)).toThrow()
})

it('no permite más de ocho operaciones en una respuesta', () => {
  expect(
    accepts(
      JSON.stringify({
        status: 'propose',
        operations: Array.from({ length: 9 }, (_, index) => ({
          type: 'addClass',
          name: `Casa${index}`,
        })),
      }),
    ),
  ).toBe(false)
})

it('los veinte casos reservados son coherentes; los esperados no entran en el prompt', () => {
  expect(holdout6d).toHaveLength(20)
  for (const item of holdout6d) {
    const base = labDiagram(item.classNames)
    const input = JSON.parse(messagesFor(item.instruction, base).at(-1)!.content)
    expect(Object.keys(input).sort()).toEqual(['classes', 'instruction'])
    if (item.expected !== 'no-proposal') {
      const proposal = { status: 'propose' as const, operations: item.expected }
      expect(() => previewProposal(base, proposal)).not.toThrow()
      expect(() => validateGrounding(item.instruction, proposal)).not.toThrow()
    }
  }
})
