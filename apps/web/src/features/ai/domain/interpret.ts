import type { Diagram } from '../../modeling/domain/model'
import { messagesFor, parseProposal, type AiProposal } from './proposal'
import { validateProposal } from './validation'
import { requiresConcreteInstruction } from './responses'

export type Generation = {
  raw: string
  elapsedMs: number
  inputTokens: number
  outputTokens: number
  tokenLimitReached: boolean
  origin?: 'model' | 'scope-policy'
}

type Message = { role: string; content: string }
type Generate = (messages: Message[]) => Promise<Generation>

/** Una corrección basada exclusivamente en validación, nunca en respuestas del corpus. */
export async function interpret(
  instruction: string,
  diagram: Diagram,
  generate: Generate,
  options?: { messages: Message[]; validate: (proposal: AiProposal) => void },
) {
  const defaultMessages = messagesFor(instruction, diagram)
  const messages = options?.messages ?? defaultMessages
  if (requiresConcreteInstruction(instruction))
    return {
      raw: JSON.stringify({ status: 'clarify', reason: 'concrete_instruction' }),
      elapsedMs: 0,
      inputTokens: 0,
      outputTokens: 0,
      tokenLimitReached: false,
      origin: 'scope-policy' as const,
      attempts: [] as Generation[],
    }
  const attempts: Generation[] = []
  for (let attempt = 0; attempt < 2; attempt++) {
    const output = await generate(messages)
    attempts.push(output)
    try {
      const proposal = parseProposal(output.raw)
      validateProposal(instruction, diagram, proposal)
      options?.validate(proposal)
      break
    } catch (error) {
      if (attempt === 0) {
        const detail = error instanceof Error ? error.message : String(error)
        messages.push(
          { role: 'assistant', content: output.raw.slice(0, 4000) },
          {
            role: 'user',
            content: `Tu propuesta falló la validación: ${detail.slice(0, 1200)}. Un error en tu propuesta no vuelve inválida la solicitud del usuario. Corrige tu propuesta y devuelve un único JSON usando la solicitud original y su contexto. Rechaza solo si la solicitud original es inválida; si falta información, pregunta solo por ese dato. No inventes ni cambies identificadores. No pidas datos ya presentes. /no_think`,
          },
        )
      }
    }
  }
  return {
    ...attempts.at(-1)!,
    origin: 'model' as const,
    elapsedMs: attempts.reduce((sum, item) => sum + item.elapsedMs, 0),
    inputTokens: attempts.reduce((sum, item) => sum + item.inputTokens, 0),
    outputTokens: attempts.reduce((sum, item) => sum + item.outputTokens, 0),
    tokenLimitReached: attempts.some((item) => item.tokenLimitReached),
    attempts,
  }
}
