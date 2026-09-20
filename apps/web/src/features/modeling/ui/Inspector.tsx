import { useState, type FormEvent } from 'react'
import { Plus, Trash2, Pencil, Box, X } from 'lucide-react'
import {
  dataTypes,
  visibilities,
  type UmlAttribute,
  type UmlClass,
  type ModelCommand,
} from '../domain/model'

type Props = {
  value: UmlClass
  busy: boolean
  execute: (command: ModelCommand) => Promise<boolean>
  onDelete: () => void
}
export function Inspector({ value, execute, onDelete, busy }: Props) {
  const [name, setName] = useState(value.name)
  const [abstract, setAbstract] = useState(value.abstract)
  const [editing, setEditing] = useState<UmlAttribute | null>(null)
  function newAttribute() {
    setEditing({
      id: crypto.randomUUID(),
      name: '',
      dataType: 'String',
      visibility: 'private',
      identifier: false,
      required: false,
    })
  }
  async function saveClass(event: FormEvent) {
    event.preventDefault()
    await execute({ type: 'updateClass', id: value.id, name, abstract })
  }
  return (
    <aside className="inspector" aria-label="Propiedades de la clase">
      <div className="panel-heading">
        <span>PROPIEDADES</span>
        <Box size={16} />
      </div>
      <h2>{value.name}</h2>
      <p className="muted small">Define la estructura de tu clase.</p>
      <form onSubmit={saveClass} className="property-form">
        <label>
          Nombre de la clase
          <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={abstract}
            onChange={(e) => setAbstract(e.target.checked)}
          />
          Clase abstracta
        </label>
        <button
          type="submit"
          className="secondary full"
          disabled={busy || (name === value.name && abstract === value.abstract)}
        >
          Guardar propiedades
        </button>
      </form>
      <div className="section-row">
        <h3>
          Atributos <span className="count">{value.attributes.length}</span>
        </h3>
        <button
          className="icon-button"
          onClick={newAttribute}
          aria-label="Agregar atributo"
          disabled={busy}
        >
          <Plus size={17} />
        </button>
      </div>
      {value.attributes.length === 0 && !editing && (
        <div className="empty-attributes">
          <p>Todavía no hay atributos.</p>
          <button className="text-button" onClick={newAttribute}>
            Agregar el primero
          </button>
        </div>
      )}
      <div className="attribute-list">
        {value.attributes.map((a) => (
          <div key={a.id} className="attribute-row">
            <button
              className="attribute-edit"
              onClick={() => setEditing(a)}
              aria-label={`Editar atributo ${a.name}`}
            >
              <strong>{a.name}</strong>
              <span>
                {a.dataType}
                {a.identifier ? ' · ID' : ''}
              </span>
              <Pencil size={13} />
            </button>
            <button
              className="icon-button danger"
              disabled={busy}
              aria-label={`Eliminar atributo ${a.name}`}
              onClick={() => void execute({ type: 'deleteAttribute', classId: value.id, id: a.id })}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
      {editing && (
        <form
          className="attribute-form"
          onSubmit={async (e) => {
            e.preventDefault()
            if (await execute({ type: 'upsertAttribute', classId: value.id, value: editing }))
              setEditing(null)
          }}
        >
          <div className="section-row">
            <h3>
              {value.attributes.some((a) => a.id === editing.id)
                ? 'Editar atributo'
                : 'Nuevo atributo'}
            </h3>
            <button
              type="button"
              className="icon-button"
              onClick={() => setEditing(null)}
              aria-label="Cancelar atributo"
            >
              <X size={15} />
            </button>
          </div>
          <label>
            Nombre del atributo
            <input
              autoFocus
              required
              maxLength={80}
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              placeholder="nombre"
            />
          </label>
          <label>
            Tipo de dato
            <select
              value={editing.dataType}
              onChange={(e) =>
                setEditing({ ...editing, dataType: e.target.value as UmlAttribute['dataType'] })
              }
            >
              {dataTypes.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label>
            Visibilidad
            <select
              value={editing.visibility}
              onChange={(e) =>
                setEditing({ ...editing, visibility: e.target.value as UmlAttribute['visibility'] })
              }
            >
              {visibilities.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={editing.identifier}
              onChange={(e) =>
                setEditing({
                  ...editing,
                  identifier: e.target.checked,
                  required: e.target.checked || editing.required,
                })
              }
            />
            Identificador
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={editing.required}
              disabled={editing.identifier}
              onChange={(e) => setEditing({ ...editing, required: e.target.checked })}
            />
            Obligatorio
          </label>
          <button className="primary full" disabled={busy}>
            Guardar atributo
          </button>
        </form>
      )}
      <div className="inspector-bottom">
        <button className="danger-button" onClick={onDelete} disabled={busy}>
          <Trash2 size={15} />
          Eliminar clase
        </button>
      </div>
    </aside>
  )
}
