import { useEffect, useRef, useState } from 'react'
import type { Diagram, ModelCommand } from '../../modeling/domain/model'
import { dataTypes } from '../../modeling/domain/model'
import { TextClient, type Generation } from '../infrastructure/textClient'
import { prepareResources, preparedManifest } from '../infrastructure/resources'
import { interpret } from '../domain/interpret'
import { parseProposal } from '../domain/proposal'
import { responseMessage } from '../domain/responses'
import { associationMessages } from '../domain/association'
import { untypedMessages } from '../domain/untyped'
import { inheritanceMessages } from '../domain/inheritance'
import { typedMessages } from '../domain/typed'
import {
  describeOperation,
  editorExamples,
  requestedEditorOperations,
  reviewedEditorCommand,
} from '../domain/editorProposal'
import './editor-assistant.css'

const model = 'qwen3-1.7b-external'
export default function EditorAssistant({
  diagram,
  saving,
  execute,
  close,
}: {
  diagram: Diagram
  saving: boolean
  execute: (command: ModelCommand) => Promise<boolean>
  close: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const client = useRef<TextClient | null>(null)
  const abort = useRef<AbortController | null>(null)
  const epoch = useRef(0)
  const busyRef = useRef(false)
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)
  const [instruction, setInstruction] = useState(editorExamples[0])
  const [status, setStatus] = useState(
    'Carga la IA local. La primera vez, prepara sus recursos (aprox. 1,46 GB).',
  )
  const [review, setReview] = useState<{
    command: ModelCommand
    snapshot: string
    lines: string[]
  } | null>(null)
  const stale = review !== null && review.snapshot !== JSON.stringify(diagram)
  useEffect(() => {
    dialog.current?.showModal()
    return () => {
      // Invalidar la generación vigente al desmontar, no la inicial del efecto.
      // oxlint-disable-next-line react-hooks/exhaustive-deps
      epoch.current++
      client.current?.cancel()
      abort.current?.abort()
    }
  }, [])

  async function run(task: (id: number) => Promise<void>) {
    if (busyRef.current || saving) return
    busyRef.current = true
    setBusy(true)
    const id = ++epoch.current
    try {
      await task(id)
    } catch (error) {
      if (id === epoch.current)
        setStatus(error instanceof Error ? error.message : 'No se pudo completar la operación.')
    } finally {
      if (id === epoch.current) {
        busyRef.current = false
        setBusy(false)
      }
    }
  }
  function cancel() {
    epoch.current++
    client.current?.cancel()
    client.current = null
    abort.current?.abort()
    busyRef.current = false
    setBusy(false)
    setReady(false)
    setReview(null)
    setStatus('Cancelado. No se aplicaron cambios. Vuelve a cargar la IA para continuar.')
  }
  async function propose(id: number) {
    setReview(null)
    // Rechazar el lenguaje fuera del subconjunto antes de consultar el motor.
    const requested = requestedEditorOperations(instruction, diagram)
    const base = structuredClone(diagram)
    const prompt = instruction
    setStatus('Interpretando en este equipo…')
    let output: Generation
    try {
      const isAssociation =
        requested[0]?.type === 'addRelation' && requested[0].kind === 'association'
      const isUntyped = requested.some((op) => op.type === 'addAttribute' && op.dataType === '')
      const isTyped = requested.some((op) => op.type === 'addAttribute' && op.dataType !== '')
      const isInheritance = requested[0]?.type === 'addRelation' && requested[0].kind === 'generalization'
      output = await interpret(
        prompt,
        base,
        (messages) =>
          client.current!.request<Generation>(
            'generate',
            messages,
            undefined,
            isUntyped ? 'structured' : 'legacy',
          ),
        isAssociation || isUntyped || isInheritance || isTyped
          ? {
              messages: isUntyped
                ? untypedMessages(prompt, base)
                : isTyped ? typedMessages(prompt, base) : isInheritance ? inheritanceMessages(prompt, base) : associationMessages(prompt, base),
              validate: (proposal) => {
                reviewedEditorCommand(prompt, base, proposal)
              },
            }
          : undefined,
      )
    } catch (error) {
      if (id === epoch.current) {
        client.current?.cancel()
        client.current = null
        setReady(false)
      }
      throw error
    }
    if (id !== epoch.current) return
    let proposal
    try {
      proposal = parseProposal(output.raw)
    } catch {
      throw new Error(
        'La IA no produjo una respuesta válida. No se aplicó nada. Inténtalo nuevamente.',
      )
    }
    if (proposal.status !== 'propose') {
      if (
        proposal.reason === 'missing_type' &&
        requested.some((op) => op.type === 'addAttribute' && !op.dataType)
      )
        throw new Error(
          'El tipo es opcional. La IA no generó la propuesta solicitada; puedes reintentar sin agregar un tipo.',
        )
      // Validación factual antes de mostrar cualquier motivo del modelo.
      const { validateProposal } = await import('../domain/validation')
      validateProposal(prompt, base, proposal)
      setStatus(responseMessage(proposal))
      return
    }
    const command = reviewedEditorCommand(prompt, base, proposal)
    setReview({
      command,
      snapshot: JSON.stringify(base),
      lines: proposal.operations.map(describeOperation),
    })
    setStatus('Revisa los cambios. El diagrama todavía no se modificó.')
  }

  return (
    <dialog
      ref={dialog}
      className="modal editor-assistant"
      aria-labelledby="assistant-title"
      onCancel={(event) => {
        event.preventDefault()
        if (!saving) close()
      }}
    >
      <h2 id="assistant-title">Asistente de edición UML</h2>
      <p>
        Escribe una instrucción con una de estas formas. Puedes cambiar nombres y tipos. Cada
        propuesta necesita tu confirmación.
      </p>
      <details>
        <summary>Comandos disponibles y ejemplos</summary>
        <ul>
          {editorExamples.map((example) => (
            <li key={example}>
              <button
                className="secondary"
                disabled={busy || saving}
                onClick={() => {
                  setInstruction(example)
                  setReview(null)
                }}
              >
                {example}
              </button>
            </li>
          ))}
        </ul>
        <p>
          El tipo de atributo es opcional: puedes escribir «Agrega modelo a Vehiculo». Tipos
          disponibles: {dataTypes.join(', ')}. Las clases referenciadas deben existir; las nuevas no
          deben estar duplicadas. Asociaciones: «muchos» significa 0..* y «pertenece a un solo»
          significa 1; ambos extremos deben estar indicados. También se admite origen 1 y destino
          1..* explícitos. No se admiten métodos, composición, agregación, borrado ni generación de
          sistemas completos.
        </p>
      </details>
      <div className="modal-actions">
        <button
          className="secondary"
          disabled={busy || ready || saving}
          onClick={() =>
            void run(async (id) => {
              abort.current = new AbortController()
              await prepareResources(
                (message) => {
                  if (id === epoch.current) setStatus(message)
                },
                abort.current.signal,
                model,
              )
              if (id === epoch.current)
                setStatus('Recursos preparados. Ahora puedes cargar la IA local.')
            })
          }
        >
          Preparar recursos IA
        </button>
        <button
          className="secondary"
          disabled={busy || ready || saving}
          onClick={() =>
            void run(async (id) => {
              setStatus('Cargando IA local…')
              await preparedManifest(model)
              if (id !== epoch.current) return
              client.current?.cancel()
              const engine = new TextClient()
              client.current = engine
              await engine.request('load', undefined, model)
              if (id === epoch.current) {
                setReady(true)
                setStatus('IA lista. Escribe tu instrucción.')
              }
            })
          }
        >
          Cargar IA local
        </button>
      </div>
      <label htmlFor="editor-ai-instruction">Instrucción UML</label>
      <textarea
        id="editor-ai-instruction"
        value={instruction}
        maxLength={1500}
        rows={3}
        disabled={busy || saving}
        onChange={(event) => {
          setInstruction(event.target.value)
          setReview(null)
        }}
      />
      <button
        className="primary"
        disabled={!ready || busy || saving || !instruction.trim()}
        onClick={() => void run(propose)}
      >
        Generar propuesta
      </button>
      <p role="status" className="assistant-status">
        {status}
      </p>
      {review && (
        <section aria-label="Vista previa IA">
          <h3>Cambios propuestos</h3>
          <ol>
            {review.lines.map((line, index) => (
              <li key={index}>{line}</li>
            ))}
          </ol>
          {stale && (
            <p role="alert">El diagrama cambió. Genera una propuesta nueva antes de confirmar.</p>
          )}
          <div className="modal-actions">
            <button
              className="secondary"
              disabled={busy || saving}
              onClick={() => {
                setReview(null)
                setStatus('Propuesta descartada. No se aplicaron cambios.')
              }}
            >
              Descartar propuesta
            </button>
            <button
              className="primary"
              disabled={busy || saving || stale}
              onClick={() =>
                void run(async (id) => {
                  if (review.snapshot !== JSON.stringify(diagram))
                    throw new Error('El diagrama cambió. Genera otra propuesta.')
                  const ok = await execute(review.command)
                  if (id !== epoch.current) return
                  if (ok) {
                    setReview(null)
                    setStatus(
                      'Cambios guardados. Puedes escribir otra instrucción o cerrar el asistente.',
                    )
                  } else
                    setStatus(
                      'No se confirmó el guardado. Revisa el aviso del editor; la propuesta se conserva para reintentar o descartar.',
                    )
                })
              }
            >
              Confirmar y guardar
            </button>
          </div>
        </section>
      )}
      <div className="modal-actions">
        {busy && !saving && (
          <button className="secondary" onClick={cancel}>
            Cancelar operación IA
          </button>
        )}
        <button className="secondary" disabled={saving} onClick={close}>
          Cerrar asistente
        </button>
      </div>
    </dialog>
  )
}
