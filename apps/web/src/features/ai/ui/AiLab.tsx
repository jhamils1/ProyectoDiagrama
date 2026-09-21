import { useEffect, useRef, useState } from 'react'
import { corpus, labDiagram, matchesExpected, type EvaluationCase } from '../domain/corpus'
import { parseProposal, PROMPT_VERSION } from '../domain/proposal'
import { validateProposal } from '../domain/validation'
import { negativeResponseSchema, responseMessage } from '../domain/responses'
import { interpret } from '../domain/interpret'
import { holdout } from '../domain/holdout'
import { holdout6c } from '../domain/holdout6c'
import { holdout6d } from '../domain/holdout6d'
import { holdout6f } from '../domain/holdout6f'
import { decodingModes, type DecodingMode } from '../domain/decoding'
import { VALIDATION_VERSION } from '../domain/grounding'
import {
  prepareResources,
  preparedManifest,
  type ResourceManifest,
} from '../infrastructure/resources'
import { TextClient, type EngineInfo, type Generation } from '../infrastructure/textClient'
import './ai-lab.css'
import { modelCatalog, type ModelKey } from '../infrastructure/modelCatalog'

type Result = Generation & {
  id: string
  instruction: string
  accepted: boolean
  correct: boolean | null
  message: string
}
export default function AiLab() {
  const client = useRef<TextClient | null>(null)
  const controller = useRef<AbortController | null>(null)
  const epoch = useRef(0)
  const busyRef = useRef(false)
  const reportUrl = useRef<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)
  const [status, setStatus] = useState(
    'Prepara los recursos una vez y después carga el modelo local.',
  )
  const [instruction, setInstruction] = useState(corpus[0].instruction)
  const [manifest, setManifest] = useState<ResourceManifest | null>(null)
  const [engine, setEngine] = useState<EngineInfo | null>(null)
  const [results, setResults] = useState<Result[]>([])
  const [suite, setSuite] = useState('manual')
  const [modelKey, setModelKey] = useState<ModelKey>('qwen3-0.6b')
  const [decoding, setDecoding] = useState<DecodingMode>('legacy')
  useEffect(
    () => () => {
      epoch.current++
      client.current?.cancel()
      controller.current?.abort()
      if (reportUrl.current) URL.revokeObjectURL(reportUrl.current)
    },
    [],
  )

  async function run(task: (generation: number) => Promise<void>) {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    const generation = ++epoch.current
    try {
      await task(generation)
    } catch (error) {
      if (generation === epoch.current) {
        client.current?.cancel()
        client.current = null
        setReady(false)
        setStatus(error instanceof Error ? error.message : String(error))
      }
    } finally {
      if (generation === epoch.current) {
        busyRef.current = false
        setBusy(false)
      }
    }
  }
  function cancel() {
    epoch.current++
    controller.current?.abort()
    client.current?.cancel()
    client.current = null
    busyRef.current = false
    setBusy(false)
    setReady(false)
    setStatus(
      'Cancelado. Los diagramas del proyecto no se modificaron. Puedes cargar el modelo nuevamente.',
    )
  }
  async function evaluate(
    item: Pick<EvaluationCase, 'id' | 'instruction' | 'classNames'> & {
      expected?: EvaluationCase['expected']
      expectedResponse?: EvaluationCase['expectedResponse']
    },
    generation: number,
  ) {
    const base = labDiagram(item.classNames)
    const activeClient = client.current!
    const output = await interpret(item.instruction, base, (messages) =>
      activeClient.request<Generation>('generate', messages, undefined, decoding),
    )
    if (generation !== epoch.current) return
    let accepted = false,
      correct = false,
      message = ''
    try {
      const proposal = parseProposal(output.raw)
      validateProposal(item.instruction, base, proposal)
      accepted = proposal.status === 'propose'
      correct =
        item.expected === 'no-proposal'
          ? !accepted &&
            (item.expectedResponse === undefined ||
              JSON.stringify(proposal) ===
                JSON.stringify(negativeResponseSchema.parse(item.expectedResponse)))
          : item.expected !== undefined &&
            proposal.status === 'propose' &&
            matchesExpected(proposal.operations, item.expected)
      message = accepted
        ? 'Propuesta válida sobre el modelo de prueba. No se aplicó al proyecto.'
        : proposal.status !== 'propose'
          ? responseMessage(proposal)
          : ''
    } catch (error) {
      message = `Rechazada por validación: ${error instanceof Error ? error.message : String(error)}`
    }
    const result: Result = {
      ...output,
      id: item.id,
      instruction: item.instruction,
      accepted,
      correct: item.expected === undefined ? null : correct,
      message,
    }
    setResults((previous) => [...previous, result])
  }
  const measured = results.filter((r) => r.correct !== null)
  const download = () => {
    const latencies = measured
      .filter((r) => r.origin !== 'scope-policy')
      .map((r) => r.elapsedMs)
      .sort((a, b) => a - b)
    const report = {
      recordedAt: new Date().toISOString(),
      corpus: suite,
      promptVersion: PROMPT_VERSION,
      validationVersion: VALIDATION_VERSION,
      decodingVersion: decodingModes[decoding],
      modelKey,
      manifest,
      engine,
      results,
      metrics: {
        count: measured.length,
        correct: measured.filter((r) => r.correct).length,
        scopePolicyCases: measured.filter((r) => r.origin === 'scope-policy').length,
        medianMs: latencies.length
          ? (latencies[Math.floor((latencies.length - 1) / 2)] +
              latencies[Math.floor(latencies.length / 2)]) /
            2
          : null,
        p95Ms: latencies.length ? latencies[Math.ceil(latencies.length * 0.95) - 1] : null,
      },
      memory: 'No medida: heap JS no equivale a RAM de CPU/GPU del modelo.',
    }
    if (reportUrl.current) URL.revokeObjectURL(reportUrl.current)
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }),
    )
    const link = document.createElement('a')
    reportUrl.current = url
    link.href = url
    link.download = 'modela-ia-texto-evaluacion.json'
    document.body.append(link)
    link.click()
    link.remove()
  }
  return (
    <main className="ai-lab">
      <a href="/">← Volver al editor</a>
      <h1>Laboratorio de IA local</h1>
      <p>
        Asistente de edición UML: indica cambios concretos en clases, atributos y relaciones. No
        genera sistemas completos desde una descripción. Los métodos están previstos, pero aún no
        implementados. Este laboratorio usa clases de ejemplo; tus proyectos no se modifican.
      </p>
      <p>
        Clases de prueba: Cliente, Pedido, Producto, Persona y Empleado. Cada instrucción comienza
        desde ese modelo. Los 20 casos nuevos usan Libro, Socio, Prestamo, Autor y Publicacion. La
        suite 6C usa Paciente, Consulta, Medico, Profesional y Clinica. La suite 6D usa Ruta, Viaje,
        Vehiculo, Transporte y Estacion.
      </p>
      <section aria-label="Preparación">
        <h2>1. Preparar y cargar</h2>
        <p>
          Requiere la aplicación compilada y recursos preparados en este equipo con{' '}
          <code>npm.cmd run ai:prepare</code> (añade <code>-- --model=qwen3-1.7b</code> para el
          modelo mayor). WebGPU con shader-f16.
        </p>
        <p>
          La variante de datos externos requiere la conversión local descrita en{' '}
          <code>docs/ETAPA_06C.md</code>.
        </p>
        <label htmlFor="ai-model">Modelo local</label>
        <select
          id="ai-model"
          value={modelKey}
          disabled={busy}
          onChange={(event) => {
            cancel()
            setModelKey(event.target.value as ModelKey)
            setManifest(null)
            setEngine(null)
            setResults([])
            setSuite('manual')
            setStatus('Modelo seleccionado. Prepara sus recursos o carga la copia local.')
          }}
        >
          {Object.entries(modelCatalog).map(([key, model]) => (
            <option key={key} value={key}>
              {model.label}
            </option>
          ))}
        </select>
        <div className="ai-actions">
          <button
            disabled={busy || ready}
            onClick={() =>
              void run(async (generation) => {
                controller.current = new AbortController()
                const prepared = await prepareResources(
                  (message) => {
                    if (generation === epoch.current) setStatus(message)
                  },
                  controller.current.signal,
                  modelKey,
                )
                if (generation !== epoch.current) return
                setManifest(prepared.manifest)
                setStatus(
                  `Recursos verificados y guardados. ${prepared.persistent ? 'Almacenamiento persistente concedido.' : 'El navegador puede liberar la caché si necesita espacio.'} Carga el modelo.`,
                )
              })
            }
          >
            Preparar recursos sin conexión
          </button>
          <button
            disabled={busy || ready}
            onClick={() =>
              void run(async (generation) => {
                setStatus('Comprobando caché y cargando el modelo en WebGPU…')
                const resources = await preparedManifest(modelKey)
                if (generation !== epoch.current) return
                setManifest(resources)
                client.current?.cancel()
                client.current = new TextClient()
                const loaded = await client.current.request<EngineInfo>('load', undefined, modelKey)
                if (generation !== epoch.current) return
                setEngine(loaded)
                setReady(true)
                setStatus(`Modelo listo. Carga local: ${(loaded.loadMs / 1000).toFixed(1)} s.`)
              })
            }
          >
            Cargar modelo local
          </button>
          <button disabled={!busy && !ready} onClick={cancel}>
            Cancelar y liberar modelo
          </button>
        </div>
        <p role="status" aria-live="polite">
          {status}
        </p>
      </section>
      <section aria-label="Evaluación">
        <h2>2. Probar instrucciones</h2>
        <label htmlFor="ai-decoding">Generación</label>
        <select
          id="ai-decoding"
          value={decoding}
          disabled={busy}
          onChange={(event) => {
            setDecoding(event.target.value as DecodingMode)
            setResults([])
            setSuite('manual')
          }}
        >
          <option value="legacy">Generación estable sin gramática</option>
          <option value="structured">JSON estructurado experimental 6D</option>
        </select>
        <label htmlFor="ai-instruction">Instrucción en español</label>
        <textarea
          id="ai-instruction"
          maxLength={1500}
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          disabled={busy}
        />
        <div className="ai-actions">
          <button
            disabled={!ready || busy || !instruction.trim()}
            onClick={() =>
              void run(async (generation) => {
                setResults([])
                setSuite('manual')
                setStatus('Interpretando en este equipo…')
                await evaluate({ id: 'manual', instruction }, generation)
                if (generation === epoch.current)
                  setStatus('Interpretación terminada. Revisa el resultado.')
              })
            }
          >
            Interpretar texto
          </button>
          <button
            disabled={!ready || busy}
            onClick={() =>
              void run(async (generation) => {
                setResults([])
                setSuite('6A-v1')
                for (const item of corpus) {
                  if (generation !== epoch.current) return
                  setStatus(`Evaluando ${item.id} de 30…`)
                  await evaluate(item, generation)
                }
                if (generation === epoch.current)
                  setStatus('Evaluación de 30 casos terminada. Puedes descargar el informe.')
              })
            }
          >
            Evaluar 30 casos
          </button>
          <button
            disabled={!ready || busy}
            onClick={() =>
              void run(async (generation) => {
                setResults([])
                setSuite('6B-holdout-v1')
                for (const item of holdout) {
                  if (generation !== epoch.current) return
                  setStatus(`Evaluando ${item.id} de 20…`)
                  await evaluate(item, generation)
                }
                if (generation === epoch.current)
                  setStatus('Evaluación de 20 casos nuevos terminada. Puedes descargar el informe.')
              })
            }
          >
            Evaluar 20 casos nuevos
          </button>
          <button
            disabled={!ready || busy}
            onClick={() =>
              void run(async (generation) => {
                setResults([])
                setSuite('6C-reservada-v1')
                for (const item of holdout6c) {
                  if (generation !== epoch.current) return
                  setStatus(`Evaluando ${item.id} de 20…`)
                  await evaluate(item, generation)
                }
                if (generation === epoch.current)
                  setStatus('Evaluación de 20 casos 6C terminada. Puedes descargar el informe.')
              })
            }
          >
            Evaluar 20 casos 6C
          </button>
          <button
            disabled={!ready || busy}
            onClick={() =>
              void run(async (generation) => {
                setResults([])
                setSuite('6D-reservada-v1')
                for (const item of holdout6d) {
                  if (generation !== epoch.current) return
                  setStatus(`Evaluando ${item.id} de 20…`)
                  await evaluate(item, generation)
                }
                if (generation === epoch.current)
                  setStatus('Evaluación de 20 casos 6D terminada. Puedes descargar el informe.')
              })
            }
          >
            Evaluar 20 casos 6D
          </button>
          <button
            disabled={!ready || busy}
            onClick={() =>
              void run(async (generation) => {
                setResults([])
                setSuite('6F-reservada-v1')
                for (const item of holdout6f) {
                  if (generation !== epoch.current) return
                  setStatus(`Evaluando ${item.id} de 20…`)
                  await evaluate(item, generation)
                }
                if (generation === epoch.current)
                  setStatus('Evaluación de 20 casos 6F terminada. Puedes descargar el informe.')
              })
            }
          >
            Evaluar 20 casos 6F
          </button>
          <button disabled={busy || !results.length} onClick={download}>
            Descargar informe
          </button>
        </div>
        <p>
          Coincidencias automáticas: {measured.filter((r) => r.correct).length}/{measured.length}.
          Una propuesta válida puede interpretar mal la intención. Las aclaraciones y rechazos
          también requieren revisión. Las suites históricas solo comprueban ausencia de operaciones
          y validez del motivo; la suite 6F exige el motivo y la referencia esperados. Los tiempos
          de inferencia excluyen las respuestas de la política de alcance.
        </p>
        <ol className="ai-results">
          {results.map((result, index) => (
            <li key={index}>
              <strong>
                {result.id}: {result.instruction}
              </strong>
              <p>
                {(result.elapsedMs / 1000).toFixed(1)} s · {result.outputTokens} tokens ·{' '}
                {result.correct === null
                  ? 'Prueba manual'
                  : result.correct
                    ? 'Coincide con el criterio automático'
                    : 'No coincide con el criterio automático'}
                {result.tokenLimitReached ? ' · Límite de salida alcanzado' : ''}
              </p>
              <p>{result.message}</p>
              {result.origin === 'scope-policy' && (
                <p>Respuesta de la política de alcance, sin inferencia del modelo.</p>
              )}
              <pre>{result.raw}</pre>
            </li>
          ))}
        </ol>
      </section>
    </main>
  )
}
