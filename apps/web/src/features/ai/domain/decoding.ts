import { z } from 'zod'
import type { ResponseFormat } from '@huggingface/transformers-structured-output'
import { proposalSchema } from './proposal'

export const decodingModes = {
  legacy: '6C-greedy-v1',
  structured: '6D-json-schema-v1',
} as const
export type DecodingMode = keyof typeof decodingModes

// El decodificador no admite patrones de cadenas. El contrato Zod completo
// sigue siendo obligatorio después de generar; este esquema solo guía tokens.
function withoutPatterns(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutPatterns)
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== 'pattern')
        .map(([key, child]) => [key, withoutPatterns(child)]),
    )
  return value
}

export const generationSchema = withoutPatterns(
  z.toJSONSchema(proposalSchema, { io: 'input' }),
) as Extract<ResponseFormat, { type: 'json_schema' }>['json_schema']
