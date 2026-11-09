import type { AiProposal } from './proposal'
import { typeAliases as aliases } from './dataTypeAliases'

export const VALIDATION_VERSION = '6F-reasons-v1'

/** Valida evidencia explícita; nunca interpreta operaciones ni repara la salida. */
export function validateGrounding(instruction: string, proposal: AiProposal): void {
  if (proposal.status !== 'propose') return
  const words = new Set(instruction.match(/[\p{L}\p{N}_]+/gu) ?? [])
  const folded = new Set([...words].map((word) => word.toLowerCase()))
  const identifier = (name: string) => {
    if (!words.has(name))
      throw new Error(
        `El identificador "${name}" no aparece exactamente en la solicitud. No inventes ni corrijas nombres; pide aclaración si falta.`,
      )
  }
  const explicitMultiplicity = /\b(multiplicidad|multiplicidades|origen|destino)\b/i.test(
    instruction,
  )
  const multiplicities = new Set(
    instruction.match(
      /(?<![\p{L}\p{N}_.*])(?:\d+(?:\.\.(?:\d+|\*))?|\*)(?![\p{L}\p{N}_*]|\.[\p{N}.*])/gu,
    ) ?? [],
  )
  for (const operation of proposal.operations) {
    switch (operation.type) {
      case 'addClass':
      case 'deleteClass':
        identifier(operation.name)
        break
      case 'renameClass':
        identifier(operation.name)
        identifier(operation.newName)
        if (operation.name === operation.newName)
          throw new Error(
            'Renombrar al mismo nombre no modifica nada. Revisa la solicitud; rechaza si pide duplicar una clase existente.',
          )
        break
      case 'addAttribute':
        identifier(operation.className)
        identifier(operation.name)
        // Condición necesaria, no prueba de alcance ni de negación del modificador.
        if (
          operation.required &&
          !/\b(?:obligatori[oa]s?|requerid[oa]s?|obligatoriedad)\b/i.test(instruction)
        )
          throw new Error(
            `No se solicitó obligatoriedad para ${operation.name}. Usa required=false si no se pide explícitamente; no confundas necesitar un atributo con exigir su valor.`,
          )
        if (operation.dataType && !aliases[operation.dataType].some((alias) => folded.has(alias)))
          throw new Error(
            `El tipo ${operation.dataType} no fue especificado en la solicitud. Pide el tipo si falta; rechaza un tipo no admitido.`,
          )
        break
      case 'addMethod':
        identifier(operation.className)
        identifier(operation.name)
        if (operation.returnType && !(operation.returnType === 'void'
          ? folded.has('void') : aliases[operation.returnType].some(alias => folded.has(alias))))
          throw new Error(`El tipo de retorno ${operation.returnType} no fue especificado en la solicitud.`)
        break
      case 'addRelation':
        identifier(operation.source)
        identifier(operation.target)
        if (explicitMultiplicity && multiplicities.size > 0)
          for (const value of [operation.sourceMultiplicity, operation.targetMultiplicity])
            if (!multiplicities.has(value))
              throw new Error(
                `Multiplicidad ${value} no indicada. Conserva los valores literales solicitados: ${[...multiplicities].join(', ')}.`,
              )
        break
    }
  }
}
