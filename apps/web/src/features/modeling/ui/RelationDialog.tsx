import { useEffect, useRef, useState } from 'react'
import { X, ArrowRight } from 'lucide-react'
import type { Diagram, ModelCommand, UmlRelation } from '../domain/model'

type MultiplicityPreset = 'one-to-many' | 'one-to-one' | 'many-to-many' | 'custom'

function presetFor(value: UmlRelation): MultiplicityPreset {
  if (value.sourceMultiplicity === '1' && value.targetMultiplicity === '0..*') return 'one-to-many'
  if (value.sourceMultiplicity === '1' && value.targetMultiplicity === '0..1') return 'one-to-one'
  if ((value.sourceMultiplicity === '*' || value.sourceMultiplicity.endsWith('..*')) &&
      (value.targetMultiplicity === '*' || value.targetMultiplicity.endsWith('..*'))) return 'many-to-many'
  return 'custom'
}

export function RelationDialog({
  diagram,
  initial,
  close,
  execute,
  busy,
  error,
}: {
  diagram: Diagram
  initial: UmlRelation
  close: () => void
  busy: boolean
  execute: (command: ModelCommand) => Promise<boolean>
  error: string | null
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const [value, setValue] = useState(initial)
  const [preset, setPreset] = useState<MultiplicityPreset>(() => presetFor(initial))
  const [failure, setFailure] = useState(false)
  useEffect(() => {
    ref.current?.showModal()
  }, [])
  const editing = diagram.relations.some((r) => r.id === initial.id)
  return (
    <dialog ref={ref} onCancel={close} className="modal">
      <div className="modal-heading">
        <div>
          <span className="eyebrow">MODELADO UML</span>
          <h2>{editing ? 'Editar relación' : 'Conectar clases'}</h2>
        </div>
        <button className="icon-button" aria-label="Cerrar relación" onClick={close}>
          <X size={20} />
        </button>
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          const ok = await execute({ type: 'upsertRelation', value })
          if (ok) close()
          else setFailure(true)
        }}
      >
        <label>
          Tipo de relación
          <select
            value={value.type}
            onChange={(e) => setValue({ ...value, type: e.target.value as UmlRelation['type'] })}
          >
            <option value="association">Asociación</option>
            <option value="generalization">Generalización / herencia</option>
          </select>
        </label>
        <div className="relation-endpoints">
          <label>
            {value.type === 'generalization' ? 'Subclase' : 'Clase de origen'}
            <select
              value={value.sourceId}
              onChange={(e) => setValue({ ...value, sourceId: e.target.value })}
            >
              {diagram.classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <ArrowRight size={18} />
          <label>
            {value.type === 'generalization' ? 'Superclase' : 'Clase de destino'}
            <select
              value={value.targetId}
              onChange={(e) => setValue({ ...value, targetId: e.target.value })}
            >
              {diagram.classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Nombre de la relación <span className="muted">(opcional)</span>
          <input
            value={value.name}
            maxLength={80}
            onChange={(e) => setValue({ ...value, name: e.target.value })}
            placeholder="Por ejemplo, contiene"
          />
        </label>
        {value.type === 'association' && (
          <>
            <label>
              Tipo de multiplicidad
              <select
                value={preset}
                onChange={(e) => {
                  const next = e.target.value as MultiplicityPreset
                  setPreset(next)
                  if (next === 'one-to-many') {
                    setValue({ ...value, sourceMultiplicity: '1', targetMultiplicity: '0..*' })
                  } else if (next === 'one-to-one') {
                    setValue({ ...value, sourceMultiplicity: '1', targetMultiplicity: '0..1' })
                  } else if (next === 'many-to-many') {
                    setValue({ ...value, sourceMultiplicity: '*', targetMultiplicity: '0..*' })
                  }
                }}
              >
                <option value="one-to-many">Uno a muchos (1 — 0..*)</option>
                <option value="one-to-one">Uno a uno (1 — 0..1)</option>
                <option value="many-to-many">Muchos a muchos (* — 0..*)</option>
                <option value="custom">Personalizada</option>
              </select>
            </label>
            {preset === 'custom' && (
          <div className="form-columns">
            <label>
              Multiplicidad de origen
              <input
                value={value.sourceMultiplicity}
                required
                onChange={(e) => setValue({ ...value, sourceMultiplicity: e.target.value })}
              />
            </label>
            <label>
              Multiplicidad de destino
              <input
                value={value.targetMultiplicity}
                required
                onChange={(e) => setValue({ ...value, targetMultiplicity: e.target.value })}
              />
            </label>
          </div>
            )}
          </>
        )}
        {value.type === 'generalization' && (
          <p className="hint">
            La flecha apunta a la superclase. No se permiten ciclos ni herencia múltiple en esta
            versión.
          </p>
        )}
        {failure && (
          <p className="form-error" role="alert">
            {error ??
              'No se guardó la relación. Intenta nuevamente cuando termine el guardado actual.'}
          </p>
        )}
        <div className="modal-actions">
          {editing && (
            <button
              type="button"
              className="danger-button"
              disabled={busy}
              onClick={async () => {
                if (await execute({ type: 'deleteRelation', id: value.id })) close()
              }}
            >
              Eliminar relación
            </button>
          )}
          <button type="button" className="secondary" onClick={close}>
            Cancelar
          </button>
          <button className="primary" disabled={busy}>
            Guardar relación
          </button>
        </div>
      </form>
    </dialog>
  )
}
