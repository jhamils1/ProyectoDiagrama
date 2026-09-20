import { useEffect, useState } from 'react'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import {
  api,
  errorMessage,
  type Member,
  type Project,
  type User,
  type PageResult,
} from '../../shared/api'
import { Modal, Pagination } from './common'

export function MembersPanel({
  project,
  back,
  report,
}: {
  project: Project
  back: () => void
  report: (error: unknown) => void
}) {
  const [data, setData] = useState<PageResult<Member>>({ items: [], total: 0, page: 0, size: 20 })
  const [page, setPage] = useState(0),
    [version, setVersion] = useState(0),
    [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false),
    [removing, setRemoving] = useState<Member | null>(null),
    [busy, setBusy] = useState(false)
  const [removeError, setRemoveError] = useState('')
  useEffect(() => {
    let canceled = false
    api<PageResult<Member>>(`/projects/${project.id}/members?page=${page}`)
      .then((result) => {
        if (!canceled) setData(result)
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
  }, [project.id, page, version, report])
  return (
    <section className="workspace-content">
      <button className="back-link" onClick={back}>
        <ArrowLeft size={14} />
        Todos los proyectos
      </button>
      <div className="content-title">
        <div>
          <span className="eyebrow">PARTICIPANTES Y PERMISOS</span>
          <h1>{project.nombre}</h1>
          <p>{project.descripcion || 'Organiza el equipo de este proyecto.'}</p>
        </div>
        <button className="primary" onClick={() => setAdding(true)}>
          <Plus size={16} />
          Agregar participante
        </button>
      </div>
      {loading ? (
        <p className="loading-copy">Cargando participantes…</p>
      ) : (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Colaborador</th>
                <th>Permiso</th>
                <th>Estado</th>
                <th>
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((m) => (
                <tr key={m.id}>
                  <td>
                    <strong>{m.usuario.nombre}</strong>
                    <span className="table-subtitle">{m.usuario.correo}</span>
                  </td>
                  <td>
                    <select
                      aria-label={`Permiso de ${m.usuario.nombre}`}
                      value={m.permiso}
                      disabled={busy}
                      onChange={async (e) => {
                        setBusy(true)
                        try {
                          await api(`/projects/${project.id}/members/${m.id}`, {
                            method: 'PUT',
                            body: JSON.stringify({ permiso: e.target.value, revision: m.revision }),
                          })
                          setVersion((v) => v + 1)
                        } catch (e) {
                          report(e)
                        } finally {
                          setBusy(false)
                        }
                      }}
                    >
                      <option value="CONSULTA">Consulta</option>
                      <option value="EDICION">Edición</option>
                    </select>
                  </td>
                  <td>{m.usuario.activo ? 'Activo' : 'Cuenta inactiva'}</td>
                  <td>
                    <button
                      className="icon-button danger"
                      aria-label={`Quitar participante ${m.usuario.nombre}`}
                      onClick={() => {
                        setRemoveError('')
                        setRemoving(m)
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.items.length === 0 && (
            <p className="table-empty">Este proyecto aún no tiene colaboradores.</p>
          )}
          <Pagination
            {...data}
            change={(p) => {
              setLoading(true)
              setPage(p)
            }}
          />
        </div>
      )}
      <p className="section-note">
        Consulta permite visualizar los diagramas. Edición permite crearlos y modificarlos dentro del
        proyecto.
      </p>
      {adding && (
        <AddMember
          projectId={project.id}
          close={() => setAdding(false)}
          saved={() => {
            setAdding(false)
            setVersion((v) => v + 1)
          }}
          report={report}
        />
      )}
      {removing && (
        <Modal title="Quitar participante" close={() => setRemoving(null)}>
          <p>
            Se quitará a {removing.usuario.nombre} de este proyecto. Su cuenta seguirá disponible.
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
                  await api(
                    `/projects/${project.id}/members/${removing.id}?revision=${removing.revision}`,
                    { method: 'DELETE' },
                  )
                  setRemoving(null)
                  setVersion((v) => v + 1)
                } catch (e) {
                  setRemoveError(errorMessage(e))
                  report(e)
                } finally {
                  setBusy(false)
                }
              }}
            >
              Quitar participante
            </button>
          </div>
        </Modal>
      )}
    </section>
  )
}
function AddMember({
  projectId,
  close,
  saved,
  report,
}: {
  projectId: string
  close: () => void
  saved: () => void
  report: (e: unknown) => void
}) {
  const [users, setUsers] = useState<PageResult<User>>({ items: [], total: 0, page: 0, size: 20 })
  const [page, setPage] = useState(0),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  useEffect(() => {
    let canceled = false
    api<PageResult<User>>(`/users?page=${page}`)
      .then((data) => {
        if (!canceled) setUsers(data)
      })
      .catch((e) => {
        if (!canceled) {
          setError(errorMessage(e))
          report(e)
        }
      })
    return () => {
      canceled = true
    }
  }, [page, report])
  const candidates = users.items.filter((u) => u.rol === 'COLABORADOR' && u.activo)
  return (
    <Modal title="Agregar participante" close={close}>
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          setError('')
          const data = new FormData(e.currentTarget)
          try {
            await api(`/projects/${projectId}/members`, {
              method: 'POST',
              body: JSON.stringify({
                usuarioId: data.get('usuarioId'),
                permiso: data.get('permiso'),
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
          Colaborador
          <select name="usuarioId" required key={page} defaultValue="">
            <option value="" disabled>
              Selecciona un colaborador
            </option>
            {candidates.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre} · {u.correo}
              </option>
            ))}
          </select>
        </label>
        <Pagination {...users} change={setPage} />
        {!candidates.length && (
          <p className="hint">
            No hay colaboradores activos en esta página. Crea una cuenta desde Usuarios o cambia de
            página.
          </p>
        )}
        <label>
          Permiso
          <select name="permiso" defaultValue="CONSULTA">
            <option value="CONSULTA">Consulta</option>
            <option value="EDICION">Edición</option>
          </select>
        </label>
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={close}>
            Cancelar
          </button>
          <button className="primary" disabled={busy || !candidates.length}>
            Guardar participante
          </button>
        </div>
      </form>
    </Modal>
  )
}
