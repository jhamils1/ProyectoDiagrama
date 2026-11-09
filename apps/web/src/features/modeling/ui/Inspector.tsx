import { useLayoutEffect, useState, useRef, useEffect } from 'react'
import { Plus, Trash2, Pencil, X } from 'lucide-react'
import {
  dataTypes,
  visibilities,
  type UmlAttribute,
  type UmlMethod,
  type UmlClass,
  type ModelCommand,
} from '../domain/model'

type Props = {
  value: UmlClass
  busy: boolean
  readOnly?: boolean
  execute: (command: ModelCommand) => Promise<boolean>
  onDelete: () => void
  setEditing?: (area: string, pending: boolean) => void
}
export function Inspector({
  value,
  execute,
  onDelete,
  busy,
  readOnly = false,
  setEditing: notifyEditing,
}: Props) {
  const [name, setName] = useState(value.name)
  const [abstract, setAbstract] = useState(value.abstract)
  const [editing, setEditing] = useState<UmlAttribute | null>(null)
  const [editingMethod, setEditingMethod] = useState<UmlMethod | null>(null)
  const classDirty = name !== value.name || abstract !== value.abstract
  const pending = classDirty || !!editing || !!editingMethod
  const locked = busy || readOnly
  const classForm = useRef<HTMLFormElement>(null)
  const attributeForm = useRef<HTMLFormElement>(null)
  const methodForm = useRef<HTMLFormElement>(null)
  const committing = useRef(false)
  useLayoutEffect(() => {
    notifyEditing?.('inspector', pending)
    return () => notifyEditing?.('inspector', false)
  }, [notifyEditing, pending])
  function newAttribute() {
    setEditing({
      id: crypto.randomUUID(),
      name: '',
      dataType: '',
      visibility: 'private',
      identifier: false,
      required: false,
    })
  }
  async function commit() {
    if (committing.current || locked) return
    if (!classDirty && !editing && !editingMethod) return
    if (editingMethod && !editingMethod.name.trim() && !(value.methods ?? []).some(m => m.id === editingMethod.id)) {
      setEditingMethod(null)
      return
    }
    if (editing && !editing.name.trim() && !value.attributes.some((a) => a.id === editing.id)) {
      setEditing(null)
      return
    }
    const form = editingMethod ? methodForm.current : editing ? attributeForm.current : classForm.current
    if (!form?.reportValidity()) return
    committing.current = true
    try {
      if (editingMethod) {
        const original = (value.methods ?? []).find(m => m.id === editingMethod.id)
        if (JSON.stringify(original) === JSON.stringify(editingMethod) ||
          (await execute({ type: 'upsertMethod', classId: value.id, value: editingMethod }))) setEditingMethod(null)
      } else if (editing) {
        const original = value.attributes.find((a) => a.id === editing.id)
        if (
          JSON.stringify(original) === JSON.stringify(editing) ||
          (await execute({ type: 'upsertAttribute', classId: value.id, value: editing }))
        )
          setEditing(null)
      } else await execute({ type: 'updateClass', id: value.id, name, abstract })
    } finally {
      committing.current = false
    }
  }
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      const form = editingMethod ? methodForm.current : editing ? attributeForm.current : classForm.current
      if (!pending || form?.contains(event.target as Node)) return
      // Keep the selected element and invalid fields until the asynchronous save finishes.
      event.preventDefault()
      event.stopPropagation()
      const stopClick = (click: MouseEvent) => {
        click.preventDefault()
        click.stopPropagation()
      }
      document.addEventListener('click', stopClick, { capture: true, once: true })
      window.setTimeout(() => document.removeEventListener('click', stopClick, true), 1000)
      void commit()
    }
    document.addEventListener('pointerdown', outside, true)
    return () => document.removeEventListener('pointerdown', outside, true)
  })
  const leaveForm = (event: React.FocusEvent<HTMLFormElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) void commit()
  }
  const attributeEditor = editing ? (
    <form
      className="attribute-form"
      ref={attributeForm}
      onBlur={leaveForm}
      onSubmit={(e) => {
        e.preventDefault()
        void commit()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          setEditing(null)
        }
      }}
    >
      <div className="section-row">
        <h3>
          {value.attributes.some((a) => a.id === editing.id) ? 'Editar atributo' : 'Nuevo atributo'}
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
      <div className="attribute-inline-fields">
        <label>
          Nombre del atributo
          <input
            autoFocus
            disabled={locked}
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
            disabled={locked}
            value={editing.dataType}
            onChange={(e) =>
              setEditing({ ...editing, dataType: e.target.value as UmlAttribute['dataType'] })
            }
          >
            <option value="">Sin tipo</option>
            {dataTypes.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
      </div>
      <details className="attribute-options">
        <summary>Opciones UML</summary>
        <label>
          Visibilidad
          <select
            disabled={locked}
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
            disabled={locked}
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
            disabled={locked || editing.identifier}
            onChange={(e) => setEditing({ ...editing, required: e.target.checked })}
          />
          Obligatorio
        </label>
      </details>
    </form>
  ) : null
  return (
    <aside className="inspector uml-inspector" aria-label="Propiedades de la clase">
      <h2 className="inspector-section-title">CLASE</h2>
      <form
        ref={classForm}
        onBlur={leaveForm}
        onSubmit={(e) => {
          e.preventDefault()
          void commit()
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setName(value.name)
            setAbstract(value.abstract)
          }
        }}
        className="property-form"
      >
        <label>
          Nombre
          <input
            disabled={locked || !!editing || !!editingMethod}
            aria-label="Nombre de la clase"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={80}
          />
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            aria-label="Clase abstracta"
            disabled={locked || !!editing || !!editingMethod}
            checked={abstract}
            onChange={(e) => setAbstract(e.target.checked)}
          />
          Abstracta
        </label>
      </form>
      <div className="section-row">
        <h3>
          Atributos <span className="count">{value.attributes.length}</span>
        </h3>
        <button
          className="icon-button"
          onClick={newAttribute}
          aria-label="Agregar atributo"
          disabled={locked || classDirty || !!editing || !!editingMethod}
          title="Agregar atributo"
        >
          <Plus size={17} />
        </button>
      </div>
      {value.attributes.length === 0 && !editing && (
        <div className="empty-attributes">
          <p>Todavía no hay atributos.</p>
          <button className="text-button" onClick={newAttribute} disabled={locked || classDirty || !!editingMethod}>
            Nuevo atributo…
          </button>
        </div>
      )}
      <div className="attribute-table-heading">
        <span>Nombre</span>
        <span>Tipo</span>
      </div>
      <div className="attribute-list">
        {value.attributes.map((a) =>
          editing?.id === a.id ? (
            <div key={a.id}>{attributeEditor}</div>
          ) : (
            <div key={a.id} className="attribute-row">
              <button
                className="attribute-edit"
                disabled={locked || classDirty || !!editing || !!editingMethod}
                onClick={() => setEditing(a)}
                aria-label={`Editar atributo ${a.name}`}
              >
                <span className="attribute-signature">
                  <strong>{a.name}</strong>
                  <span className="attribute-datatype">{a.dataType || 'Sin tipo'}</span>
                  {a.identifier && <small className="count">ID</small>}
                </span>
                <Pencil size={13} />
              </button>
              <button
                className="icon-button danger"
                disabled={locked || classDirty || !!editing || !!editingMethod}
                aria-label={`Eliminar atributo ${a.name}`}
                onClick={() =>
                  void execute({ type: 'deleteAttribute', classId: value.id, id: a.id })
                }
              >
                <Trash2 size={14} />
              </button>
            </div>
          ),
        )}
      </div>
      {editing && !value.attributes.some((a) => a.id === editing.id) && attributeEditor}
      <div className="section-row">
        <h3>Métodos <span className="count">{value.methods?.length ?? 0}</span></h3>
        <button type="button" className="icon-button" aria-label="Agregar método" disabled={locked || classDirty || !!editing || !!editingMethod}
          onClick={() => setEditingMethod({ id: crypto.randomUUID(), name: '', returnType: '', visibility: 'public' })}><Plus size={17} /></button>
      </div>
      {(value.methods ?? []).map(method => <div className="attribute-row" key={method.id}>
        <button type="button" className="attribute-edit" disabled={locked || pending} onClick={() => setEditingMethod(method)}
          aria-label={`Editar método ${method.name}`}><span>{method.name}(){method.returnType ? `: ${method.returnType}` : ''}</span><Pencil size={13} /></button>
        <button type="button" className="icon-button danger" disabled={locked || pending} aria-label={`Eliminar método ${method.name}`}
          onClick={() => void execute({ type: 'deleteMethod', classId: value.id, id: method.id })}><Trash2 size={14} /></button>
      </div>)}
      {editingMethod && <form ref={methodForm} className="attribute-form" onBlur={leaveForm} onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); setEditingMethod(null) }
      }} onSubmit={event => {
        event.preventDefault()
        void commit()
      }}>
        <label>Nombre del método<input required maxLength={80} value={editingMethod.name} disabled={locked}
          onChange={event => setEditingMethod({ ...editingMethod, name: event.target.value })} /></label>
        <label>Tipo de retorno<select value={editingMethod.returnType} disabled={locked}
          onChange={event => setEditingMethod({ ...editingMethod, returnType: event.target.value as UmlMethod['returnType'] })}>
          <option value="">Sin tipo</option><option value="void">void (sin retorno)</option>{dataTypes.map(type => <option key={type}>{type}</option>)}
        </select></label>
        <label>Visibilidad del método<select value={editingMethod.visibility} disabled={locked}
          onChange={event => setEditingMethod({ ...editingMethod, visibility: event.target.value as UmlMethod['visibility'] })}>
          {visibilities.map(visibility => <option key={visibility}>{visibility}</option>)}
        </select></label>
        <button type="submit" className="primary" disabled={locked}>Guardar método</button>
        <button type="button" className="secondary" onClick={() => setEditingMethod(null)}>Cancelar</button>
      </form>}
      <p className="section-note">Los métodos se muestran en el diagrama; no se incluyen en el backend generado.</p>
      <div className="inspector-bottom">
        <button className="danger-button" onClick={onDelete} disabled={locked || !!editingMethod}>
          <Trash2 size={15} />
          Eliminar clase
        </button>
      </div>
    </aside>
  )
}
