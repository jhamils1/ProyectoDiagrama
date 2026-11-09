import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { api, ApiError, errorMessage } from '../../../shared/api'
import './diagram-activity.css'

type Change = {
  kind: string; elementId: string; label: string; action: string
  property: string; before: string | null; after: string | null
}
type Entry = {
  version: number; createdAt: string; authorId: string | null; authorName: string | null
  changes: Change[]; totalChanges: number
}
type ActivityPage = { items: Entry[]; nextBeforeVersion: number | null }
type ChangePage = { version: number; items: Change[]; totalChanges: number; nextOffset: number | null }
const kinds: Record<string, string> = {
  diagram: 'Diagrama', class: 'Clase', attribute: 'Atributo', method: 'Método', relation: 'Relación',
}
const actions: Record<string, string> = { created: 'Creó', deleted: 'Eliminó', updated: 'Modificó' }
const properties: Record<string, string> = {
  name: 'nombre', abstract: 'abstracta', position: 'posición', class: 'clase', dataType: 'tipo de dato', returnType: 'tipo de retorno',
  visibility: 'visibilidad', identifier: 'identificador', required: 'obligatorio', type: 'tipo',
  source: 'origen', target: 'destino', sourceMultiplicity: 'multiplicidad de origen',
  targetMultiplicity: 'multiplicidad de destino', associationClass: 'clase de asociación',
}

export function DiagramActivityDialog({ projectId, diagramId, revision, close }: {
  projectId: string; diagramId: string; revision: number; close: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const request = useRef<AbortController | null>(null)
  const [page, setPage] = useState<ActivityPage>({ items: [], nextBeforeVersion: null })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [loadingVersion, setLoadingVersion] = useState<number | null>(null)
  const path = `/projects/${projectId}/diagrams/${diagramId}/activity`

  useEffect(() => { dialog.current?.showModal() }, [])
  useEffect(() => {
    const controller = new AbortController()
    request.current?.abort()
    request.current = controller
    api<ActivityPage>(path, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]) })
      .then(data => {
        if (!controller.signal.aborted) { setPage(data); setError(''); setLoadingVersion(null) }
      })
      .catch(e => {
        if (!controller.signal.aborted) {
          setPage({ items: [], nextBeforeVersion: null })
          setError(errorMessage(e))
          setLoadingVersion(null)
        }
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => { controller.abort(); request.current?.abort() }
  }, [path, revision, refresh])

  async function more() {
    if (page.nextBeforeVersion === null || loading) return
    const controller = new AbortController()
    request.current?.abort()
    request.current = controller
    setLoading(true)
    setError('')
    try {
      const data = await api<ActivityPage>(`${path}?beforeVersion=${page.nextBeforeVersion}`, {
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
      })
      if (!controller.signal.aborted) setPage(old => ({
        items: [...old.items, ...data.items], nextBeforeVersion: data.nextBeforeVersion,
      }))
    } catch (e) {
      if (!controller.signal.aborted) {
        if (e instanceof ApiError && [401, 403, 404].includes(e.status))
          setPage({ items: [], nextBeforeVersion: null })
        setError(errorMessage(e))
      }
    } finally { if (!controller.signal.aborted) setLoading(false) }
  }

  async function moreChanges(entry: Entry) {
    if (loading || loadingVersion !== null || entry.changes.length >= entry.totalChanges) return
    const controller = new AbortController()
    request.current?.abort()
    request.current = controller
    setLoadingVersion(entry.version)
    setError('')
    try {
      const offset = entry.changes.length
      const data = await api<ChangePage>(`${path}/${entry.version}/changes?offset=${offset}&size=100`, {
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
      })
      if (data.version !== entry.version || data.totalChanges !== entry.totalChanges || !data.items.length)
        throw new Error('No se pudieron obtener los cambios de esta versión. Actualiza la actividad e inténtalo de nuevo.')
      if (!controller.signal.aborted) setPage(old => ({ ...old, items: old.items.map(item =>
        item.version === entry.version && item.changes.length === offset
          ? { ...item, changes: [...item.changes, ...data.items] } : item),
      }))
    } catch (e) {
      if (!controller.signal.aborted) {
        if (e instanceof ApiError && [401, 403, 404].includes(e.status))
          setPage({ items: [], nextBeforeVersion: null })
        setError(errorMessage(e))
      }
    } finally { if (!controller.signal.aborted) setLoadingVersion(null) }
  }

  return <dialog ref={dialog} className="modal diagram-activity" aria-labelledby="activity-title" onCancel={close}>
    <header className="activity-heading">
      <h2 id="activity-title">Actividad del diagrama</h2>
      <button className="icon-button" aria-label="Cerrar actividad" onClick={close}><X size={20} /></button>
    </header>
    <p>Los cambios guardados son visibles para los participantes del proyecto, incluso al volver otro día.</p>
    <button className="secondary" disabled={loading || loadingVersion !== null} onClick={() => {
      setLoading(true); setRefresh(value => value + 1)
    }}>Actualizar actividad</button>
    {error && <p role="alert">{error}</p>}
    {loading && <p role="status">Cargando actividad…</p>}
    {!loading && !error && !page.items.length && <p>No hay actividad guardada.</p>}
    <ol className="activity-list">
      {page.items.map(entry => <li key={entry.version}>
        <div className="activity-author"><strong>{entry.authorName || 'Autor no registrado'}</strong>
          <span>Versión {entry.version}</span></div>
        <time dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleString('es-BO')}</time>
        {!entry.authorId && <p className="activity-note">Versión histórica sin autor registrado.</p>}
        {!entry.totalChanges && <p>Guardó una versión sin cambios de contenido.</p>}
        <ul>{entry.changes.map((change, index) => <li key={`${change.elementId}:${index}`}>
          {actions[change.action]} {kinds[change.kind]?.toLowerCase()} <strong>{change.label}</strong>
          {change.action === 'updated' && <> · {properties[change.property] || change.property}: {' '}
            <span>{change.before || '(vacío)'} → {change.after || '(vacío)'}</span></>}
        </li>)}</ul>
        {entry.totalChanges > entry.changes.length && <p className="activity-note">
          Se muestran {entry.changes.length} de {entry.totalChanges} cambios de esta versión.
        </p>}
        {entry.totalChanges > entry.changes.length && <button className="secondary"
          disabled={loading || loadingVersion !== null} onClick={() => void moreChanges(entry)}>
          {loadingVersion === entry.version ? 'Cargando cambios…' : `Ver más cambios de la versión ${entry.version}`}
        </button>}
      </li>)}
    </ol>
    {page.nextBeforeVersion !== null && <button className="secondary" disabled={loading || loadingVersion !== null}
      onClick={() => void more()}>Ver cambios anteriores</button>}
  </dialog>
}
