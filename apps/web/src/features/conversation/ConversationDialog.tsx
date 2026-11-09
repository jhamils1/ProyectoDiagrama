import { useEffect, useRef, useState } from 'react'
import { X, Send, Sparkles, Maximize2, Minimize2 } from 'lucide-react'
import { useConversation } from './useConversation'
import { useSharedQwen } from './useSharedQwen'
import './conversation.css'

import type { Diagram, ModelCommand } from '../modeling/domain/model'
import type { ConnectionStatus, Presence } from '../modeling/infrastructure/diagramLive'
import { editorExamples } from '../ai/domain/editorProposal'
import { isEditingInstruction, useSharedEditing } from './useSharedEditing'
import { usePanelResize } from './usePanelResize'

export function ConversationDialog({ projectId, diagramId, diagram, revision, canEdit, saving, execute, position, editorError, visible, close, presence, connection }: {
  projectId: string; diagramId: string; diagram: Diagram; revision: number; canEdit: boolean; saving: boolean
  presence: Presence; connection: ConnectionStatus
  execute: (command: ModelCommand, assistantInstruction?: string) => Promise<boolean>; position: () => { x: number; y: number } | undefined
  editorError: string | null; visible: boolean; close: () => void
}) {
  const list = useRef<HTMLDivElement>(null)
  const resize = usePanelResize()
  const follow = useRef(true)
  const [draft, setDraft] = useState('')
  const [mode, setMode] = useState<'LOCAL' | 'INTERNET'>(() => {
    try { return sessionStorage.getItem('modela-assistant-mode') === 'INTERNET' ? 'INTERNET' : 'LOCAL' }
    catch { return 'LOCAL' }
  })
  const [modeMenuOpen, setModeMenuOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [displayed, setDisplayed] = useState(visible)
  const conversation = useConversation(projectId, diagramId)
  const qwen = useSharedQwen(projectId, diagramId, conversation.denied)
  const editing = useSharedEditing(diagram, revision, canEdit && !conversation.denied, execute, position)
  const editLocked = editing.busy || saving
  useEffect(() => {
    try { sessionStorage.setItem('modela-assistant-mode', mode) } catch { /* Storage can be disabled. */ }
  }, [mode])
  useEffect(() => {
    if (visible) {
      setDisplayed(true)
      return
    }
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timer = window.setTimeout(() => setDisplayed(false), reducedMotion ? 0 : 350)
    return () => window.clearTimeout(timer)
  }, [visible])
  useEffect(() => {
    if (follow.current && list.current) list.current.scrollTop = list.current.scrollHeight
  }, [conversation.messages])
  useEffect(() => {
    const state = conversation.assistant?.status
    if (conversation.assistant?.mode === 'INTERNET') return
    if (state === 'PROCESANDO' || state === 'COMPLETADA' || state === 'FALLIDA') {
      // An unclaimed local load is unnecessary if someone else has taken the job.
      if (!qwen.ready && (qwen.busy || qwen.needsPreparation)) qwen.yieldToOther()
      return
    }
    if (state !== 'PENDIENTE' || qwen.ready || qwen.busy || qwen.needsPreparation || qwen.failed) return
    // Give an already-ready participant a chance to claim before loading another model.
    const timer = setTimeout(() => qwen.start(), 5000)
    return () => clearTimeout(timer)
    // A job transition, not every progress update, drives the automatic attempt.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.assistant?.id, conversation.assistant?.status, conversation.assistant?.mode])
  function requestClose() {
    if (conversation.denied) { close(); return }
    if (conversation.sending || editLocked) return
    close()
  }
  return <aside ref={resize.panel} hidden={!visible && !displayed} inert={!visible} aria-hidden={!visible}
    className="conversation-panel" style={{ width: resize.width }} data-resizing={resize.resizing} data-closing={!visible} data-expanded={expanded}
    id="shared-assistant-panel" aria-labelledby="conversation-title"
    onAnimationEnd={event => { if (event.target === event.currentTarget && event.animationName === 'conversation-slide-out' && !visible) setDisplayed(false) }}
    onKeyDown={event => {
    if (event.key === 'Escape') { event.stopPropagation(); if (expanded) setExpanded(false); else requestClose() }
  }}>
    {!expanded && <div className="conversation-resize-handle" role="separator" tabIndex={0} aria-orientation="vertical"
      aria-label="Ajustar ancho del asistente" aria-controls="shared-assistant-panel"
      aria-valuemin={resize.minimum} aria-valuemax={resize.maximum} aria-valuenow={resize.width}
      aria-valuetext={`${resize.width} píxeles`} title="Arrastra para ajustar el ancho. Doble clic para restablecer."
      {...resize.separator} />}
    <header className="conversation-heading">
      <span className="conversation-brand" aria-hidden="true"><Sparkles size={22} /></span>
      <div><h2 id="conversation-title">Asistente IA</h2>
        <p className="conversation-models">Qwen3 local · Gemini por internet</p></div>
      <button className="icon-button" type="button" aria-label={expanded ? 'Restaurar tamaño del asistente' : 'Ampliar asistente a pantalla completa'}
        title={expanded ? 'Restaurar tamaño' : 'Ampliar a pantalla completa'} aria-pressed={expanded} onClick={() => setExpanded(value => !value)}>
        {expanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
      </button>
      <button className="icon-button" aria-label="Cerrar conversación" disabled={editLocked || (conversation.sending && !conversation.denied)}
        onClick={requestClose}><X size={20} /></button>
    </header>
    <div className="conversation-connection" data-connected={connection === 'connected' && !conversation.denied}>
      <span className="conversation-connection-dot" aria-hidden="true" />
      {conversation.denied ? 'Acceso no disponible' : connection === 'connected' ? 'Conectados' : 'Reconectando…'}
      {connection === 'connected' && !conversation.denied && <div className="conversation-presence" aria-label="Participantes conectados">
        {presence.map(user => <span className="conversation-presence-avatar" key={user.id} title={user.name} aria-label={user.name}>
          {user.name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => Array.from(part)[0]).join('').toLocaleUpperCase() || '?'}
        </span>)}
      </div>}
    </div>
    <div className="conversation-panel-content">
    <div className="conversation-messages" ref={list} onScroll={() => {
      if (list.current) follow.current = list.current.scrollHeight - list.current.scrollTop - list.current.clientHeight < 60
    }}>
      {conversation.before !== null && <button className="secondary" disabled={conversation.readingOlder}
        onClick={() => { follow.current = false; void conversation.loadOlder() }}>
        {conversation.readingOlder ? 'Cargando…' : 'Mensajes anteriores'}</button>}
      {!conversation.ready && !conversation.denied && <p role="status">Conectando con la conversación…</p>}
      {conversation.ready && !conversation.messages.length && !conversation.denied && <p className="conversation-empty">
        Haz una pregunta a la IA. El equipo podrá consultar las respuestas cuando vuelva al diagrama.
      </p>}
      <ol aria-label="Mensajes del equipo">{conversation.messages.map(message => <li key={message.id} className={message.kind === 'ASISTENTE' ? 'conversation-message-ai' : 'conversation-message-person'}>
        <span className="conversation-avatar" aria-hidden="true">{message.kind === 'ASISTENTE' ? <Sparkles size={18} /> : message.authorName.slice(0, 1).toUpperCase()}</span>
        <div className="conversation-author"><strong>{message.kind === 'PROPUESTA' ? `Propuesta compartida por ${message.authorName}` : message.authorName}</strong>
          <time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString('es-BO')}</time></div>
        <p>{message.content}</p>
        <small>{message.executorName ? `IA en el navegador de ${message.executorName} · ` : ''}Revisión {message.diagramRevision}</small>
        {(message.kind === 'PROPUESTA' || (message.kind === 'ASISTENTE' && (message.answerScope != null
          ? ['DIAGRAMA', 'ACTIVIDAD'].includes(message.answerScope)
          : ['Asistente · datos del diagrama', 'Asistente · actividad registrada'].includes(message.authorName)))) && Number.isInteger(message.diagramRevision)
          && Number.isInteger(revision) && message.diagramRevision < revision &&
          <p className="conversation-stale">El diagrama cambió desde {message.kind === 'PROPUESTA' ? 'esta propuesta' : 'esta respuesta'}.</p>}
        {message.kind === 'ASISTENTE' && message.continuationQuestion && <div className="conversation-continuation">
          <button type="button" className="secondary" disabled={editLocked || !conversation.ready || conversation.denied || conversation.sending
            || Boolean(draft.trim()) || ['PENDIENTE', 'PROCESANDO'].includes(conversation.assistant?.status ?? '')}
            title={draft.trim() ? 'Envía o borra tu borrador antes de continuar.' : 'Consultar la página anterior de actividad'}
            onClick={() => { void conversation.send(message.continuationQuestion!, true).then(sent => { if (sent) follow.current = true }) }}>
            Ver actividad anterior</button>
        </div>}
      </li>)}</ol>
    {conversation.syncError && <p role="status" className="conversation-notice">
      {conversation.syncError} Se volverá a intentar automáticamente.
    </p>}
    {conversation.error && <p role="alert" className="conversation-notice">{conversation.error}</p>}
    {!conversation.denied && <section className="conversation-edit-preview" aria-label="Edición compartida">
      <details><summary>Ejemplos de consultas y sugerencias</summary>
        <ul><li>¿Cómo puedo mejorar mi diagrama?</li><li>Revisa la clase Factura</li>
          <li>¿Cómo puedo resolver los problemas de la clase Factura?</li><li>¿Cómo modelarías una devolución?</li></ul>
        <p>Las revisiones básicas usan el diagrama guardado. Las preguntas abiertas pueden usar Qwen y sus sugerencias requieren revisión.</p>
      </details>
      {canEdit && <details><summary>Ejemplos de edición disponibles</summary>
        <ul>{editorExamples.map(example => <li key={example}>{example}</li>)}</ul>
        <p>Estos comandos usan reglas validadas. Para otras consultas se utiliza la IA local; sus respuestas no modifican el diagrama.</p>
      </details>}
    </section>}
    {!conversation.denied && <section className="conversation-engine" aria-label="IA local compartida">
      {(conversation.assistant?.status === 'PROCESANDO' || qwen.status !== 'Respuesta compartida. IA lista para la próxima pregunta del equipo.') && <p role="status">{conversation.assistant?.mode === 'INTERNET' && conversation.assistant.status === 'PROCESANDO'
        ? 'Gemini está procesando la consulta.' : conversation.assistant?.status === 'PROCESANDO' && !qwen.ready && !qwen.busy
        ? 'La consulta se está procesando. Puede estar ejecutándose en otra ventana o dispositivo.' : qwen.status}</p>}
      <div className="conversation-compose-actions">
        {qwen.needsPreparation && mode === 'LOCAL' && <>
          <label className="conversation-local-source">Usar archivos de mi PC
            <input type="file" aria-label="Elegir carpeta local de Qwen" multiple {...{ webkitdirectory: '' }}
              onChange={event => {
                const files = Array.from(event.currentTarget.files ?? [])
                event.currentTarget.value = ''
                if (files.length && qwen.needsPreparation && conversation.assistant?.status === 'PENDIENTE') void qwen.prepareLocal(files)
              }} />
          </label>
          <button type="button" className="secondary" onClick={() => void qwen.prepare()}>Descargar desde el servidor</button>
        </>}
        {qwen.failed && conversation.assistant?.status === 'PENDIENTE' && <button type="button" className="secondary" onClick={() => void qwen.start()}>Reintentar en este equipo</button>}
        {(qwen.busy || qwen.ready || qwen.needsPreparation) && <button type="button" className="secondary conversation-stop" onClick={() => qwen.stop()}>Detener en este equipo</button>}
      </div>
      {qwen.needsPreparation && mode === 'LOCAL' && <p>Selecciona la carpeta <strong>apps/web/public/ai</strong> de tu proyecto. Los archivos del modelo permanecen en este equipo.</p>}
    </section>}
    {conversation.assistant && ['PENDIENTE', 'PROCESANDO'].includes(conversation.assistant.status) &&
      <p role="status" className="conversation-notice">{conversation.assistant.status === 'PENDIENTE'
        ? conversation.assistant.mode === 'INTERNET' ? 'Consulta por internet pendiente de iniciar.' : 'Consulta pendiente. Buscando una IA disponible entre los participantes…'
        : 'Consulta en proceso. La respuesta será visible para el equipo.'}</p>}
    {conversation.assistant?.mode === 'INTERNET' && conversation.assistant.status === 'PENDIENTE' && !conversation.sending &&
      <button type="button" className="secondary" onClick={() => void conversation.continueInternet()}>Continuar consulta por internet</button>}
    {conversation.assistant?.status === 'FALLIDA' && <p role="status" className="conversation-notice">
      {conversation.assistant.error ?? 'La consulta de IA no pudo completarse.'}</p>}
    </div>
    {conversation.assistant && ['PENDIENTE', 'PROCESANDO'].includes(conversation.assistant.status) && <div className="conversation-cancel">
      <button type="button" className="secondary" disabled={conversation.canceling} onClick={() => {
        void conversation.cancelAssistant().then(canceled => { if (canceled && qwen.busy) qwen.stop(true) })
      }}>{conversation.canceling ? 'Cancelando…' : 'Cancelar consulta pendiente'}</button>
      <span>{conversation.assistant.mode === 'INTERNET' ? 'Google podría consumir cuota aunque la canceles. ' : ''}Solo quien preguntó o el administrador puede cancelarla.</span>
    </div>}
    {editing.status && <p className="conversation-edit-feedback" role="status">{editing.status}</p>}
    {editing.status && editorError && <p className="conversation-edit-feedback" role="alert">{editorError}</p>}
    {!conversation.denied && <form onSubmit={event => {
      event.preventDefault()
      if (isEditingInstruction(draft)) { void editing.apply(draft.trim()).then(saved => { if (saved) { setDraft(''); follow.current = true } }); return }
      void conversation.send(draft, true, mode).then(sent => { if (sent) { setDraft(''); follow.current = true } })
    }}>
      <label htmlFor="team-message" className="conversation-visually-hidden">Pregunta o consulta para la IA</label>
      <textarea id="team-message" maxLength={1500} rows={1} value={draft}
        disabled={conversation.sending || editLocked} onChange={event => setDraft(event.target.value)}
        onKeyDown={event => {
          if (event.key !== 'Enter' || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey || event.nativeEvent.isComposing) return
          event.preventDefault()
          const submit = event.currentTarget.form?.querySelector<HTMLButtonElement>('button[type="submit"]')
          if (submit && !submit.disabled) event.currentTarget.form?.requestSubmit(submit)
        }}
        title="Enter para enviar; Mayús + Enter para una nueva línea"
        placeholder="Por ejemplo: crea clase Factura" />
      <div className="conversation-compose-actions"><small>{draft.length}/1500</small>
        <div className="conversation-mode" onBlur={event => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setModeMenuOpen(false)
        }} onKeyDown={event => { if (event.key === 'Escape' && modeMenuOpen) { event.stopPropagation(); setModeMenuOpen(false) } }}>
          <span>Modo</span>
          <button type="button" className="conversation-mode-trigger" aria-label="Modo de IA" aria-expanded={modeMenuOpen}
            disabled={conversation.sending || editLocked} onClick={() => setModeMenuOpen(open => !open)}>
            {mode === 'LOCAL' ? 'Local · Qwen' : 'En línea · Gemini'} <span aria-hidden="true">▾</span>
          </button>
          {modeMenuOpen && <div className="conversation-mode-options" aria-label="Seleccionar modo de IA">
            {(['LOCAL', 'INTERNET'] as const).map(option => <button type="button" key={option}
              aria-pressed={mode === option} onClick={() => { setMode(option); setModeMenuOpen(false) }}>
              <span>{option === 'LOCAL' ? 'Local · Qwen' : 'En línea · Gemini'}</span>
              {mode === option && <span aria-hidden="true">✓</span>}
            </button>)}
          </div>}
        </div>
        <button type="submit" className="primary conversation-send" aria-label={editLocked ? 'Guardando…' : conversation.sending ? 'Enviando…' : 'Preguntar a la IA'}
          title={editLocked ? 'Guardando…' : conversation.sending ? 'Enviando…' : 'Preguntar a la IA'} disabled={editLocked || !conversation.ready || conversation.sending || !draft.trim()
          || ['PENDIENTE', 'PROCESANDO'].includes(conversation.assistant?.status ?? '')}>
          <Send size={17} aria-hidden="true" /></button></div>
    </form>}
    </div>
  </aside>
}
