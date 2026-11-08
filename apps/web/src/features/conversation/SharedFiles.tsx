import { useEffect, useRef, useState } from 'react'
import { api, apiBlob, errorMessage } from '../../shared/api'

type SharedFile = { id: string; name: string; size: number; author: string; createdAt: string; canDelete: boolean }
const accepted = '.txt,.pdf,.png,.jpg,.jpeg,.xml,.xmi,.json,.csv,.docx,.xlsx'
export function SharedFiles({ projectId, active, onBusyChange }: { projectId: string; active: boolean; onBusyChange: (busy: boolean) => void }) {
  const [files, setFiles] = useState<SharedFile[]>([])
  const [error, setError] = useState('')
  const [syncError, setSyncError] = useState('')
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const pending = useRef<{ file: File; id: string } | null>(null)
  const path = `/projects/${projectId}/files`
  useEffect(() => {
    if (!active) return
    let alive = true
    let timer: ReturnType<typeof setTimeout>
    async function refresh() {
      try { const result = await api<SharedFile[]>(path); if (alive) { setFiles(result); setSyncError('') } }
      catch (e) { if (alive) { setFiles([]); setSyncError(errorMessage(e)) } }
      finally { if (alive) timer = setTimeout(() => void refresh(), 5000) }
    }
    void refresh()
    return () => { alive = false; clearTimeout(timer) }
  }, [path, active])
  async function upload(file: File) {
    if (busy) return
    if (file.size === 0 || file.size > 5 * 1024 * 1024) { setError('El archivo debe tener contenido y pesar como máximo 5 MB.'); return }
    if (!pending.current || pending.current.file !== file) pending.current = { file, id: crypto.randomUUID() }
    const form = new FormData()
    form.append('id', pending.current.id)
    form.append('file', file)
    setBusy(true); onBusyChange(true); setError('')
    try {
      await api(path, { method: 'POST', body: form, signal: AbortSignal.timeout(60000) })
      pending.current = null
      if (input.current) input.current.value = ''
      setFiles(await api<SharedFile[]>(path))
    } catch (e) { setError(errorMessage(e)) }
    finally { setBusy(false); onBusyChange(false) }
  }
  async function download(file: SharedFile) {
    setError('')
    try {
      const blob = await apiBlob(`${path}/${file.id}`)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a'); link.href = url; link.download = file.name; link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (e) { setError(errorMessage(e)) }
  }
  async function remove(file: SharedFile) {
    if (!window.confirm(`¿Eliminar ${file.name} para todos los participantes?`)) return
    setBusy(true); onBusyChange(true); setError('')
    try { await api(`${path}/${file.id}`, { method: 'DELETE' }); setFiles(await api<SharedFile[]>(path)) }
    catch (e) { setError(errorMessage(e)) }
    finally { setBusy(false); onBusyChange(false) }
  }
  return <section className="shared-files" aria-label="Archivos compartidos">
    <p>Comparte archivos con los participantes de este proyecto. Máximo 5 MB por archivo y 50 MB por proyecto.</p>
    <p>Tipos: PDF, imágenes JPG o PNG, TXT, XML, XMI, JSON, CSV, DOCX y XLSX.</p>
    <label htmlFor="shared-file">Seleccionar archivo</label>
    <input id="shared-file" ref={input} type="file" accept={accepted} disabled={busy} />
    <button type="button" className="primary" disabled={busy} onClick={() => { const file = input.current?.files?.[0]; if (file) void upload(file); else setError('Selecciona un archivo.') }}>
      {busy ? 'Procesando…' : 'Compartir archivo'}</button>
    {error && <p role="alert">{error}</p>}
    {syncError && <p role="alert">{syncError}</p>}
    {!files.length && <p>No hay archivos compartidos.</p>}
    <ul>{files.map(file => <li key={file.id}>
      <strong>{file.name}</strong><small>{file.author} · {file.size < 1024 ? `${file.size} B` : `${(file.size / 1024).toFixed(1)} KB`}</small>
      <div><button className="secondary" onClick={() => void download(file)}>Descargar</button>
        {file.canDelete && <button className="secondary" disabled={busy} onClick={() => void remove(file)}>Eliminar</button>}</div>
    </li>)}</ul>
  </section>
}
