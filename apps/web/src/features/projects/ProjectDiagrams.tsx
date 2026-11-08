import { copyLocalDiagram } from '../modeling/domain/copyDiagram'
import { useEffect, useRef, useState } from 'react'
import { Plus, ArrowLeft, Layers3, Trash2, Upload } from 'lucide-react'
import { api, errorMessage, type Project, type PageResult, type User } from '../../shared/api'
import { createDiagram, type Diagram } from '../modeling/domain/model'
import { diagramRepository } from '../modeling/infrastructure/diagramRepository'
import { useProjectEditor, type DiagramEnvelope } from '../modeling/application/useProjectEditor'
import { EditorView } from '../../App'
import { Modal, Pagination } from './common'
import { ConflictDialog } from '../modeling/ui/ConflictDialog'
import { projectCopies } from '../modeling/infrastructure/projectCopies'
import { ImportXmiDialog } from '../interoperability/ImportXmiDialog'
import { OfflineProjectEditor } from '../modeling/ui/OfflineProjectEditor'

type Summary = {
  id: string
  name: string
  revision: number
  versionActual: number
  updatedAt: string
}
const href = (project: string, diagram?: string) =>
  `/workspace?project=${encodeURIComponent(project)}${diagram ? `&diagram=${encodeURIComponent(diagram)}` : ''}`

export function ProjectDiagrams({
  userId,
  currentUser,
  projectId,
  diagramId,
}: {
  userId: string
  currentUser?: Pick<User, 'nombre' | 'rol'>
  projectId: string
  diagramId: string | null
}) {
  const [project, setProject] = useState<Project | null>(null),
    [error, setError] = useState('')
  useEffect(() => {
    let canceled = false
    api<Project>(`/projects/${projectId}`)
      .then((p) => {
        if (!canceled) setProject(p)
      })
      .catch((e) => {
        if (!canceled) setError(errorMessage(e))
      })
    return () => {
      canceled = true
    }
  }, [projectId])
  if (!project)
    return (
      <main className="workspace-content">
        <a className="back-link" href="/workspace">
          Volver a proyectos
        </a>
        <p role="status">{error || 'Abriendo proyecto…'}</p>
      </main>
    )
  if (diagramId)
    return <ProjectEditor key={diagramId} userId={userId} currentUser={currentUser} project={project} diagramId={diagramId} />
  return <DiagramList project={project} />
}
function ProjectEditor({
  userId,
  currentUser,
  project,
  diagramId,
}: {
  userId: string
  currentUser?: Pick<User, 'nombre' | 'rol'>
  project: Project
  diagramId: string
}) {
  const [offline, setOffline] = useState(() => !navigator.onLine)
  useEffect(() => {
    const goOffline = () => setOffline(true)
    window.addEventListener('offline', goOffline)
    return () => window.removeEventListener('offline', goOffline)
  }, [])
  if (offline)
    return <OfflineProjectEditor userId={userId} currentUser={currentUser} projectId={project.id} diagramId={diagramId} />
  return <OnlineProjectEditor userId={userId} currentUser={currentUser} project={project} diagramId={diagramId} />
}

