import { useEffect, useRef, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import {
  Box,
  Plus,
  GitBranch,
  Check,
  ChevronRight,
  FolderOpen,
  Sparkles,
  MousePointer2,
  Layers3,
  X,
  AlertCircle,
  WifiOff,
  Pencil,
  LoaderCircle,
  PanelRightClose,
} from 'lucide-react'
import { useEditor } from './features/modeling/application/useEditor'
import { createClass, type UmlRelation } from './features/modeling/domain/model'
import { DiagramCanvas } from './features/modeling/ui/DiagramCanvas'
import { Inspector } from './features/modeling/ui/Inspector'
import { RelationDialog } from './features/modeling/ui/RelationDialog'
import '@xyflow/react/dist/style.css'

function DeleteDialog({
  name,
  relationCount,
  close,
  confirm,
}: {
  name: string
  relationCount: number
  close: () => void
  confirm: () => Promise<void>
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    ref.current?.showModal()
  }, [])
  return (
    <dialog ref={ref} className="modal small-modal" onCancel={close}>
      <h2>Eliminar {name}</h2>
      <p>
        Se eliminarán esta clase y sus atributos
        {relationCount ? `, junto con ${relationCount} relación(es)` : ''}. Esta acción no se puede
        deshacer.
      </p>
      <div className="modal-actions">
        <button className="secondary" onClick={close}>
          Cancelar
        </button>
        <button className="destructive" onClick={() => void confirm()}>
          Eliminar clase y dependencias
        </button>
      </div>
    </dialog>
  )
}

