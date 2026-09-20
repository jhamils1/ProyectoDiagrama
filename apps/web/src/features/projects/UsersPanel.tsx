import { useEffect, useState } from 'react'
import { Plus, Pencil, Users } from 'lucide-react'
import { api, errorMessage, type User, type PageResult } from '../../shared/api'
import { Modal, Pagination } from './common'

export function UsersPanel({ report }: { report: (error: unknown) => void }) {
  const [result, setResult] = useState<PageResult<User>>({ items: [], total: 0, page: 0, size: 20 })
  const [page, setPage] = useState(0),
    [version, setVersion] = useState(0),
    [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<User | 'new' | null>(null)
  useEffect(() => {
    let canceled = false
    api<PageResult<User>>(`/users?page=${page}`)
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
  return (
    <section className="workspace-content">
      <div className="content-title">
        <div>
          <span className="eyebrow">ADMINISTRACIÓN</span>
          <h1>Usuarios</h1>
          <p>Gestiona las cuentas de tus colaboradores.</p>
        </div>
        <button className="primary" onClick={() => setEditing('new')}>
          <Plus size={16} />
          Nuevo colaborador
        </button>
      </div>
      {loading ? (
        <p className="loading-copy">Cargando usuarios…</p>
      ) : (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Acceso</th>
                <th>Estado</th>
                <th>
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="table-user">
                      <span className="table-avatar">{u.nombre.slice(0, 1).toUpperCase()}</span>
                      <div>
                        <strong>{u.nombre}</strong>
                        <span>{u.correo}</span>
                      </div>
                    </div>
                  </td>
                  <td>{u.rol === 'ADMINISTRADOR' ? 'Administrador' : 'Colaborador'}</td>
                  <td>
                    {u.rol === 'ADMINISTRADOR'
                      ? 'Contraseña'
                      : u.googleVinculado
                        ? 'Google vinculado'
                        : 'Google pendiente'}
                  </td>
                  <td>
                    <span className={`state-pill ${u.activo ? 'active' : 'inactive'}`}>
                      {u.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td>
                    {u.rol === 'COLABORADOR' && (
                      <button
                        className="icon-button"
                        aria-label={`Editar usuario ${u.nombre}`}
                        onClick={() => setEditing(u)}
                      >
                        <Pencil size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination
            {...result}
            change={(p) => {
              setLoading(true)
              setPage(p)
            }}
          />
        </div>
      )}
      <p className="section-note">
        <Users size={15} />
        Crear una cuenta no asigna proyectos. La participación se gestiona dentro de cada proyecto.
      </p>
      {editing && (
        <UserForm
          value={editing}
          close={() => setEditing(null)}
          saved={() => {
            setEditing(null)
            setVersion((v) => v + 1)
          }}
          report={report}
        />
      )}
    </section>
  )
}
function UserForm({
  value,
  close,
  saved,
  report,
}: {
  value: User | 'new'
  close: () => void
  saved: () => void
  report: (e: unknown) => void
}) {
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  const isNew = value === 'new'
  return (
    <Modal title={isNew ? 'Nuevo colaborador' : 'Editar colaborador'} close={close}>
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          setError('')
          const data = new FormData(e.currentTarget)
          try {
            await api(`/users${isNew ? '' : `/${value.id}`}`, {
              method: isNew ? 'POST' : 'PUT',
              body: JSON.stringify(
                isNew
                  ? { nombre: data.get('nombre'), correo: data.get('correo') }
                  : {
                      nombre: data.get('nombre'),
                      activo: data.get('activo') === 'on',
                      revision: value.revision,
                    },
              ),
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
          Nombre del colaborador
          <input name="nombre" defaultValue={isNew ? '' : value.nombre} required maxLength={100} />
        </label>
        <label>
          Correo del colaborador
          <input
            name="correo"
            type="email"
            defaultValue={isNew ? '' : value.correo}
            disabled={!isNew}
            required
            maxLength={254}
          />
        </label>
        {!isNew && (
          <label className="checkbox">
            <input name="activo" type="checkbox" defaultChecked={value.activo} />
            Cuenta activa
          </label>
        )}
        <p className="hint">El colaborador accederá con Google. No se crea una contraseña local.</p>
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={close}>
            Cancelar
          </button>
          <button className="primary" disabled={busy}>
            {busy ? 'Guardando…' : 'Guardar colaborador'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
