import { useRef, useState } from 'react'
import { api, errorMessage } from '../../shared/api'
import { Modal } from '../projects/common'
import { dataTypes, validateDiagram, type Diagram } from '../modeling/domain/model'
import type { DiagramEnvelope } from '../modeling/application/useProjectEditor'

type Issue = { code: string; elementId: string; message: string; suggestedType?: string | null; emptyAssociation?: boolean }
type Preview = { document: Diagram | null; issues: Issue[]; notices: string[] }

export function ImportXmiDialog({ projectId, close }: { projectId: string; close: () => void }) {
  const [name, setName] = useState('Diagrama importado')
  const [xmlBase64, setXml] = useState('')
  const [types, setTypes] = useState<Record<string, string>>({})
  const [excluded, setExcluded] = useState<string[]>([])
  const [preview, setPreview] = useState<Preview | null>(null)
  const [issues, setIssues] = useState<Issue[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const pending = useRef<Diagram | null>(null)
  const [saveAttempted, setSaveAttempted] = useState(false)
  const invalidate = () => { setPreview(null); pending.current = null; setError('') }
  const closeIfIdle = () => { if (!busy) close() }
  async function analyze(xml: string, choices: Record<string, string>, omissions: string[], suggest = false) {
    setBusy(true); invalidate()
    try {
      const request = (attributeTypes: Record<string, string>, excludedInvalidAssociations: string[]) =>
        api<Preview>(`/projects/${projectId}/imports/xmi/preview`, {
          method: 'POST', body: JSON.stringify({ name, xmlBase64: xml, attributeTypes, excludedInvalidAssociations }),
        })
      let result = await request(choices, omissions)
      const initialIssues = result.issues
      setIssues(previous => {
        const combined = new Map((suggest ? [] : previous).map(issue => [`${issue.code}:${issue.elementId}`, issue]))
        initialIssues.forEach(issue => combined.set(`${issue.code}:${issue.elementId}`, issue))
        return [...combined.values()]
      })
      if (suggest) {
        const recommended = { ...choices }
        const skipped = new Set(omissions)
        for (const issue of result.issues) {
          if (issue.code === 'TYPE_MAPPING_REQUIRED' && issue.suggestedType === 'Double') recommended[issue.elementId] = 'Double'
          if (issue.code === 'ASSOCIATION_ENDS_INVALID' && issue.emptyAssociation) skipped.add(issue.elementId)
        }
        setTypes(recommended); setExcluded([...skipped])
        if (Object.keys(recommended).length || skipped.size) result = await request(recommended, [...skipped])
      }
      if (result.document) result.document = validateDiagram(result.document)
      setPreview(result)
    } catch (e) { setError(errorMessage(e)) }
    finally { setBusy(false) }
  }
  return <Modal title="Importar desde Enterprise Architect" close={closeIfIdle}>
    <p>XML UML 2.5 (XMI 2.5.1), máximo 2 MiB. Se creará un diagrama nuevo al confirmar.</p>
    <p className="section-note">Se importan clases, atributos, asociaciones y herencia del subconjunto admitido. Estilos, tamaños y metadatos propios de EA no se conservan.</p>
    <div>
      <label>Archivo XML<input type="file" accept=".xml,.xmi" disabled={busy || saveAttempted} onChange={async event => {
        const file = event.target.files?.[0]
        invalidate(); setXml(''); setTypes({}); setExcluded([]); setIssues([])
        if (!file) return
        if (!file.size || file.size > 2 * 1024 * 1024) { setError('Selecciona un XML de hasta 2 MiB con contenido.'); return }
        setBusy(true)
        try {
          const encoded = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(String(reader.result).split(',')[1])
            reader.onerror = () => reject(new Error('No se pudo leer el archivo.'))
            reader.readAsDataURL(file)
          })
          setXml(encoded)
          await analyze(encoded, {}, [], true)
        } catch(e) { setError(errorMessage(e)) }
        finally { setBusy(false) }
      }} /></label>
      <label>Nombre del diagrama<input required maxLength={100} value={name} disabled={busy || saveAttempted}
        onChange={event => {
          const next = event.target.value
          setName(next); pending.current = null
          setPreview(old => old?.document ? { ...old, document: { ...old.document, name: next } } : old)
        }} /></label>
      {busy && <p role="status">Preparando importación…</p>}
      {issues.some(issue => ['TYPE_MAPPING_REQUIRED', 'ASSOCIATION_ENDS_INVALID'].includes(issue.code)) && <details>
        <summary>Opciones avanzadas</summary>
      {issues.filter(issue => ['TYPE_MAPPING_REQUIRED', 'ASSOCIATION_ENDS_INVALID'].includes(issue.code)).map((issue, index) => <div key={`${issue.code}:${issue.elementId}`} className="section-note">
        <p>{issue.message}</p>
        {issue.code === 'TYPE_MAPPING_REQUIRED' && <label>Tipo equivalente ({index + 1})
          <select value={types[issue.elementId] ?? ''} disabled={busy || saveAttempted} onChange={event => {
            const next = { ...types }
            if (event.target.value) next[issue.elementId] = event.target.value
            else delete next[issue.elementId]
            setTypes(next); void analyze(xmlBase64, next, excluded)
          }}><option value="">Seleccionar equivalencia</option>{dataTypes.map(type => <option key={type}>{type}</option>)}</select>
        </label>}
        {issue.code === 'ASSOCIATION_ENDS_INVALID' && <label>
          <input type="checkbox" checked={excluded.includes(issue.elementId)} disabled={busy || saveAttempted} onChange={event => {
            const next = event.target.checked ? [...excluded, issue.elementId] : excluded.filter(id => id !== issue.elementId)
            setExcluded(next); void analyze(xmlBase64, types, next)
          }} /> Excluir esta asociación inválida de la importación
        </label>}
      </div>)}
      </details>}
      {error && !saveAttempted && xmlBase64 && <button className="secondary" disabled={busy} onClick={() => void analyze(xmlBase64, types, excluded, issues.length === 0)}>Reintentar lectura</button>}
    </div>
    {preview && <section aria-label="Vista previa de importación">
      {preview.issues.length > 0 && <div role="status"><p>Estos puntos requieren tu decisión. Abre las opciones avanzadas para los tipos y relaciones.</p><ul>{preview.issues.map((issue,index) => <li key={index}>{issue.message}</li>)}</ul></div>}
      {preview.document && <>
        <h3>{preview.document.name}</h3>
        <p>{preview.document.classes.length} clases · {preview.document.relations.length} relaciones</p>
        <ul>{preview.document.classes.map(c => <li key={c.id}>
          <strong>{c.name}{c.abstract ? ' (abstracta)' : ''}</strong>
          <ul>{c.attributes.map(a => <li key={a.id}>{a.name}: {a.dataType || 'sin tipo'} · {a.visibility}{a.required ? ' · obligatorio' : ''}{a.identifier ? ' · identificador' : ''}</li>)}</ul>
        </li>)}</ul>
        <ul>{preview.document.relations.map(r => {
          const source = preview.document!.classes.find(c => c.id === r.sourceId)?.name
          const target = preview.document!.classes.find(c => c.id === r.targetId)?.name
          return <li key={r.id}>{r.type === 'generalization' ? `${source} hereda de ${target}` : `${source} ${r.sourceMultiplicity} — ${r.targetMultiplicity} ${target}${r.name ? ` (${r.name})` : ''}`}</li>
        })}</ul>
      </>}
      <ul>{preview.notices.filter(notice => !notice.startsWith('Se crean identificadores internos')).map((notice, index) => <li key={index}>{notice}</li>)}</ul>
      {preview.document?.classes.some(c => c.attributes.some(a => a.name.toLowerCase() === 'id' && !a.identifier)) && <p>Los atributos llamados id se conservan. Puedes marcarlos como identificadores en el editor si corresponde.</p>}
    </section>}
    {error && <p role="alert" className="auth-error">{error}</p>}
    <div className="modal-actions">
      <button className="secondary" disabled={busy} onClick={closeIfIdle}>Cancelar</button>
      <button className="primary" disabled={busy || !name.trim() || !preview?.document || !!preview.issues.length} onClick={async () => {
        if (!preview?.document || busy) return
        setBusy(true); setSaveAttempted(true); setError('')
        // Freeze the exact reviewed document, including UUIDs, for an idempotent retry.
        pending.current ??= preview.document
        try {
          const result = await api<DiagramEnvelope>(`/projects/${projectId}/diagrams`, { method: 'POST', body: JSON.stringify(pending.current) })
          window.location.assign(`/workspace?project=${encodeURIComponent(projectId)}&diagram=${encodeURIComponent(result.document.id)}`)
        } catch(e) { setError(errorMessage(e)) }
        finally { setBusy(false) }
      }}>Confirmar importación</button>
    </div>
  </Modal>
}
