import { useEffect, useRef, useState } from 'react'
import { X, Send, Sparkles, Maximize2, Minimize2 } from 'lucide-react'
import { useConversation } from './useConversation'
import { useSharedQwen } from './useSharedQwen'
import './conversation.css'

import type { Diagram, ModelCommand } from '../modeling/domain/model'
import { editorExamples } from '../ai/domain/editorProposal'
import { isEditingInstruction, useSharedEditing } from './useSharedEditing'
import { usePanelResize } from './usePanelResize'

export function ConversationDialog({ projectId, diagramId, diagram, revision, canEdit, saving, execute, position, editorError, visible, close }: {
  projectId: string; diagramId: string; diagram: Diagram; revision: number; canEdit: boolean; saving: boolean
  execute: (command: ModelCommand, assistantInstruction?: string) => Promise<boolean>; position: () => { x: number; y: number } | undefined
  editorError: string | null; visible: boolean; close: () => void
}) {
  const list = useRef<HTMLDivElement>(null)
  const resize = usePanelResize()
  const follow = useRef(true)
  const [draft, setDraft] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [displayed, setDisplayed] = useState(visible)
  const conversation = useConversation(projectId, diagramId)
  const qwen = useSharedQwen(projectId, diagramId, conversation.denied)
  const editing = useSharedEditing(diagram, revision, canEdit && !conversation.denied, execute, position)
  const editLocked = editing.busy || saving
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
  }, [conversation.assistant?.id, conversation.assistant?.status])
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
      <div><h2 id="conversation-title">Asistente IA · Qwen3</h2>
        <p>Consulta y edita con tu equipo</p></div>
      <button className="icon-button" type="button" aria-label={expanded ? 'Restaurar tamaño del asistente' : 'Ampliar asistente a pantalla completa'}
        title={expanded ? 'Restaurar tamaño' : 'Ampliar a pantalla completa'} aria-pressed={expanded} onClick={() => setExpanded(value => !value)}>
        {expanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
      </button>
      <button className="icon-button" aria-label="Cerrar conversación" disabled={editLocked || (conversation.sending && !conversation.denied)}
        onClick={requestClose}><X size={20} /></button>
    </header>
    <div className="conversation-connection" data-connected={conversation.ready && !conversation.syncError && !conversation.denied}>
      <span aria-hidden="true" />{conversation.denied ? 'Acceso no disponible' : conversation.syncError ? 'Reconectando…' : conversation.ready ? 'Proyecto compartido' : 'Conectando…'}
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
        {message.executorName && <small>Generada en el navegador de {message.executorName}. </small>}
        {message.executorName && <small>Comprueba las afirmaciones de Qwen antes de aplicar cambios. </small>}
        <small>Revisión del diagrama al enviar: {message.diagramRevision}</small>
        {(message.kind === 'ASISTENTE' || message.kind === 'PROPUESTA') && Number.isInteger(message.diagramRevision)
          && Number.isInteger(revision) && message.diagramRevision < revision &&
          <p className="conversation-stale">El editor muestra una revisión posterior (r{revision}).
            Comprueba si {message.kind === 'PROPUESTA' ? 'esta propuesta' : 'esta respuesta'} sigue vigente.</p>}
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
      {editing.status && <p role="status">{editing.status}</p>}
      {editing.status && editorError && <p role="alert">{editorError}</p>}
      {canEdit && <details><summary>Ejemplos de edición disponibles</summary>
        <ul>{editorExamples.map(example => <li key={example}>{example}</li>)}</ul>
        <p>Estos comandos usan reglas validadas. Para otras consultas se utiliza la IA local; sus respuestas no modifican el diagrama.</p>
      </details>}
    </section>}
    {!conversation.denied && <section className="conversation-engine" aria-label="IA local compartida">
      <strong>Qwen3-1.7B · IA local del equipo</strong>
      <p role="status">{conversation.assistant?.status === 'PROCESANDO' && !qwen.ready && !qwen.busy
        ? 'Otro participante está atendiendo la consulta. Espera la respuesta compartida.' : qwen.status}</p>
      <div className="conversation-compose-actions">
        {qwen.needsPreparation && <>
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
        {(qwen.busy || qwen.ready || qwen.needsPreparation) && <button type="button" className="secondary" onClick={qwen.stop}>Detener en este equipo</button>}
      </div>
      {qwen.needsPreparation && <p>Selecciona la carpeta <strong>apps/web/public/ai</strong> de tu proyecto. Los archivos del modelo permanecen en este equipo.</p>}
    </section>}
    {conversation.assistant && ['PENDIENTE', 'PROCESANDO'].includes(conversation.assistant.status) &&
      <p role="status" className="conversation-notice">{conversation.assistant.status === 'PENDIENTE'
        ? 'Consulta pendiente. Buscando una IA disponible entre los participantes…'
        : 'Consulta en proceso. La respuesta será visible para el equipo.'}</p>}
    {conversation.assistant?.status === 'FALLIDA' && <p role="status" className="conversation-notice">
      {conversation.assistant.error ?? 'La consulta de IA no pudo completarse.'}</p>}
    </div>
    {!conversation.denied && <form onSubmit={event => {
      event.preventDefault()
      if (isEditingInstruction(draft)) { void editing.apply(draft.trim()).then(saved => { if (saved) { setDraft(''); follow.current = true } }); return }
      void conversation.send(draft, true).then(sent => { if (sent) { setDraft(''); follow.current = true } })
    }}>
      <label htmlFor="team-message" className="conversation-visually-hidden">Pregunta o consulta para la IA</label>
      <textarea id="team-message" maxLength={1500} rows={2} value={draft}
        disabled={conversation.sending || editLocked} onChange={event => setDraft(event.target.value)}
        placeholder="Por ejemplo: crea clase Factura" />
      <div className="conversation-compose-actions"><small>{draft.length}/1500</small>
        <button type="submit" className="primary conversation-send" aria-label={editLocked ? 'Guardando…' : conversation.sending ? 'Enviando…' : 'Preguntar a la IA'}
          title={editLocked ? 'Guardando…' : conversation.sending ? 'Enviando…' : 'Preguntar a la IA'} disabled={editLocked || !conversation.ready || conversation.sending || !draft.trim()
          || ['PENDIENTE', 'PROCESANDO'].includes(conversation.assistant?.status ?? '')}>
          <Send size={17} aria-hidden="true" /></button></div>
    </form>}
    </div>
  </aside>
}
