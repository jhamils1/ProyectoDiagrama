import { useRef, useState } from 'react'
import type { Diagram, ModelCommand } from '../modeling/domain/model'
import { describeOperation, requestedEditorOperations, reviewedEditorCommand } from '../ai/domain/editorProposal'

/** Only explicit, validated commands are applied; open-ended text still goes to Qwen. */
export function isEditingInstruction(text: string) {
  try { requestedEditorOperations(text); return true } catch {
    return /^\s*(?:por favor\s*,?\s*)?¿?(?:(?:puedes|podr[ií]as)\s+)?(?:crea(?:r)?|agrega(?:r)?|añade|añadir|incorpora(?:r)?|incluye|incluir|pon(?:er)?|renombra(?:r)?|elimina(?:r)?|borra(?:r)?)\b/i.test(text)
  }
}

export function useSharedEditing(diagram: Diagram, revision: number, enabled: boolean,
  execute: (command: ModelCommand, assistantInstruction?: string) => Promise<boolean>, position: () => { x: number; y: number } | undefined) {
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  // Preserve the exact command and generated IDs if the server acknowledgement is lost.
  const attempt = useRef<{ instruction: string; snapshot: string; revision: number; command: ModelCommand; changes: string[] } | null>(null)

  async function apply(instruction: string) {
    if (pending.current) return false
    if (!enabled) { setStatus('Necesitas permiso de edición y guardar los campos pendientes para realizar cambios.'); return false }
    pending.current = true
    setBusy(true)
    setStatus('Aplicando y guardando el cambio…')
    try {
      const snapshot = JSON.stringify(diagram)
      let current = attempt.current
      if (!current || current.instruction !== instruction || current.snapshot !== snapshot || current.revision !== revision) {
        const operations = requestedEditorOperations(instruction, diagram)
        const command = reviewedEditorCommand(instruction, diagram, { status: 'propose', operations })
        if (command.type === 'applyReviewedEdit') {
          const existing = new Set(diagram.classes.map(item => item.id))
          const center = position()
          let offset = 0
          if (center) for (const item of command.classes) {
            if (!existing.has(item.id)) {
              item.position = { x: center.x + offset * 30, y: center.y + offset * 30 }
              offset++
            }
          }
        }
        current = { instruction, snapshot, revision, command, changes: operations.map(describeOperation) }
        attempt.current = current
      }
      if (await execute(current.command, current.instruction)) {
        attempt.current = null
        setStatus(`Cambios guardados: ${current.changes.join(' ')}`)
        return true
      }
      setStatus('No se confirmó el guardado. Comprueba el aviso y la actividad del diagrama antes de volver a intentar.')
      return false
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'No se pudo aplicar el cambio.')
      return false
    } finally { pending.current = false; setBusy(false) }
  }
  return { status, busy, apply }
}
