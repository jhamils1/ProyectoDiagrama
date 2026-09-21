import { useState } from 'react'
import { Download } from 'lucide-react'
import { apiBlob, errorMessage } from '../../shared/api'

export type GenerationSource = {
  projectId: string
  diagramId: string
  revision: number
  ready: boolean
}

export function GenerateBackendButton({ source, blocked, format = 'backend' }: {
  source: GenerationSource
  blocked: boolean
  format?: 'backend' | 'xmi'
}) {
  const xml = format === 'xmi'
  const filename = `${xml ? 'diagrama' : 'backend'}-${source.diagramId}-r${source.revision}.${xml ? 'xml' : 'zip'}`
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return <>
    <button className="secondary" disabled={busy || blocked || !source.ready}
      title={!source.ready ? 'Conecta y sincroniza todos los cambios antes de generar.' : xml ? 'Exportar el modelo UML a XML para EA (sin posiciones ni estilos).' : 'Descargar un proyecto Spring Boot CRUD de la revisión guardada.'}
      onClick={async () => {
        setBusy(true)
        setError('')
        try {
          const blob = await apiBlob(`/projects/${encodeURIComponent(source.projectId)}/diagrams/${encodeURIComponent(source.diagramId)}/${format}?revision=${source.revision}`)
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.download = filename
          document.body.append(link)
          link.click()
          link.remove()
          window.setTimeout(() => URL.revokeObjectURL(url), 1000)
        } catch (e) { setError(errorMessage(e)) }
        finally { setBusy(false) }
      }}><Download size={16} />{busy ? 'Generando…' : xml ? 'Exportar XML' : 'Generar backend'}</button>
    {error && <div role="alert" style={{ whiteSpace: 'pre-line', maxWidth: 440 }}>
      {error} <button className="icon-button" aria-label="Cerrar errores de generación" onClick={() => setError('')}>×</button>
    </div>}
  </>
}