function OnlineProjectEditor({
  userId,
  currentUser,
  project,
  diagramId,
}: {
  userId: string
  currentUser?: Pick<User, 'nombre' | 'rol'>
  project: Project
  diagramId: string
}) {
  const state = useProjectEditor(project.id, diagramId)
  useEffect(() => {
    if (!state.envelope) return
    void projectCopies().prepare(userId, project, state.envelope).catch(() => {})
  }, [userId, project, state.envelope])
  return (
    <>
      <EditorView
        currentUser={currentUser}
        key={`${state.generation}:${state.viewGeneration}`}
        editor={state.editor}
        remote={{
          projectName: project.nombre,
          backHref: href(project.id),
          readOnly: state.readOnly,
          reload: state.reload,
          generationSource: { projectId: project.id, diagramId, revision: state.revision, ready: !!state.editor.active && !state.conflict },
          setEditing: state.setEditing,
          syncMessage: state.syncMessage,
          presence: state.presence,
          connection: state.connection,
          conflictPending: !!state.conflict,
          review: () => state.setReviewing(true),
        }}
      />
      {state.conflict && state.reviewing && (
        <ConflictDialog
          key={`${state.conflict.id}:${state.conflict.comparedRevision}`}
          proposal={state.conflict}
          busy={state.editor.saving}
          error={state.editor.error}
          close={() => state.setReviewing(false)}
          resolve={state.resolveProposal}
        />
      )}
    </>
  )
}
function DiagramList({ project }: { project: Project }) {
  const [importing, setImporting] = useState(false)
  const [data, setData] = useState<PageResult<Summary>>({ items: [], total: 0, page: 0, size: 20 })
  const [page, setPage] = useState(0),
    [version, setVersion] = useState(0),
    [loading, setLoading] = useState(true)
  const [error, setError] = useState(''),
    [creating, setCreating] = useState<'new' | 'copy' | null>(null)
  const [removing, setRemoving] = useState<Summary | null>(null),
    [busy, setBusy] = useState(false)
  const editable = project.permiso !== 'CONSULTA'
  useEffect(() => {
    let canceled = false
    api<PageResult<Summary>>(`/projects/${project.id}/diagrams?page=${page}`)
      .then((result) => {
        if (!canceled) setData(result)
      })
      .catch((e) => {
        if (!canceled) {
          setError(errorMessage(e))
          setData({ items: [], total: 0, page, size: 20 })
        }
      })
      .finally(() => {
        if (!canceled) setLoading(false)
      })
    return () => {
      canceled = true
    }
  }, [project.id, page, version])
  return (
    <main className="workspace-content project-diagrams">
      <a className="back-link" href="/workspace">
        <ArrowLeft size={15} />
        Todos los proyectos
      </a>
      <div className="content-title">
        <div>
          <span className="eyebrow">DIAGRAMAS DEL PROYECTO</span>
          <h1>{project.nombre}</h1>
        </div>
        {editable && (
          <div className="toolbar-group">
            <button className="secondary" onClick={() => setImporting(true)}>
              <Upload size={16} /> Importar XML de EA
            </button>
            <button className="secondary" onClick={() => setCreating('copy')}>
              <Upload size={16} />
              Copiar borrador local
            </button>
            <button className="primary" onClick={() => setCreating('new')}>
              <Plus size={16} />
              Nuevo diagrama
            </button>
          </div>
        )}
      </div>
      <p className="section-note">
        {editable
          ? 'Puedes crear y editar. Cada guardado conserva una versión en el servidor.'
          : 'Acceso de consulta: puedes abrir los diagramas sin modificarlos.'}
      </p>
      {error && (
        <p role="alert" className="auth-error">
          {error}
        </p>
      )}
      {loading ? (
        <p>Cargando diagramas…</p>
      ) : data.items.length === 0 ? (
        <div className="projects-empty">
          <Layers3 size={32} />
          <h2>Este proyecto aún no tiene diagramas</h2>
          <p>
            {editable
              ? 'Crea un diagrama o copia uno de tus borradores locales.'
              : 'Aquí aparecerán los diagramas que cree el equipo.'}
          </p>
        </div>
      ) : (
        <div className="project-grid">
          {data.items.map((d) => (
            <article className="project-card" key={d.id}>
              <h2>{d.name}</h2>
              <p>
                Versión {d.versionActual} · {new Date(d.updatedAt).toLocaleString('es-BO')}
              </p>
              <div className="project-card-actions">
                <a className="text-button" href={href(project.id, d.id)}>
                  Abrir diagrama
                </a>
                {editable && (
                  <button
                    className="icon-button danger"
                    aria-label={`Eliminar diagrama ${d.name}`}
                    onClick={() => {
                      setError('')
                      setRemoving(d)
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      <Pagination
        {...data}
        change={(p) => {
          setLoading(true)
          setPage(p)
        }}
      />
      {creating && (
        <CreateDiagram project={project} mode={creating} close={() => setCreating(null)} />
      )}
      {importing && <ImportXmiDialog projectId={project.id} close={() => setImporting(false)} />}
      {removing && (
        <Modal title="Eliminar diagrama" close={() => setRemoving(null)}>
          <p>
            «{removing.name}» dejará de estar disponible. Se conservarán sus versiones en el
            servidor.
          </p>
          {error && (
            <p className="auth-error" role="alert">
              {error}
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
                    `/projects/${project.id}/diagrams/${removing.id}?revision=${removing.revision}`,
                    { method: 'DELETE' },
                  )
                  setRemoving(null)
                  setPage(0)
                  setVersion((v) => v + 1)
                } catch (e) {
                  setError(errorMessage(e))
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
    </main>
  )
}
function CreateDiagram({
  project,
  mode,
  close,
}: {
  project: Project
  mode: 'new' | 'copy'
  close: () => void
}) {
  const [drafts, setDrafts] = useState<Diagram[]>([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  const [name, setName] = useState('Nuevo diagrama'),
    [selected, setSelected] = useState('')
  const pending = useRef<Diagram | null>(null)
  useEffect(() => {
    if (mode === 'copy')
      void diagramRepository
        .list()
        .then(setDrafts)
        .catch((e) => setError(errorMessage(e)))
  }, [mode])
  return (
    <Modal title={mode === 'copy' ? 'Copiar borrador al proyecto' : 'Nuevo diagrama'} close={close}>
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          setError('')
          try {
            if (!pending.current) {
              const original = drafts.find((d) => d.id === selected)
              if (mode === 'copy' && !original) throw new Error('Selecciona un borrador local.')
              pending.current = original ? copyLocalDiagram(original) : createDiagram(name)
            }
            const document = { ...pending.current, name }
            const result = await api<DiagramEnvelope>(`/projects/${project.id}/diagrams`, {
              method: 'POST',
              body: JSON.stringify(document),
            })
            window.location.assign(href(project.id, result.document.id))
          } catch (e) {
            setError(errorMessage(e))
          } finally {
            setBusy(false)
          }
        }}
      >
        {mode === 'copy' && (
          <>
            <label>
              Borrador local
              <select
                value={selected}
                required
                disabled={busy}
                onChange={(e) => {
                  setSelected(e.target.value)
                  pending.current = null
                  setName(drafts.find((d) => d.id === e.target.value)?.name ?? '')
                }}
              >
                <option value="">Selecciona un borrador</option>
                {drafts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            <p className="hint">
              Se creará una copia independiente. El original se conserva en este navegador.
            </p>
            {!drafts.length && (
              <p>No hay borradores locales disponibles en este navegador y dirección.</p>
            )}
          </>
        )}
        <label>
          Nombre del diagrama
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={100}
            disabled={busy}
          />
        </label>
        {error && (
          <p role="alert" className="auth-error">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button className="secondary" type="button" onClick={close}>
            Cancelar
          </button>
          <button className="primary" disabled={busy || (mode === 'copy' && !selected)}>
            {busy ? 'Guardando…' : 'Guardar diagrama'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
