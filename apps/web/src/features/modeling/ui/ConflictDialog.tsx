import { useEffect, useRef, useState } from 'react'
import type { ConflictChoice, ProposalResponse } from '../application/useProjectEditor'

function describe(value: unknown, entities: Record<string, string> = {}): string {
  if (value === null || value === undefined) return 'Elemento eliminado / ausente'
  if (typeof value === 'boolean') return value ? 'Sí' : 'No'
  if (typeof value !== 'object') return entities[String(value)] ?? (String(value) || '(vacío)')
  const item = value as Record<string, unknown>
  if (Array.isArray(item.classes)) {
    const classes = item.classes as { id: string; name: string }[]
    const names = Object.fromEntries(classes.map((c) => [c.id, c.name]))
    const relations = Array.isArray(item.relations) ? item.relations : []
    return `${item.name}\nClases (${classes.length}):\n${classes.map((c) => describe(c, names)).join('\n') || 'Ninguna'}\nRelaciones (${relations.length}):\n${relations.map((r) => describe(r, names)).join('\n') || 'Ninguna'}`
  }
  return Object.entries(item)
    .filter(([key]) => key !== 'id')
    .map(([key, v]) => {
      const names: Record<string, string> = {
        name: 'Nombre',
        abstract: 'Abstracta',
        attributes: 'Atributos',
        methods: 'Métodos',
        returnType: 'Tipo de retorno',
        position: 'Posición',
        dataType: 'Tipo',
        visibility: 'Visibilidad',
        identifier: 'Identificador',
        required: 'Obligatorio',
        sourceId: 'Origen',
        targetId: 'Destino',
        type: 'Tipo',
        sourceMultiplicity: 'Multiplicidad origen',
        targetMultiplicity: 'Multiplicidad destino',
      }
      return `${names[key] ?? key}: ${Array.isArray(v) ? v.map((item) => describe(item, entities)).join('; ') || 'Ninguno' : describe(v, entities)}`
    })
    .join(' · ')
}

export function ConflictDialog({
  proposal,
  busy,
  error,
  close,
  resolve,
}: {
  proposal: ProposalResponse
  busy: boolean
  error: string | null
  close: () => void
  resolve: (choices: Record<string, ConflictChoice>, discard?: boolean) => Promise<void>
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const [choices, setChoices] = useState<Record<string, ConflictChoice>>({})
  useEffect(() => {
    ref.current?.showModal()
  }, [])
  const complete = proposal.conflicts.every((c) => !!choices[c.path])
  const entities = Object.fromEntries(
    [...proposal.proposed.classes, ...proposal.current.document.classes].map((c) => [c.id, c.name]),
  )
  return (
    <dialog
      ref={ref}
      className="modal conflict-dialog"
      aria-labelledby="conflict-title"
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) close()
      }}
    >
      <h2 id="conflict-title">Resolver cambios</h2>
      <p>
        Tu propuesta está guardada. Compara la base, tu cambio y el servidor (revisión{' '}
        {proposal.comparedRevision}). Los cambios compatibles se conservarán juntos.
      </p>
      {!proposal.conflicts.length && (
        <p>Los cambios ahora son compatibles. Puedes combinarlos y guardarlos.</p>
      )}
      {proposal.conflicts.map((conflict, index) => {
        const choice = choices[conflict.path]
        const simple =
          conflict.local !== null && ['string', 'number', 'boolean'].includes(typeof conflict.local)
        return (
          <fieldset key={conflict.path} disabled={busy} className="conflict-field">
            <legend>{conflict.label}</legend>
            {conflict.path === '/' && (
              <p>
                La combinación no cumple las reglas UML. Elegir un modelo completo descarta los
                cambios exclusivos de la otra propuesta. Revisa ambos antes de continuar.
              </p>
            )}
            <dl className="conflict-values">
              <dt>Base</dt>
              <dd>{describe(conflict.base, entities)}</dd>
              <dt>Mi propuesta</dt>
              <dd>{describe(conflict.local, entities)}</dd>
              <dt>Servidor</dt>
              <dd>{describe(conflict.server, entities)}</dd>
            </dl>
            <label>
              Elección para {conflict.label}
              <select
                aria-label={`Elección ${index + 1}`}
                value={choice?.source ?? ''}
                onChange={(e) =>
                  setChoices((previous) => ({
                    ...previous,
                    [conflict.path]: {
                      source: e.target.value as ConflictChoice['source'],
                      value: conflict.local,
                    },
                  }))
                }
              >
                <option value="" disabled>
                  Selecciona una opción
                </option>
                <option value="local">Conservar mi propuesta</option>
                <option value="server">Conservar el servidor</option>
                {simple && <option value="custom">Introducir otro valor</option>}
              </select>
            </label>
            {choice?.source === 'custom' && (
              <label>
                Nuevo valor
                {typeof conflict.local === 'boolean' ? (
                  <select
                    aria-label={`Nuevo valor ${index + 1}`}
                    value={String(choice.value)}
                    onChange={(e) =>
                      setChoices((p) => ({
                        ...p,
                        [conflict.path]: { source: 'custom', value: e.target.value === 'true' },
                      }))
                    }
                  >
                    <option value="true">Sí</option>
                    <option value="false">No</option>
                  </select>
                ) : (
                  <input
                    aria-label={`Nuevo valor ${index + 1}`}
                    type={typeof conflict.local === 'number' ? 'number' : 'text'}
                    value={String(choice.value ?? '')}
                    onChange={(e) =>
                      setChoices((p) => ({
                        ...p,
                        [conflict.path]: {
                          source: 'custom',
                          value:
                            typeof conflict.local === 'number'
                              ? e.target.value === ''
                                ? null
                                : Number(e.target.value)
                              : e.target.value,
                        },
                      }))
                    }
                  />
                )}
              </label>
            )}
          </fieldset>
        )
      })}
      {error && <p role="alert">{error}</p>}
      <div className="modal-actions">
        <button className="secondary" disabled={busy} onClick={close}>
          Dejar pendiente
        </button>
        <button
          className="destructive"
          disabled={busy}
          onClick={() => {
            if (window.confirm('¿Descartar tu propuesta guardada y conservar el diagrama actual?'))
              void resolve({}, true)
          }}
        >
          Descartar mi propuesta
        </button>
        <button
          className="primary"
          disabled={busy || !complete}
          onClick={() => void resolve(choices)}
        >
          Guardar resolución
        </button>
      </div>
    </dialog>
  )
}
