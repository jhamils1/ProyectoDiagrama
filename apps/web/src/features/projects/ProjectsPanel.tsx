import { useEffect, useState } from 'react'
import { Plus, Folder, Users, Pencil, Trash2, ArrowUpRight } from 'lucide-react'
import { api, errorMessage, type Project, type PageResult } from '../../shared/api'
import { Modal, Pagination } from './common'
import { MembersPanel } from './MembersPanel'

export function ProjectsPanel({
  admin,
  report,
  onProjectsChanged,
}: {
  admin: boolean
  report: (e: unknown) => void
  onProjectsChanged?: () => void
}) {
  const [result, setResult] = useState<PageResult<Project>>({
    items: [],
    total: 0,
    page: 0,
    size: 12,
  })
  const [page, setPage] = useState(0),
    [version, setVersion] = useState(0),
    [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Project | 'new' | null>(null),
    [removing, setRemoving] = useState<Project | null>(null),
    [members, setMembers] = useState<Project | null>(null)
  const [busy, setBusy] = useState(false)
  const [removeError, setRemoveError] = useState('')
  useEffect(() => {
    let canceled = false
    api<PageResult<Project>>(`/projects?page=${page}&size=12`)
      .then((data) => {
        if (!canceled) setResult(data)
      })
      .catch((e) => {
        if (!canceled) report(e)
      })
      .finally(() => {
        if (!canceled) setLoading(false)
      })
    return () => {
      canceled = true
    }
  }, [page, version, report])
  if (members)
    return <MembersPanel project={members} back={() => setMembers(null)} report={report} />
  return (
    <section className="workspace-content">
      <div className="content-title">
        <div>
          <span className="eyebrow">TU ESPACIO DE TRABAJO</span>
          <h1>{admin ? 'Proyectos' : 'Mis proyectos'}</h1>
          <p>
            {admin
              ? 'Organiza modelos, personas y permisos en un mismo lugar.'
              : 'Aquí encontrarás los proyectos que te asignó el Administrador.'}
          </p>
        </div>
        {admin && (
          <button className="primary" onClick={() => setEditing('new')}>
            <Plus size={17} />
            Nuevo proyecto
          </button>
        )}
      </div>
      {loading ? (
        <p className="loading-copy">Cargando proyectos…</p>
      ) : result.items.length === 0 ? (
        <div className="projects-empty">
          <span>
            <Folder size={32} />
          </span>
          <h2>
            {admin ? 'Tu primer proyecto empieza aquí' : 'Todavía no tienes proyectos asignados'}
          </h2>
          <p>
            {admin
              ? 'Crea un proyecto y agrega a los colaboradores de tu equipo.'
              : 'Tu cuenta está lista. El Administrador debe asignarte acceso a un proyecto.'}
          </p>
          {admin && (
            <button className="primary" onClick={() => setEditing('new')}>
              <Plus size={16} />
              Crear proyecto
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="project-grid">
            {result.items.map((p) => (
              <article className="project-card" key={p.id}>
                <div className="project-card-top">
                  <span className="project-folder">
                    <Folder size={22} />
                  </span>
                  <span className="permission-pill">
                    {p.permiso === 'ADMINISTRACION'
                      ? 'Administración'
                      : p.permiso === 'EDICION'
                        ? 'Edición'
                        : 'Consulta'}
                  </span>
                </div>
                <h2>{p.nombre}</h2>
                <p>{p.descripcion || 'Sin descripción.'}</p>
                <span className="project-date">
                  Creado el {new Date(p.fechaCreacion).toLocaleDateString('es-BO')}
                </span>
                <div className="project-card-actions">
                  <a className="text-button" href={`/workspace?project=${p.id}`}>
                    Diagramas <ArrowUpRight size={15} />
                  </a>
                  {admin ? (
                    <>
                      <button className="text-button" onClick={() => setMembers(p)}>
                        <Users size={15} />
                        Participantes
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`Editar proyecto ${p.nombre}`}
                        onClick={() => setEditing(p)}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        className="icon-button danger"
                        aria-label={`Eliminar proyecto ${p.nombre}`}
                        onClick={() => {
                          setRemoveError('')
                          setRemoving(p)
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
          <Pagination
            {...result}
            change={(p) => {
              setLoading(true)
              setPage(p)
            }}
          />
        </>
      )}
      <div className="local-drafts-callout">
        <div>
          <strong>Tu espacio de modelado local sigue disponible</strong>
          <p>
            Puedes copiar un borrador desde la lista de diagramas de un proyecto. El original se
            conserva en este navegador.
          </p>
        </div>
        <a href="/">
          Abrir editor local <ArrowUpRight size={16} />
        </a>
      </div>
      {editing && (
        <ProjectForm
          value={editing}
          close={() => setEditing(null)}
          saved={() => {
            setEditing(null)
            setVersion((v) => v + 1)
            onProjectsChanged?.()
          }}
          report={report}
        />
      )}
      {removing && (
        <Modal title="Eliminar proyecto" close={() => setRemoving(null)}>
          <p>
            «{removing.nombre}» dejará de estar disponible para sus participantes. Se conservará su
            registro en el servidor.
          </p>
          {removeError && (
            <p className="auth-error" role="alert">
              {removeError}
            </p>
          )}
          <div className="modal-actions">
            <button className="secondary" onClick={() => setRemoving(null)}>
              Cancelar
            </button>
            <button
              className="destructive"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                try {
                  await api(`/projects/${removing.id}?revision=${removing.revision}`, {
                    method: 'DELETE',
                  })
                  setRemoving(null)
                  setVersion((v) => v + 1)
                  onProjectsChanged?.()
                } catch (e) {
                  setRemoveError(errorMessage(e))
                  report(e)
                } finally {
                  setBusy(false)
                }
              }}
            >
              Confirmar eliminación
            </button>
          </div>
        </Modal>
      )}
    </section>
  )
}
function ProjectForm({
  value,
  close,
  saved,
  report,
}: {
  value: Project | 'new'
  close: () => void
  saved: () => void
  report: (e: unknown) => void
}) {
  const isNew = value === 'new'
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  return (
    <Modal title={isNew ? 'Nuevo proyecto' : 'Editar proyecto'} close={close}>
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          setError('')
          const data = new FormData(e.currentTarget)
          try {
            await api(`/projects${isNew ? '' : `/${value.id}`}`, {
              method: isNew ? 'POST' : 'PUT',
              body: JSON.stringify({
                nombre: data.get('nombre'),
                descripcion: data.get('descripcion'),
                ...(!isNew ? { revision: value.revision } : {}),
              }),
            })
            saved()
          } catch (e) {
            setError(errorMessage(e))
            report(e)
          } finally {
            setBusy(false)
          }
        }}
      >
        <label>
          Nombre del proyecto
          <input
            name="nombre"
            required
            maxLength={100}
            defaultValue={isNew ? '' : value.nombre}
            placeholder="Por ejemplo, Sistema de inventario"
          />
        </label>
        <label>
          Descripción
          <textarea
            name="descripcion"
            rows={4}
            maxLength={2000}
            defaultValue={isNew ? '' : value.descripcion}
            placeholder="¿Qué quieres construir?"
          />
        </label>
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button className="secondary" type="button" onClick={close}>
            Cancelar
          </button>
          <button className="primary" disabled={busy}>
            {busy ? 'Guardando…' : 'Guardar proyecto'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
