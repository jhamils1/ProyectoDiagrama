import { useEffect, useState } from 'react'
import {
  projectCopies,
  type ProjectCopy,
  type OfflineProject,
} from '../modeling/infrastructure/projectCopies'
import { errorMessage } from '../../shared/api'
import { Modal } from './common'

export function ProjectCopiesPanel({
  userId,
  synchronization,
}: {
  userId: string
  synchronization: {
    syncing: boolean
    summary: string
    synchronize: () => void
  }
}) {
  const [copies, setCopies] = useState<ProjectCopy[]>([]),
    [error, setError] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const [projects, setProjects] = useState<OfflineProject[]>([])
  const [creating, setCreating] = useState(false),
    [busy, setBusy] = useState(false)
  const [projectId, setProjectId] = useState(''),
    [name, setName] = useState('Nuevo diagrama')
  useEffect(() => {
    let canceled = false
    const refresh = () =>
      void projectCopies()
        .list(userId)
        .then(async (values) => {
          const prepared = await projectCopies().projects(userId)
          if (!canceled) {
            setCopies(values)
            setProjects(prepared)
            setNow(Date.now())
          }
        })
        .catch((e) => {
          if (!canceled) {
            setCopies([])
            setProjects([])
            setError(errorMessage(e))
          }
        })
    refresh()
    const timer = setInterval(refresh, 2000)
    return () => {
      canceled = true
      clearInterval(timer)
    }
  }, [userId])
  return (
    <section className="workspace-content">
      <div className="content-title">
        <div>
          <span className="eyebrow">EN ESTE EQUIPO</span>
          <h1>Copias sin conexión</h1>
          <p>
            Crea y edita sin conexión. Los pendientes se envían con este espacio abierto, aunque sus
            editores estén cerrados.
          </p>
        </div>
        <button
          className="primary"
          disabled={
            !projects.some((p) => !p.denied && p.until > now && p.project.permiso !== 'CONSULTA')
          }
          onClick={() => {
            setProjectId(
              projects.find((p) => !p.denied && p.until > now && p.project.permiso !== 'CONSULTA')!
                .project.id,
            )
            setError('')
            setName('Nuevo diagrama')
            setCreating(true)
          }}
        >
          Nuevo diagrama sin conexión
        </button>
      </div>
      <p className="section-note">
        Prepara un proyecto desde su lista de diagramas, o una copia desde su editor. El acceso
        local dura 24 horas desde la última comprobación de cuenta y permiso. Cerrar sesión bloquea
        las copias y conserva los pendientes para esta cuenta.
      </p>
      <div className="update-banner">
        <span role="status">
          {synchronization.syncing ? 'Sincronizando copias pendientes…' : synchronization.summary}
        </span>
        <button disabled={synchronization.syncing} onClick={synchronization.synchronize}>
          Sincronizar pendientes
        </button>
      </div>
      <p className="section-note">
        Proyectos preparados: {projects.map((p) => p.project.nombre).join(', ') || 'ninguno'}. Si
        cierras toda la aplicación, el envío continuará al volver a abrirla.
      </p>
      {error && <p role="alert">{error}</p>}
      {!copies.length && !error && <p>Aún no preparaste diagramas en este navegador.</p>}
      <div className="project-grid">
        {copies.map((c) => (
          <article className="project-card" key={c.key}>
            <h2>{c.document.name}</h2>
            <p>{c.project.nombre}</p>
            <p>
              {c.denied || c.until <= now
                ? 'Requiere comprobar permiso con conexión'
                : c.creation
                  ? 'Diagrama nuevo pendiente de sincronizar'
                  : c.conflict
                    ? 'Conflicto pendiente'
                    : c.pending
                      ? 'Cambios pendientes de sincronizar'
                      : 'Sin pendientes'}
            </p>
            {c.syncError && <p className="auth-error">{c.syncError}</p>}
            <a
              className="text-button"
              href={`/workspace?project=${c.project.id}&diagram=${c.document.id}&offline=1`}
            >
              Abrir copia
            </a>
          </article>
        ))}
      </div>
      {creating && (
        <Modal title="Nuevo diagrama sin conexión" close={() => setCreating(false)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              setBusy(true)
              setError('')
              try {
                const copy = await projectCopies().create(userId, projectId, name)
                window.location.assign(
                  `/workspace?project=${projectId}&diagram=${copy.document.id}&offline=1`,
                )
              } catch (e) {
                setError(errorMessage(e))
              } finally {
                setBusy(false)
              }
            }}
          >
            <label>
              Proyecto preparado
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                disabled={busy}
                required
              >
                {projects
                  .filter((p) => !p.denied && p.until > now && p.project.permiso !== 'CONSULTA')
                  .map((p) => (
                    <option key={p.key} value={p.project.id}>
                      {p.project.nombre}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Nombre del diagrama
              <input
                value={name}
                maxLength={100}
                required
                disabled={busy}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <p className="hint">
              Se guardará primero en este equipo y se enviará cuando vuelva la conexión.
            </p>
            {error && (
              <p role="alert" className="auth-error">
                {error}
              </p>
            )}
            <div className="modal-actions">
              <button type="button" className="secondary" onClick={() => setCreating(false)}>
                Cancelar
              </button>
              <button className="primary" disabled={busy}>
                Crear en este equipo
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  )
}