export default function App() {
  const editor = useEditor()
  const { active, loading, saving, loadFailed } = editor
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [relation, setRelation] = useState<UmlRelation | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)
  const {
    offlineReady: [offlineReady],
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()
  const selected = active?.classes.find((c) => c.id === selectedId)
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])
  async function addClass() {
    if (!active) return
    const value = createClass(active)
    if (await editor.execute({ type: 'addClass', value })) setSelectedId(value.id)
  }
  function newRelation(sourceId?: string, targetId?: string) {
    if (!active?.classes.length) return
    setRelation({
      id: crypto.randomUUID(),
      type: 'association',
      name: '',
      sourceId: sourceId ?? active.classes[0].id,
      targetId: targetId ?? active.classes[1]?.id ?? active.classes[0].id,
      sourceMultiplicity: '1',
      targetMultiplicity: '0..*',
    })
  }
  async function newDiagram() {
    if (await editor.newDiagram()) {
      setSelectedId(null)
      setRenaming(false)
    }
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Modela, inicio">
          <span className="brand-mark">
            <GitBranch size={23} />
          </span>
          <span>
            modela<span className="brand-dot">.</span>
          </span>
        </a>
        <div className="workspace-label">
          <span className="workspace-avatar">M</span>
          <div>
            <strong>Mi espacio de trabajo</strong>
            <span>En este navegador</span>
          </div>
        </div>
        <div className="sidebar-section">
          <span>BORRADORES LOCALES</span>
          <button
            className="sidebar-icon"
            aria-label="Crear otro diagrama"
            onClick={() => void newDiagram()}
            disabled={loading || saving || loadFailed}
          >
            <Plus size={16} />
          </button>
        </div>
        <nav aria-label="Diagramas locales" className="draft-list">
          {editor.diagrams.map((d) => (
            <button
              key={d.id}
              className={`draft-item ${active?.id === d.id ? 'active' : ''}`}
              onClick={() => {
                editor.selectDiagram(d.id)
                setSelectedId(null)
                setRenaming(false)
              }}
              disabled={saving}
            >
              <Layers3 size={17} />
              <span>{d.name}</span>
              {active?.id === d.id && <ChevronRight size={14} />}
            </button>
          ))}
        </nav>
        {!loading && editor.diagrams.length === 0 && (
          <p className="sidebar-empty">Tus diagramas aparecerán aquí.</p>
        )}
        {active && (
          <>
            <div className="sidebar-section outline-heading">
              <span>ESTRUCTURA</span>
              <span>{active.classes.length}</span>
            </div>
            <div className="class-tree">
              {active.classes.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={c.id === selectedId ? 'selected' : ''}
                >
                  <Box size={14} />
                  <span>{c.name}</span>
                </button>
              ))}
              {!active.classes.length && <p className="sidebar-empty">Agrega clases al lienzo.</p>}
            </div>
          </>
        )}
        <div className="sidebar-bottom">
          <div className="ai-note">
            <Sparkles size={20} />
            <strong>Asistencia local</strong>
            <span>
              Texto, voz e imágenes.
              <br />
              Se integrará en una próxima etapa.
            </span>
            <span className="upcoming-badge">En preparación</span>
          </div>
          <div className="sidebar-foot">
            <span className="status-dot" />
            Primer parcial · SW1
          </div>
        </div>
      </aside>
      <main className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <FolderOpen size={16} />
            <span>Espacio local</span>
            <ChevronRight size={14} />
            <strong>Editor de clases</strong>
          </div>
          <div className="topbar-right">
            {!online && (
              <span className="offline-badge">
                <WifiOff size={13} />
                Sin conexión
              </span>
            )}
            <a className="shared-workspace-link" href="/workspace">
              Acceder a proyectos
            </a>
            <span className="user-avatar">M</span>
          </div>
        </header>
        <div className="document-header">
          <div>
            <div className="eyebrow">DIAGRAMA DE CLASES</div>
            {active ? (
              <div className="document-title">
                {renaming ? (
                  <form
                    key={active.id}
                    onSubmit={async (e) => {
                      e.preventDefault()
                      const data = new FormData(e.currentTarget)
                      if (
                        await editor.execute({
                          type: 'renameDiagram',
                          name: String(data.get('diagramName')),
                        })
                      )
                        setRenaming(false)
                    }}
                  >
                    <input
                      aria-label="Nombre del diagrama"
                      name="diagramName"
                      defaultValue={active.name}
                      autoFocus
                      required
                      maxLength={100}
                    />
                    <button className="icon-button" aria-label="Guardar nombre" disabled={saving}>
                      <Check size={18} />
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label="Cancelar nombre"
                      onClick={() => setRenaming(false)}
                    >
                      <X size={18} />
                    </button>
                  </form>
                ) : (
                  <>
                    <h1>{active.name}</h1>
                    <button
                      className="icon-button"
                      aria-label="Renombrar diagrama"
                      onClick={() => setRenaming(true)}
                    >
                      <Pencil size={15} />
                    </button>
                  </>
                )}
              </div>
            ) : (
              <h1>Diseña tu próximo sistema</h1>
            )}
            <p className="document-subtitle">Organiza tus ideas, clase por clase.</p>
          </div>
          {active && (
            <span className={`save-status ${saving ? 'saving' : ''}`} role="status">
              {saving ? <LoaderCircle size={15} className="spin" /> : <Check size={15} />}
              {saving ? 'Guardando…' : 'Guardado en este navegador'}
            </span>
          )}
        </div>
        {needRefresh && (
          <div className="update-banner">
            Hay una nueva versión. Guarda los formularios antes de actualizar.
            <button onClick={() => void updateServiceWorker(true)} disabled={saving}>
              Actualizar aplicación
            </button>
          </div>
        )}
        {editor.error && (
          <div className="error-banner" role="alert">
            <AlertCircle size={18} />
            <span>{editor.error}</span>
            <button className="icon-button" onClick={editor.dismissError} aria-label="Cerrar aviso">
              <X size={16} />
            </button>
          </div>
        )}
        {loading ? (
          <div className="start-screen">
            <LoaderCircle className="spin" />
            <h2>Abriendo tus borradores…</h2>
          </div>
        ) : !active ? (
          <div className="start-screen">
            <div className="start-illustration">
              <Box size={44} strokeWidth={1.4} />
            </div>
            <span className="eyebrow">DEL MODELO A TU APLICACIÓN</span>
            <h2>
              Un espacio para dar forma
              <br />a tus ideas.
            </h2>
            <p>
              Crea clases, define sus atributos y conecta sus relaciones.
              <br />
              Tus borradores se guardan en este navegador.
            </p>
            <button
              className="primary large"
              onClick={() => void newDiagram()}
              disabled={saving || loadFailed}
            >
              <Plus size={18} />
              Crear mi primer diagrama
            </button>
            <span className="start-caption">Editor local · Sin cuenta en esta etapa</span>
          </div>
        ) : (
          <>
            <div className="editor-toolbar">
              <div className="toolbar-group">
                <button className="primary" onClick={() => void addClass()} disabled={saving}>
                  <Plus size={16} />
                  Nueva clase
                </button>
                <button
                  className="secondary"
                  onClick={() => newRelation()}
                  disabled={saving || !active.classes.length}
                >
                  <GitBranch size={16} />
                  Relación
                </button>
                <span className="toolbar-divider" />
                <span className="toolbar-help">
                  <MousePointer2 size={14} />
                  Arrastra para organizar
                </span>
              </div>
              <span className="toolbar-label">
                UML <span className="status-dot" />
              </span>
            </div>
            <div className="editor-body">
              <DiagramCanvas
                key={active.id}
                diagram={active}
                selectedId={selectedId}
                select={setSelectedId}
                busy={saving}
                execute={editor.execute}
                connect={(c) => newRelation(c.source, c.target)}
                editRelation={setRelation}
              />
              {selected ? (
                <Inspector
                  key={`${selected.id}:${active.localRevision}`}
                  value={selected}
                  busy={saving}
                  execute={editor.execute}
                  onDelete={() => setDeleting(true)}
                />
              ) : (
                <aside className="inspector empty-inspector">
                  <div className="panel-heading">
                    <span>PROPIEDADES</span>
                    <PanelRightClose size={16} />
                  </div>
                  <div className="inspector-prompt">
                    <MousePointer2 size={28} strokeWidth={1.4} />
                    <h3>Cada detalle cuenta</h3>
                    <p>Selecciona una clase para editar su nombre y sus atributos.</p>
                  </div>
                  <div className="model-guide">
                    <span className="eyebrow">UNA PEQUEÑA GUÍA</span>
                    <p>
                      <span>01</span> Agrega tus clases al lienzo.
                    </p>
                    <p>
                      <span>02</span> Define sus atributos y tipos.
                    </p>
                    <p>
                      <span>03</span> Conéctalas con relaciones.
                    </p>
                    <small>Haz clic sobre una relación para editarla.</small>
                  </div>
                </aside>
              )}
            </div>
            <footer className="statusbar">
              <span>
                <span className="status-dot" />
                Borrador local · Sin sincronización
              </span>
              <span>
                {active.classes.length} clases<span className="status-separator">/</span>
                {active.relations.length} relaciones
              </span>
              <span>
                {offlineReady ? 'Aplicación preparada sin conexión' : 'Almacenamiento local'}
                <span className="status-separator">/</span>r{active.localRevision}
              </span>
            </footer>
          </>
        )}
      </main>
      {relation && active && (
        <RelationDialog
          diagram={active}
          initial={relation}
          close={() => setRelation(null)}
          execute={editor.execute}
          busy={saving}
          error={editor.error}
        />
      )}
      {deleting && selected && active && (
        <DeleteDialog
          name={selected.name}
          relationCount={
            active.relations.filter((r) => r.sourceId === selected.id || r.targetId === selected.id)
              .length
          }
          close={() => setDeleting(false)}
          confirm={async () => {
            if (
              await editor.execute({ type: 'deleteClass', id: selected.id, confirmRelations: true })
            ) {
              setDeleting(false)
              setSelectedId(null)
            }
          }}
        />
      )}
    </div>
  )
}
