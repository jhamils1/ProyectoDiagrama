import { useEffect, useRef, useState } from 'react'
import { imageModelCommand, parseImageModel, type ImageModel } from '../domain/imageDiagram'
import type { Diagram, ModelCommand } from '../../modeling/domain/model'
import { analyzeLocalImage } from '../infrastructure/visionClient'

export function ImageDiagramDialog({
  diagram,
  close,
  execute,
  busy,
}: {
  diagram: Diagram
  close: () => void
  execute: (command: ModelCommand) => Promise<boolean>
  busy: boolean
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<ImageModel | null>(null)
  const [snapshot, setSnapshot] = useState<Diagram | null>(null)
  const [working, setWorking] = useState(false)
  const [status, setStatus] = useState('')
  const [warnings, setWarnings] = useState<string[]>([])
  const operation = useRef<AbortController | null>(null)
  useEffect(() => {
    dialog.current?.showModal()
    return () => operation.current?.abort()
  }, [])
  async function analyze() {
    if (!file) return
    setResult(null)
    setStatus('')
    setWarnings([])
    setWorking(true)
    const controller = new AbortController()
    operation.current = controller
    const base = structuredClone(diagram)
    try {
      const output = await analyzeLocalImage(file, setStatus, controller.signal)
      const parsed = parseImageModel(JSON.stringify(output.model))
      setSnapshot(base)
      setResult(parsed)
      setWarnings(output.warnings)
      setStatus('Revisa los elementos antes de agregarlos.')
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'No se pudo analizar la imagen.')
    } finally {
      operation.current = null
      setWorking(false)
    }
  }
  async function apply() {
    if (!snapshot || !result) return
    try {
      if (await execute(imageModelCommand(snapshot, result))) close()
      else
        setStatus(
          'No se pudo guardar. El diagrama pudo cambiar o no tienes permiso de edición; cierra y revisa el editor.',
        )
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'No se pudo aplicar el resultado.')
    }
  }
  return (
    <dialog
      ref={dialog}
      className="modal"
      onCancel={(e) => {
        e.preventDefault()
        if (!working) close()
      }}
    >
      <h2>Generar desde imagen</h2>
      <p>
        Selecciona una imagen de un diagrama de clases. El análisis se realiza en este equipo;
        revisa el resultado antes de agregarlo.
      </p>
      <p>
        Florence-2 · IA visual local. Sus recursos se guardan en este navegador la primera vez
        (aprox. 305 MB). Después puedes analizar sin internet. La foto permanece en este equipo.
      </p>
      <p>
        Usa fotos frontales con cajas completas y texto legible. Revisa los nombres, atributos y
        conexiones reconocidos antes de guardar.
      </p>
      <label htmlFor="uml-image">Imagen del diagrama</label>
      <input
        id="uml-image"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        disabled={working}
        onChange={(e) => {
          const selected = e.target.files?.[0] ?? null
          setResult(null)
          setSnapshot(null)
          if (selected && selected.size > 10 * 1024 * 1024) {
            setFile(null)
            setStatus('La imagen debe pesar como máximo 10 MB.')
          } else {
            setFile(selected)
            setStatus('')
          }
        }}
      />
      <div className="modal-actions">
        <button
          className="secondary"
          disabled={!file || working || busy}
          onClick={() => void analyze()}
        >
          {working ? 'Procesando…' : 'Analizar imagen'}
        </button>
        {working && (
          <button className="secondary" onClick={() => operation.current?.abort()}>
            Cancelar análisis
          </button>
        )}
      </div>
      {status && <p role="status">{status}</p>}
      {result && (
        <div style={{ maxHeight: '35vh', overflowY: 'auto' }}>
          <strong>Vista previa</strong>
          {warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
          {result.classes.map((c, i) => (
            <fieldset key={i}>
              <legend>Clase {i + 1}</legend>
              <label>
                Nombre{' '}
                <input
                  value={c.name}
                  onChange={(e) =>
                    setResult(
                      (old) =>
                        old && {
                          ...old,
                          classes: old.classes.map((item, n) =>
                            n === i ? { ...item, name: e.target.value } : item,
                          ),
                        },
                    )
                  }
                />
              </label>
              {c.attributes.map((a, j) => (
                <div key={j}>
                  <label>
                    Atributo{' '}
                    <input
                      value={a.name}
                      onChange={(e) =>
                        setResult(
                          (old) =>
                            old && {
                              ...old,
                              classes: old.classes.map((item, n) =>
                                n === i
                                  ? {
                                      ...item,
                                      attributes: item.attributes.map((attr, k) =>
                                        k === j ? { ...attr, name: e.target.value } : attr,
                                      ),
                                    }
                                  : item,
                              ),
                            },
                        )
                      }
                    />
                  </label>
                  <label>
                    {' '}
                    Tipo{' '}
                    <input
                      value={a.type}
                      onChange={(e) =>
                        setResult(
                          (old) =>
                            old && {
                              ...old,
                              classes: old.classes.map((item, n) =>
                                n === i
                                  ? {
                                      ...item,
                                      attributes: item.attributes.map((attr, k) =>
                                        k === j ? { ...attr, type: e.target.value } : attr,
                                      ),
                                    }
                                  : item,
                              ),
                            },
                        )
                      }
                    />
                  </label>
                </div>
              ))}
            </fieldset>
          ))}
          {result.relations.map((r, i) => (
            <fieldset key={i}>
              <legend>Relación {i + 1}</legend>
              <label>
                Origen{' '}
                <input
                  value={r.source}
                  onChange={(e) =>
                    setResult(
                      (old) =>
                        old && {
                          ...old,
                          relations: old.relations.map((item, n) =>
                            n === i ? { ...item, source: e.target.value } : item,
                          ),
                        },
                    )
                  }
                />
              </label>
              <label>
                {' '}
                Destino{' '}
                <input
                  value={r.target}
                  onChange={(e) =>
                    setResult(
                      (old) =>
                        old && {
                          ...old,
                          relations: old.relations.map((item, n) =>
                            n === i ? { ...item, target: e.target.value } : item,
                          ),
                        },
                    )
                  }
                />
              </label>
              <label>
                {' '}
                Tipo{' '}
                <select
                  value={r.type}
                  onChange={(e) =>
                    setResult(
                      (old) =>
                        old && {
                          ...old,
                          relations: old.relations.map((item, n) =>
                            n === i
                              ? {
                                  ...item,
                                  type: e.target.value as 'association' | 'generalization',
                                }
                              : item,
                          ),
                        },
                    )
                  }
                >
                  <option value="association">Asociación</option>
                  <option value="generalization">Herencia</option>
                </select>
              </label>
              {r.type === 'association' && (
                <div>
                  <label>
                    Multiplicidad origen{' '}
                    <input
                      value={r.sourceMultiplicity}
                      onChange={(e) =>
                        setResult(
                          (old) =>
                            old && {
                              ...old,
                              relations: old.relations.map((item, n) =>
                                n === i ? { ...item, sourceMultiplicity: e.target.value } : item,
                              ),
                            },
                        )
                      }
                    />
                  </label>
                  <label>
                    {' '}
                    Multiplicidad destino{' '}
                    <input
                      value={r.targetMultiplicity}
                      onChange={(e) =>
                        setResult(
                          (old) =>
                            old && {
                              ...old,
                              relations: old.relations.map((item, n) =>
                                n === i ? { ...item, targetMultiplicity: e.target.value } : item,
                              ),
                            },
                        )
                      }
                    />
                  </label>
                </div>
              )}
              <button
                className="secondary"
                onClick={() =>
                  setResult(
                    (old) => old && { ...old, relations: old.relations.filter((_, n) => n !== i) },
                  )
                }
              >
                Quitar relación
              </button>
            </fieldset>
          ))}
          {result.classes.length > 1 && (
            <button
              className="secondary"
              onClick={() =>
                setResult(
                  (old) =>
                    old && {
                      ...old,
                      relations: [
                        ...old.relations,
                        {
                          source: old.classes[0].name,
                          target: old.classes[1].name,
                          type: 'association',
                          sourceMultiplicity: '',
                          targetMultiplicity: '',
                        },
                      ],
                    },
                )
              }
            >
              Completar otra relación
            </button>
          )}
          <p>Se agregarán al diagrama actual. Verifica nombres, tipos y relaciones.</p>
        </div>
      )}
      <div className="modal-actions">
        <button className="secondary" disabled={working} onClick={close}>
          Cerrar
        </button>
        <button
          className="primary"
          disabled={!result || busy || working}
          onClick={() => void apply()}
        >
          Agregar al diagrama
        </button>
      </div>
    </dialog>
  )
}
