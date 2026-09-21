import type { Diagram } from '../../modeling/domain/model'
import { previewProposal, type AiProposal } from './proposal'
import { validateGrounding } from './grounding'
import { validateResponse } from './responses'

export function validateProposal(instruction: string, diagram: Diagram, proposal: AiProposal) {
  if (proposal.status !== 'propose') validateResponse(instruction, diagram, proposal)
  validateGrounding(instruction, proposal)
  return previewProposal(diagram, proposal)
}
