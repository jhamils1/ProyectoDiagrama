import { test, expect, type Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'

function room() {
  const project = randomUUID(), diagram = randomUUID()
  const messages: { id: string; sequence: number; authorId: string; authorName: string; content: string;
    createdAt: string; diagramRevision: number; kind?: string; answerScope?: string; continuationQuestion?: string | null; proposalInstruction?: string | null; proposalData?: string | null }[] = []
  const requestIds: string[] = []
  let assistant: { id: string; status: string; error: string | null; mode?: string; executorName?: string | null; executionExpired?: boolean } | null = null
  const options = { failNextPost: false, failProposal: false, failChangeAck: false, oldBackend: false, conflict: false, denied: false, insertBeforePost: false, failCompletion: false, revision: 0,
    permission: 'CONSULTA', denyCancel: false }
  const completions: unknown[] = []
  const onlineCalls: string[] = []
  const sharedFiles: { id: string; name: string; size: number; author: string; createdAt: string; canDelete: boolean }[] = []
  const writes: { id: string; baseRevision: number; document: { classes: { name: string }[] } }[] = []
  let lastChange: { id: string; result: unknown } | null = null
  let savedDocument: unknown = null
  function add(content: string, authorName = 'Ana', id = randomUUID(), extra: { kind?: string; answerScope?: string; continuationQuestion?: string | null; proposalInstruction?: string | null; proposalData?: string | null } = {}) {
    const entry = { id, sequence: messages.length + 1, authorId: authorName, authorName, content,
      createdAt: '2026-11-06T12:00:00Z', diagramRevision: 0, ...extra }
    messages.push(entry)
    return entry
  }
  async function install(page: Page, name: string) {
    await page.addInitScript(() => {
      window.Worker = class {
        onmessage: ((event: { data: unknown }) => void) | null = null
        postMessage({ id, type }: { id: number; type: string }) {
          if (type === 'load') document.body.dataset.qwenLoadStarted = 'true'
          if (document.body.dataset.stallQwen === 'true') return
          if (type === 'chat') document.body.dataset.qwenCalls = String(Number(document.body.dataset.qwenCalls ?? 0) + 1)
          if (type === 'chat' && document.body.dataset.stallChat === 'true') return
          if (type === 'chat' && document.body.dataset.longContext === 'true') {
            setTimeout(() => this.onmessage?.({ data: { id, error: 'Contexto demasiado largo', errorCode: 'CONTEXT_TOO_LONG' } }), 0)
            return
          }
          setTimeout(() => this.onmessage?.({ data: { id, result: type === 'load' ? {} : {
            raw: type === 'generate' ? document.body.dataset.aiRaw : (document.body.dataset.aiChatRaw ?? 'Hay una asociación entre las clases.'), tokenLimitReached: false,
          } } }), 0)
        }
        terminate() {}
      } as unknown as typeof Worker
    })
    await page.routeWebSocket('**/live', () => {})
    await page.route('**/api/**', async route => {
      const request = route.request(), url = new URL(request.url()), path = url.pathname
      let json: unknown = {}
      if (path.endsWith('/auth/me')) json = { id: name, nombre: name, correo: `${name}@test.local`, rol: 'COLABORADOR', activo: true }
      else if (path.endsWith('/auth/csrf')) json = { headerName: 'X-CSRF-TOKEN', token: 'test' }
      else if (path.endsWith('/state')) json = { revision: options.revision, permiso: options.permission }
      else if (path.endsWith('/changes')) {
        if (request.method() === 'POST') {
          const body = request.postDataJSON() as { id: string; baseRevision: number; assistantInstruction?: string; document: { classes: { name: string }[] } }
          writes.push(body)
          if (lastChange?.id === body.id) return route.fulfill({ json: lastChange.result })
          if (options.conflict) return route.fulfill({ status: 409, json: { message: 'El diagrama cambió. Recarga antes de aplicar.' } })
          options.revision = body.baseRevision + 1
          savedDocument = body.document
          if (body.assistantInstruction && !options.oldBackend) {
            add(body.assistantInstruction, name)
            const created = body.document.classes.at(-1)?.name
            const deleted = body.assistantInstruction.match(/^(?:elimina|borra) la clase (\S+)\.?$/i)?.[1]
            add(deleted ? `La clase ${deleted} ha sido eliminada.` : created ? `La clase ${created} ha sido creada.` : 'Los cambios solicitados se guardaron en el diagrama.', 'Asistente · edición', randomUUID(), { kind: 'ASISTENTE' })
          }
          json = { status: 'APLICADO', assistantRecorded: !!body.assistantInstruction && !options.oldBackend, current: { revision: options.revision, versionActual: options.revision + 1,
            permiso: options.permission, document: savedDocument } }
          lastChange = { id: body.id, result: json }
          if (options.failChangeAck) { options.failChangeAck = false; return route.fulfill({ status: 503, json: { message: 'Respuesta perdida.' } }) }
        } else json = []
      }
      else if (path.endsWith(`/projects/${project}`)) json = { id: project, nombre: 'Equipo', permiso: options.permission, revision: 0 }
      else if (path.endsWith(`/diagrams/${diagram}`)) json = {
        revision: options.revision, versionActual: options.revision + 1, permiso: options.permission,
        document: savedDocument ?? { schemaVersion: 1, id: diagram, name: 'Compras', localRevision: options.revision,
          updatedAt: '2026-11-06T12:00:00Z', classes: [], relations: [] },
      }
      else if (path.endsWith('/files')) {
        if (request.method() === 'POST') {
          sharedFiles.push({ id: randomUUID(), name: 'modelo.xml', size: 9, author: name, createdAt: new Date().toISOString(), canDelete: true })
          return route.fulfill({ status: 204 })
        }
        json = sharedFiles
      }
      else if (/\/files\/[^/]+$/.test(path)) {
        if (request.method() === 'DELETE') { sharedFiles.splice(0, sharedFiles.length); return route.fulfill({ status: 204 }) }
        return route.fulfill({ body: '<modelo/>', headers: { 'Content-Type': 'application/octet-stream' } })
      }
      else if (path.endsWith('/conversation/proposals')) {
        const body = request.postDataJSON() as { id: string; baseRevision: number; instruction: string; changes: string[]; proposalData?: string }
        if (options.permission !== 'EDICION') return route.fulfill({ status: 403, json: { message: 'Sin permiso.' } })
        if (body.baseRevision !== options.revision) return route.fulfill({ status: 409, json: { message: 'El diagrama cambió.' } })
        json = messages.find(message => message.id === body.id) || add(
          `Instrucción: ${body.instruction}\nCambios propuestos:\n- ${body.changes.join('\n- ')}\nSin aplicar al momento de compartir.`,
          name, body.id, { kind: 'PROPUESTA', proposalInstruction: body.instruction, proposalData: body.proposalData })
        if (options.failProposal) { options.failProposal = false; return route.fulfill({ status: 503, json: { message: 'Confirmación perdida.' } }) }
      }
      else if (path.endsWith('/conversation/assistant')) {
        const body = request.postDataJSON() as { id: string; content: string; mode?: string }
        requestIds.push(body.id)
        if (options.insertBeforePost) { add('Mensaje concurrente', 'Pedro'); options.insertBeforePost = false }
        if (!messages.some(m => m.id === body.id)) add(body.content, name, body.id)
        if (!assistant || assistant.id !== body.id) assistant = { id: body.id, status: 'PENDIENTE', error: null, mode: body.mode ?? 'LOCAL' }
        if (body.content === 'Actividad antes de la versión 10') {
          if (assistant.status !== 'COMPLETADA') add('Versión 9: Ana creó Producto.', 'Asistente · actividad registrada', randomUUID(), { kind: 'ASISTENTE' })
          assistant.status = 'COMPLETADA'
        }
        if (options.failNextPost) {
          options.failNextPost = false
          return route.fulfill({ status: 503, json: { message: 'No se pudo confirmar el envío.' } })
        }
        json = assistant
      }
      else if (path.endsWith('/cancel')) {
        if (options.denyCancel) return route.fulfill({ status: 403, json: { message: 'Sin permiso.' } })
        if (assistant) { assistant.status = 'FALLIDA'; assistant.error = 'Consulta cancelada. Puedes seleccionar un modo y preguntar de nuevo.' }
        json = assistant
      }
      else if (path.endsWith('/switch-internet') || path.endsWith('/internet')) {
        onlineCalls.push(path)
        if (assistant) { assistant.mode = 'INTERNET'; assistant.status = 'COMPLETADA'; assistant.error = null }
        add('Una sugerencia de prueba.', 'Gemini · IA por internet', randomUUID(), { kind: 'ASISTENTE' })
        json = assistant
      }
      else if (path.endsWith('/assistant/claim')) {
        if (assistant?.status !== 'PENDIENTE') return route.fulfill({ status: 204 })
        assistant.status = 'PROCESANDO'
        assistant.executorName = name
        assistant.executionExpired = false
        json = { id: assistant.id, token: 'lease', expiresAt: new Date(Date.now() + 180000).toISOString(), messages: [{role:'user',content:'Explica las clases'}] }
      }
      else if (path.endsWith('/complete')) {
        const body = request.postDataJSON() as { content: string; failed: boolean; failureReason?: string }
        completions.push(body)
        if (assistant && assistant.status !== 'COMPLETADA') {
          if (body.failed) {
            assistant.status = 'FALLIDA'
            assistant.error = body.failureReason === 'CONTEXT_TOO_LONG'
              ? 'La pregunta y el contexto superan la capacidad de esta IA local. Prueba con una pregunta más breve o un diagrama más pequeño.'
              : 'El navegador no pudo completar la consulta.'
          } else {
            add(body.content, 'Qwen3-1.7B · IA local')
            assistant.status = 'COMPLETADA'
          }
        }
        if (options.failCompletion) { options.failCompletion = false; return route.fulfill({ status: 503, json: {message:'Confirmación perdida'} }) }
        json = assistant
      }
      else if (path.endsWith('/release')) {
        if (assistant?.status === 'PROCESANDO') assistant.status = 'PENDIENTE'
        return route.fulfill({ status: 204 })
      }
      else if (path.endsWith('/conversation')) {
        if (options.denied) return route.fulfill({ status: 404, json: { message: 'Acceso revocado.' } })
        if (request.method() === 'POST') {
          const body = request.postDataJSON() as { id: string; content: string }
          requestIds.push(body.id)
          if (options.insertBeforePost) { add('Mensaje concurrente', 'Pedro'); options.insertBeforePost = false }
          json = messages.find(m => m.id === body.id) || add(body.content, name, body.id)
          if (options.failNextPost) {
            options.failNextPost = false
            return route.fulfill({ status: 503, json: { message: 'No se pudo confirmar el envío.' } })
          }
        } else {
          const before = Number(url.searchParams.get('before') || Number.MAX_SAFE_INTEGER)
          const after = url.searchParams.get('after')
          const matches = messages.filter(m => after !== null ? m.sequence > Number(after) : m.sequence < before)
          const items = after !== null ? matches.slice(0, 30) : matches.slice(-30)
          json = { items, nextBefore: after === null && matches.length > 30 ? items[0].sequence : null,
            nextAfter: after !== null && matches.length > 30 ? items[items.length - 1].sequence : null, assistant }
        }
      }
      await route.fulfill({ json })
    })
    await page.goto(`/workspace?project=${project}&diagram=${diagram}`)
    await page.evaluate(async () => {
      const cache = await caches.open('modela-ai-v1')
      const files = Array.from({length:9}, (_, i) => ({ url:`/ai/shared-test-${i}`, sha256:'0'.repeat(64), bytes:1 }))
      for (const file of files) await cache.put(file.url,new Response('x',{headers:{'x-modela-sha256':file.sha256}}))
      await cache.put('/ai/manifest-qwen3-1.7b-external.json',new Response(JSON.stringify({
        id:'onnx-community/Qwen3-1.7B-ONNX',revision:'cc6a06a21d614e9b8e92a6adfab1074d4e7d2438',
        transformers:'4.3.0',format:'external-v1',files,
      })))
    })
    await page.getByRole('button', { name: 'Asistente IA · Qwen3', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Preguntar a la IA' })).toBeVisible()
    await expect(page.getByText('Conectando con la conversación…')).toHaveCount(0)
  }
  return { messages, requestIds, options, add, install, completions, writes, sharedFiles, onlineCalls,
    setExpired: () => { assistant = { id: randomUUID(), status: 'PENDIENTE', error: null, mode: 'LOCAL', executionExpired: true } },
    expireClaim: () => { if (assistant?.status === 'PROCESANDO') { assistant.status = 'PENDIENTE'; assistant.executorName = null; assistant.executionExpired = true } } }
}

test('una ejecución vencida indica espera sin afirmar una desconexión', async ({ page }) => {
  const state = room()
  state.setExpired()
  await state.install(page, 'Ana')
  await expect(page.getByText(/La ejecución anterior venció sin completarse/)).toBeVisible()
})

test('muestra ejemplos de consultas para revisar y pedir sugerencias', async ({ page }) => {
  const state = room()
  await state.install(page, 'Ana')
  await page.getByText('Ejemplos de consultas y sugerencias').click()
  await expect(page.getByText('¿Cómo puedo mejorar mi diagrama?')).toBeVisible()
  await expect(page.getByText('Revisa la clase Factura', { exact: true })).toBeVisible()
  await expect(page.getByText('Las revisiones básicas usan el diagrama guardado.', { exact: false })).toBeVisible()
})

test('se puede elegir Gemini y no se envía nada hasta preguntar', async ({ page }) => {
  const state = room()
  await state.install(page, 'Ana')
  await page.getByLabel('Modo de IA').click()
  await page.getByRole('button', { name: 'En línea · Gemini' }).click()
  expect(state.onlineCalls).toHaveLength(0)
  await page.getByLabel('Pregunta o consulta para la IA').fill('¿Cómo modelarías una computadora?')
  await page.getByRole('button', { name: 'Preguntar a la IA' }).click()
  await expect.poll(() => state.onlineCalls.length).toBe(1)
  await expect(page.getByText('Una sugerencia de prueba.')).toBeVisible()
  await page.getByLabel('Modo de IA').click()
  await page.getByRole('button', { name: 'Local · Qwen' }).click()
  expect(state.onlineCalls).toHaveLength(1)
  await page.getByLabel('Modo de IA').click()
  await page.getByRole('button', { name: 'En línea · Gemini' }).click()
  await page.reload()
  await page.getByRole('button', { name: 'Asistente IA · Qwen3', exact: true }).click()
  await expect(page.getByLabel('Modo de IA')).toContainText('En línea · Gemini')
  expect(state.onlineCalls).toHaveLength(1)
})

test('si Qwen tarda la consulta se cancela y el cambio a Gemini es manual', async ({ page }) => {
  const state = room()
  await state.install(page, 'Ana')
  await page.evaluate(() => { document.body.dataset.stallQwen = 'true' })
  await page.getByLabel('Pregunta o consulta para la IA').fill('Explica la relación del diagrama')
  await page.getByRole('button', { name: 'Preguntar a la IA' }).click()
  await expect(page.getByRole('button', { name: 'Cancelar consulta' })).toBeVisible({ timeout: 15000 })
  expect(state.onlineCalls).toHaveLength(0)
  await page.getByRole('button', { name: 'Cancelar consulta' }).click()
  await page.getByLabel('Modo de IA').click()
  await page.getByRole('button', { name: 'En línea · Gemini' }).click()
  await page.getByLabel('Pregunta o consulta para la IA').fill('Explica nuevamente la relación')
  await page.getByRole('button', { name: 'Preguntar a la IA' }).click()
  await expect.poll(() => state.onlineCalls.length).toBe(1)
  await expect(page.getByText('Una sugerencia de prueba.')).toBeVisible()
})

test('si otro participante no puede cancelar conserva la conversación', async ({ page }) => {
  const state = room()
  state.options.denyCancel = true
  await state.install(page, 'Ana')
  await page.evaluate(() => { document.body.dataset.stallQwen = 'true' })
  await page.getByLabel('Pregunta o consulta para la IA').fill('Explica el diagrama')
  await page.getByRole('button', { name: 'Preguntar a la IA' }).click()
  await page.getByRole('button', { name: 'Cancelar consulta' }).click()
  await expect(page.getByText('Solo quien hizo la pregunta o un administrador puede cancelar esta consulta.')).toBeVisible()
  await expect(page.getByRole('list', { name: 'Mensajes del equipo' }).getByText('Explica el diagrama')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cancelar consulta' })).toBeVisible()
})

test('el dictado agrega texto al borrador sin enviarlo y muestra errores de permiso', async ({ page }) => {
  await page.addInitScript(() => {
    class FakeSpeech {
      lang = ''; continuous = false; interimResults = false
      onresult: ((event: unknown) => void) | null = null
      onerror: ((event: unknown) => void) | null = null
      onend: (() => void) | null = null
      start() { setTimeout(() => {
        if (document.body.dataset.voiceDenied === 'true') this.onerror?.({ error: 'not-allowed' })
        else this.onresult?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: 'crea clase factura' } }] })
        this.onend?.()
      }, 30) }
      stop() { this.onend?.() }
      abort() {}
    }
    Object.defineProperty(window, 'SpeechRecognition', { value: FakeSpeech, configurable: true })
  })
  const state = room()
  await state.install(page, 'Ana')
  const input = page.getByLabel('Pregunta o consulta para la IA')
  await input.fill('Por favor')
  await page.getByRole('button', { name: 'Dictar mensaje' }).click()
  await expect(input).toHaveValue('Por favor crea clase factura')
  expect(state.requestIds).toHaveLength(0)
  await page.evaluate(() => { document.body.dataset.voiceDenied = 'true' })
  await page.getByRole('button', { name: 'Dictar mensaje' }).click()
  await expect(page.getByText('Permite el acceso al micrófono en el navegador para dictar.')).toBeVisible()
  await expect(input).toHaveValue('Por favor crea clase factura')
})

test('el dictado se detiene al cerrar el asistente', async ({ page }) => {
  await page.addInitScript(() => {
    class FakeSpeech {
      lang = ''; continuous = false; interimResults = false
      onresult: ((event: unknown) => void) | null = null
      onerror: ((event: unknown) => void) | null = null
      onend: (() => void) | null = null
      start() {}
      stop() { this.onend?.() }
      abort() { document.body.dataset.voiceAborted = 'true' }
    }
    Object.defineProperty(window, 'SpeechRecognition', { value: FakeSpeech, configurable: true })
  })
  const state = room()
  await state.install(page, 'Ana')
  await page.getByRole('button', { name: 'Dictar mensaje' }).click()
  await expect(page.getByRole('button', { name: 'Detener dictado' })).toBeVisible()
  await page.getByRole('button', { name: 'Cerrar conversación' }).click()
  await expect.poll(() => page.evaluate(() => document.body.dataset.voiceAborted)).toBe('true')
  expect(state.requestIds).toHaveLength(0)
})

test('Enter envía consultas y Mayús Enter agrega una línea', async ({ page }) => {
  const state = room()
  await state.install(page, 'Ana')
  const input = page.getByLabel('Pregunta o consulta para la IA')
  await input.press('Enter')
  expect(state.requestIds).toHaveLength(0)
  await input.fill('Primera línea')
  await input.press('Shift+Enter')
  await input.pressSequentially('Segunda línea')
  await expect(input).toHaveValue('Primera línea\nSegunda línea')
  await expect(page.getByRole('button', { name: 'Preguntar a la IA' })).toBeEnabled()
  await input.press('Enter')
  await expect.poll(() => state.requestIds.length).toBe(1)
  await expect(input).toHaveValue('')
  expect(state.messages[0].content).toBe('Primera línea\nSegunda línea')
})

test('panel oscuro se desliza sin permitir archivos y conserva el lienzo interactivo', async ({ page }) => {
  const state = room()
  state.options.permission = 'EDICION'
  state.add('¿Qué clases hay?', 'Ana')
  state.add('Puedes crear una clase desde aquí.', 'Asistente · edición', randomUUID(), { kind: 'ASISTENTE' })
  await state.install(page, 'Ana')
  const panel = page.getByRole('complementary', { name: 'Asistente IA · Qwen3' })
  await expect(panel).toBeVisible()
  await expect(panel).toHaveCSS('animation-name', 'conversation-slide-in')
  await expect(panel).toHaveCSS('background-color', 'rgb(28, 29, 44)')
  await expect(panel.locator('input[type="file"]')).toHaveCount(0)
  await expect(page.getByRole('tab', { name: 'Archivos' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Nueva clase' }).click()
  await expect(page.locator('.class-node')).toHaveCount(1)
  const canvas = await page.locator('.react-flow').boundingBox()
  const box = await panel.boundingBox()
  expect(canvas!.x + canvas!.width).toBeLessThanOrEqual(box!.x + 1)
  await page.screenshot({ path: '../../.qa/shared-assistant-dark.png' })
  await page.getByRole('button', { name: 'Cerrar conversación' }).click()
  await expect(panel).toHaveCount(0)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.getByRole('button', { name: 'Asistente IA · Qwen3', exact: true }).click()
  await expect(panel).toHaveCSS('animation-name', 'none')
  await page.setViewportSize({ width: 600, height: 800 })
  await expect(panel).toBeVisible()
  await expect(page.getByLabel('Pregunta o consulta para la IA')).toBeVisible()
  const narrow = await panel.boundingBox()
  expect(narrow!.x).toBeGreaterThanOrEqual(0)
  expect(narrow!.x + narrow!.width).toBeLessThanOrEqual(600)
})

test('el editor enlaza proyectos y permite ocultar y mostrar el menú', async ({ page }) => {
  const state = room()
  await state.install(page, 'Ana')
  const project = new URL(page.url()).searchParams.get('project')
  await expect(page.getByRole('link', { name: 'Ver todos los proyectos' })).toHaveAttribute('href', '/workspace')
  await expect(page.getByRole('link', { name: 'Equipo', exact: true })).toHaveAttribute('href', `/workspace?project=${project}`)
  const sidebar = page.locator('#editor-sidebar')
  await page.getByRole('button', { name: 'Ocultar menú izquierdo' }).click()
  await expect(sidebar).toHaveAttribute('data-visible', 'false')
  await expect(sidebar).toHaveAttribute('inert', '')
  await page.getByRole('button', { name: 'Mostrar menú izquierdo' }).click()
  await expect(sidebar).toHaveAttribute('data-visible', 'true')
})

test('el asistente deja visibles las acciones y se amplía a pantalla completa', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const state = room()
  state.options.permission = 'EDICION'
  await state.install(page, 'Ana')
  const panel = page.getByRole('complementary', { name: 'Asistente IA · Qwen3' })
  const input = page.getByLabel('Pregunta o consulta para la IA')
  await expect(page.getByLabel('Sesión de Ana, colaborador')).toBeVisible()
  const panelBox = (await panel.boundingBox())!
  const toolbarBox = (await page.locator('.editor-toolbar').boundingBox())!
  expect(panelBox.y).toBeLessThanOrEqual(toolbarBox.y + 1)
  for (const name of ['Generar backend', 'Exportar XML', 'Relación', 'Nueva clase']) {
    const button = page.getByRole('button', { name, exact: true })
    await expect(button).toBeVisible()
    const box = (await button.boundingBox())!
    expect(box.x + box.width).toBeLessThanOrEqual(panelBox.x + 1)
  }
  const actionTop = (await page.getByRole('button', { name: 'Generar backend', exact: true }).boundingBox())!.y
  const lastActionTop = (await page.getByRole('button', { name: 'Nueva clase', exact: true }).boundingBox())!.y
  expect(Math.abs(actionTop - lastActionTop)).toBeLessThan(5)
  await input.fill('Una pregunta que quiero conservar')
  await page.getByRole('button', { name: 'Ampliar asistente a pantalla completa' }).click()
  await expect(panel).toHaveAttribute('data-expanded', 'true')
  const expanded = (await panel.boundingBox())!
  expect(expanded.x).toBe(0)
  expect(expanded.y).toBe(0)
  expect(expanded.width).toBe(1440)
  expect(expanded.height).toBe(900)
  await expect(input).toHaveValue('Una pregunta que quiero conservar')
  await page.screenshot({ path: '../../.qa/shared-assistant-expanded.png' })
  await page.getByRole('button', { name: 'Restaurar tamaño del asistente' }).click()
  await expect(panel).toHaveAttribute('data-expanded', 'false')
  await expect(input).toHaveValue('Una pregunta que quiero conservar')
  await page.setViewportSize({ width: 600, height: 800 })
  await page.getByRole('button', { name: 'Ampliar asistente a pantalla completa' }).click()
  const mobile = (await panel.boundingBox())!
  expect(mobile.width).toBe(600)
  expect(mobile.height).toBe(800)
  await input.press('Escape')
  await expect(panel).toHaveAttribute('data-expanded', 'false')
  await expect(input).toBeVisible()
})

test('el botón y el cierre deslizan el panel y conservan el borrador', async ({ page }) => {
  const state = room()
  state.add('Mensaje compartido')
  await state.install(page, 'Ana')
  const toggle = page.getByRole('button', { name: 'Asistente IA · Qwen3', exact: true })
  const input = page.getByLabel('Pregunta o consulta para la IA')
  await input.fill('Mi pregunta sin enviar')
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(page.locator('.conversation-panel')).toHaveAttribute('data-closing', 'true')
  await expect(page.locator('.conversation-panel')).toHaveCSS('animation-name', 'conversation-slide-out')
  await expect(input).toBeHidden()
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(input).toBeVisible()
  await expect(input).toHaveValue('Mi pregunta sin enviar')
  await expect(page.getByText('Mensaje compartido', { exact: true })).toBeVisible()
  await expect(page.locator('.conversation-messages')).not.toHaveCSS('scrollbar-width', 'none')
  await page.getByRole('button', { name: 'Cerrar conversación' }).click()
  await expect(page.locator('.conversation-panel')).toHaveCSS('animation-name', 'conversation-slide-out')
  await expect(input).toBeHidden()
  await toggle.click()
  await expect(input).toHaveValue('Mi pregunta sin enviar')
})

test('la conversación tiene una barra de desplazamiento y el cuadro permanece fijo', async ({ page }) => {
  const state = room()
  state.options.permission = 'EDICION'
  for (let i = 1; i <= 20; i++) state.add(`Mensaje ${i}`)
  await state.install(page, 'Ana')
  const input = page.getByLabel('Pregunta o consulta para la IA')
  const scroll = page.locator('.conversation-messages')
  await expect(page.getByText('Mensaje 20', { exact: true })).toBeVisible()
  const before = (await input.boundingBox())!
  await scroll.evaluate(element => { element.scrollTop = 0 })
  await expect(page.getByText('Mensaje 1', { exact: true })).toBeVisible()
  const after = (await input.boundingBox())!
  expect(after.y).toBe(before.y)
  const containers = await page.locator('.conversation-panel-content, .conversation-messages').evaluateAll(elements =>
    elements.filter(element => element.scrollHeight > element.clientHeight && getComputedStyle(element).overflowY === 'auto').length)
  expect(containers).toBe(1)
  await input.fill('crea clase factura')
  await expect(page.getByRole('button', { name: 'Preguntar a la IA' })).toBeEnabled()
})

test('el borde permite ampliar y reducir el asistente sin perder el borrador', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await room().install(page, 'Ana')
  const panel = page.getByRole('complementary', { name: 'Asistente IA · Qwen3' })
  const handle = page.getByRole('separator', { name: 'Ajustar ancho del asistente' })
  const input = page.getByLabel('Pregunta o consulta para la IA')
  await input.fill('Borrador conservado')
  const initial = (await panel.boundingBox())!
  const grip = (await handle.boundingBox())!
  await page.mouse.move(grip.x + 3, grip.y + 100)
  await page.mouse.down()
  await page.mouse.move(grip.x - 137, grip.y + 100, { steps: 8 })
  await page.mouse.up()
  await expect(panel).toHaveCSS('width', `${initial.width + 140}px`)
  await expect(input).toHaveValue('Borrador conservado')
  await expect(page.locator('body')).not.toHaveCSS('cursor', 'col-resize')
  await handle.focus()
  await handle.press('ArrowRight')
  await expect(panel).toHaveCSS('width', `${initial.width + 130}px`)
  await handle.press('Home')
  await expect(panel).toHaveCSS('width', '320px')
  await handle.press('End')
  const canvas = (await page.locator('.react-flow').boundingBox())!
  expect(canvas.width).toBeGreaterThanOrEqual(319)
  await handle.dblclick()
  await expect(panel).toHaveCSS('width', '380px')
  await page.setViewportSize({ width: 600, height: 800 })
  await expect.poll(async () => {
    const box = (await panel.boundingBox())!
    return box.x >= 0 && box.x + box.width <= 600
  }).toBe(true)
  await expect(input).toHaveValue('Borrador conservado')
})

test('las variantes explícitas editan y una pregunta no guarda cambios', async ({ page }) => {
  const state = room()
  state.options.permission = 'EDICION'
  await state.install(page, 'Ana')
  const input = page.getByLabel('Pregunta o consulta para la IA')
  await input.fill('¿Puedes crear una clase llamada Factura?')
  await page.getByRole('button', { name: 'Preguntar a la IA' }).click()
  await expect.poll(() => state.writes.length).toBe(1)
  await expect(page.getByText('La clase Factura ha sido creada.', { exact: true })).toBeVisible()
  await input.fill('¿Cómo puedo crear la clase Pedido?')
  await page.getByRole('button', { name: 'Preguntar a la IA' }).click()
  await expect.poll(() => state.requestIds.length).toBe(1)
  expect(state.writes).toHaveLength(1)
  expect(state.messages.some(m => m.content === '¿Cómo puedo crear la clase Pedido?')).toBe(true)
})

test('crea una clase automáticamente y la coloca en la zona visible', async ({ page }) => {
  const state = room()
  state.options.permission = 'EDICION'
  await state.install(page, 'Ana')
  await page.getByLabel('Pregunta o consulta para la IA').fill('crea clase factura')
  await page.getByRole('button', { name: 'Preguntar a la IA' }).click()
  await expect(page.getByText('Cambios guardados: Crear clase factura.')).toBeVisible()
  expect(state.writes).toHaveLength(1)
  expect(state.writes[0].document.classes.map(item => item.name)).toEqual(['factura'])
  expect(state.messages).toHaveLength(2)
  await expect(page.getByText('crea clase factura', { exact: true })).toBeVisible()
  await expect(page.getByText('La clase factura ha sido creada.', { exact: true })).toBeVisible()
  await expect(page.getByText('Asistente · edición', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Confirmar y guardar' })).toHaveCount(0)
  await expect(page.locator('body')).not.toHaveAttribute('data-qwen-load-started')
  await page.getByRole('button', { name: 'Cerrar conversación' }).click()
  const node = page.locator('.class-node').filter({ hasText: 'factura' })
  await expect(node).toBeVisible()
  const box = await node.boundingBox()
  const canvas = await page.locator('.react-flow').boundingBox()
  expect(box).not.toBeNull()
  expect(canvas).not.toBeNull()
  expect(box!.x + box!.width / 2).toBeGreaterThan(canvas!.x)
  expect(box!.x + box!.width / 2).toBeLessThan(canvas!.x + canvas!.width)
  expect(box!.y + box!.height / 2).toBeGreaterThan(canvas!.y)
  expect(box!.y + box!.height / 2).toBeLessThan(canvas!.y + canvas!.height)
  // Pan well away from the initial origin: the next class must still be visible.
  await page.mouse.move(canvas!.x + 35, canvas!.y + 35)
  await page.mouse.down()
  await page.mouse.move(canvas!.x + 335, canvas!.y + 235, { steps: 8 })
  await page.mouse.up()
  await page.getByRole('button', { name: 'Asistente IA · Qwen3', exact: true }).click()
  await page.getByLabel('Pregunta o consulta para la IA').fill('crea la clase auto')
  await page.getByRole('button', { name: 'Preguntar a la IA' }).click()
  await expect(page.getByText('Cambios guardados: Crear clase auto.')).toBeVisible()
  await page.getByRole('button', { name: 'Cerrar conversación' }).click()
  const newBox = await page.locator('.class-node').filter({ hasText: 'auto' }).boundingBox()
  expect(newBox).not.toBeNull()
  expect(newBox!.x + newBox!.width / 2).toBeGreaterThan(canvas!.x)
  expect(newBox!.x + newBox!.width / 2).toBeLessThan(canvas!.x + canvas!.width)
  expect(newBox!.y + newBox!.height / 2).toBeGreaterThan(canvas!.y)
  expect(newBox!.y + newBox!.height / 2).toBeLessThan(canvas!.y + canvas!.height)
  await page.reload()
  await expect(page.locator('.class-node').filter({ hasText: 'factura' })).toBeVisible()
  await expect(page.locator('.class-node').filter({ hasText: 'auto' })).toBeVisible()
})

test('mantiene validaciones y permisos antes de aplicar cambios', async ({ page }) => {
  const state = room()
  state.options.permission = 'EDICION'
  await state.install(page, 'Ana')
  const input = page.getByLabel('Pregunta o consulta para la IA')
  await input.fill('Elimina el método calcular de factura')
  await page.getByRole('button', { name: 'Preguntar a la IA' }).click()
  await expect(page.getByText('Instrucción no disponible.', { exact: false })).toBeVisible()
  expect(state.writes).toHaveLength(0)
  state.options.permission = 'CONSULTA'
  await page.reload()
  await page.getByRole('button', { name: 'Asistente IA · Qwen3', exact: true }).click()
  await input.fill('Agrega el método encender con retorno void a factura')
  await page.getByRole('button', { name: 'Preguntar a la IA' }).click()
  await expect(page.getByText('Necesitas permiso de edición', { exact: false })).toBeVisible()
  expect(state.writes).toHaveLength(0)
})

test('crea un método desde el asistente y rechaza duplicados', async ({ page }) => {
  const state = room()
  state.options.permission = 'EDICION'
  await state.install(page, 'Ana')
  await page.getByRole('button', { name: 'Nueva clase', exact: true }).click()
  await expect(page.locator('.class-node')).toHaveCount(1)
  const instruction = '¿Puedes incluir el método encender en la clase Clase1 que devuelve void?'
  const input = page.getByLabel('Pregunta o consulta para la IA')
  await input.fill(instruction)
  await page.getByRole('button', { name: 'Preguntar a la IA' }).click()
  await expect(page.locator('.class-node')).toContainText('encender(): void')
  await expect(page.getByText('Cambios guardados: Agregar método Clase1.encender(): void.')).toBeVisible()
  const writes = state.writes.length
  await input.fill(instruction)
  await page.getByRole('button', { name: 'Preguntar a la IA' }).click()
  await expect(page.getByText('Ya existe un método con ese nombre en la clase.')).toBeVisible()
  expect(state.writes).toHaveLength(writes)
  await page.reload()
  await expect(page.locator('.class-node')).toContainText('encender(): void')
})

test('otro participante ve la instrucción y la respuesta guardadas', async ({ page, browser }) => {
  const state = room()
  state.options.permission = 'EDICION'
  await state.install(page, 'Ana')
  const otherContext = await browser.newContext({ baseURL: 'http://127.0.0.1:4173' })
  const other = await otherContext.newPage()
  await state.install(other, 'Pedro')
  await page.getByLabel('Pregunta o consulta para la IA').fill('crea la clase camion')
  await page.getByRole('button', { name: 'Preguntar a la IA' }).click()
  await expect(other.getByText('crea la clase camion', { exact: true })).toBeVisible({ timeout: 10000 })
  await expect(other.getByText('La clase camion ha sido creada.', { exact: true })).toBeVisible()
  await other.reload()
  await other.getByRole('button', { name: 'Asistente IA · Qwen3', exact: true }).click()
  await expect(other.getByText('crea la clase camion', { exact: true })).toBeVisible()
  await expect(other.getByText('La clase camion ha sido creada.', { exact: true })).toBeVisible()
  await otherContext.close()
})

test('avisa si el backend antiguo guarda la clase sin registrar la conversación', async ({ page }) => {
  const state = room()
  state.options.permission = 'EDICION'
  state.options.oldBackend = true
  await state.install(page, 'Ana')
  await page.getByLabel('Pregunta o consulta para la IA').fill('crea la clase camion')
  await page.getByRole('button', { name: 'Preguntar a la IA' }).click()
  await expect(page.getByRole('region', { name: 'Edición compartida' }).getByText('El cambio se guardó, pero el backend no confirmó el historial', { exact: false })).toBeVisible()
  expect(state.writes).toHaveLength(1)
  expect(state.messages).toHaveLength(0)
})

test('no crea una clase duplicada al repetir la instrucción', async ({ page }) => {
  const state = room()
  state.options.permission = 'EDICION'
  await state.install(page, 'Ana')
  const input = page.getByLabel('Pregunta o consulta para la IA')
  await input.fill('crea clase factura')
  await page.getByRole('button', { name: 'Preguntar a la IA' }).click()
  await expect(page.getByText('Cambios guardados:', { exact: false })).toBeVisible()
  await input.fill('crea clase factura')
  await page.getByRole('button', { name: 'Preguntar a la IA' }).click()
  await expect(page.getByText('Cambios guardados:', { exact: false })).toHaveCount(0)
  await expect(page.getByText('Ya existe una clase con ese nombre.')).toBeVisible()
  expect(state.writes).toHaveLength(1)
})

test('crea y elimina la clase solicitada desde el asistente', async ({ page }) => {
  const state = room()
  state.options.permission = 'EDICION'
  await state.install(page, 'Ana')
  const input = page.getByLabel('Pregunta o consulta para la IA')
  const send = page.getByRole('button', { name: 'Preguntar a la IA' })
  await input.fill('crea la clase gato')
  await send.click()
  await expect(page.getByText('Cambios guardados: Crear clase gato.')).toBeVisible()
  await input.fill('elimina la clase gato')
  await send.click()
  await expect(page.getByText('La clase gato ha sido eliminada.')).toBeVisible()
  expect(state.writes).toHaveLength(2)
  await expect(page.locator('.class-node').filter({ hasText: 'gato' })).toHaveCount(0)
  await page.reload()
  await expect(page.locator('.class-node').filter({ hasText: 'gato' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Asistente IA · Qwen3', exact: true }).click()
  await input.fill('crea la clase gato')
  await send.click()
  await expect(page.getByText('Cambios guardados: Crear clase gato.')).toBeVisible()
  expect(state.writes).toHaveLength(3)
  await expect(page.locator('.class-node').filter({ hasText: 'gato' })).toHaveCount(1)
})

test('mantiene el mismo identificador en un reintento de guardado incierto', async ({ page }) => {
  const state = room()
  state.options.permission = 'EDICION'
  state.options.failChangeAck = true
  await state.install(page, 'Ana')
  await page.getByLabel('Pregunta o consulta para la IA').fill('Crea la clase Factura')
  await page.getByRole('button', { name: 'Preguntar a la IA' }).click()
  await expect(page.getByText('No se confirmó el guardado.', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Preguntar a la IA' }).click()
  await expect(page.getByText('Cambios guardados:', { exact: false })).toBeVisible()
  expect(state.writes).toHaveLength(2)
  expect(state.writes[0].id).toBe(state.writes[1].id)
  expect(state.writes[0].document).toEqual(state.writes[1].document)
  expect(state.options.revision).toBe(1)
})

test('muestra el conflicto sin indicar éxito', async ({ page }) => {
  const state = room()
  state.options.permission = 'EDICION'
  state.options.conflict = true
  await state.install(page, 'Ana')
  await page.getByLabel('Pregunta o consulta para la IA').fill('Crea la clase Factura')
  await page.getByRole('button', { name: 'Preguntar a la IA' }).click()
  await expect(page.getByText('No se confirmó el guardado.', { exact: false })).toBeVisible()
  await expect(page.getByText('Cambios guardados:', { exact: false })).toHaveCount(0)
  expect(state.options.revision).toBe(0)
})

test('aplica clases, atributos y asociaciones admitidas sin confirmación', async ({ page }) => {
  const state = room()
  state.options.permission = 'EDICION'
  await state.install(page, 'Ana')
  const input = page.getByLabel('Pregunta o consulta para la IA')
  const send = async (text: string) => {
    await input.fill(text)
    await page.getByRole('button', { name: 'Preguntar a la IA' }).click()
    await expect(input).toHaveValue('')
  }
  await send('Crea la clase Cliente con atributo nombre')
  await send('Crea la clase Pedido')
  await send('Crear una asociación entre Cliente y Pedido, donde un Cliente puede tener muchos Pedidos y cada Pedido pertenece a un solo Cliente.')
  expect(state.writes).toHaveLength(3)
  await page.getByRole('button', { name: 'Cerrar conversación' }).click()
  await page.reload()
  await expect(page.locator('.react-flow__edge')).toHaveCount(1)
  await expect(page.locator('.class-node').filter({ hasText: 'Cliente' })).toContainText('nombre')
})

test('avisa cuando una respuesta corresponde a una revisión anterior del diagrama cargado', async ({ page }) => {
  const state = room()
  state.add('Respuesta anterior', 'Asistente · datos del diagrama', randomUUID(), { kind: 'ASISTENTE' })
  state.add('Explicación conceptual', 'Asistente · conceptos UML', randomUUID(), { kind: 'ASISTENTE' })
  state.add('Respuesta abierta', 'Qwen3-1.7B · IA local', randomUUID(), { kind: 'ASISTENTE' })
  state.add('Respuesta de Qwen sobre el modelo', 'Qwen3-1.7B · IA local', randomUUID(), { kind: 'ASISTENTE', answerScope: 'DIAGRAMA' })
  state.add('Explicación teórica de Qwen', 'Qwen3-1.7B · IA local', randomUUID(), { kind: 'ASISTENTE', answerScope: 'CONCEPTO' })
  state.add('Pregunta anterior', 'Ana', randomUUID(), { kind: 'PERSONA' })
  await state.install(page, 'Ana')
  await expect(page.getByText('El diagrama cambió desde esta respuesta.')).toHaveCount(0)
  state.options.revision = 1
  await page.reload()
  await page.getByRole('button', { name: 'Asistente IA · Qwen3', exact: true }).click()
  const warning = page.getByText('El diagrama cambió desde esta respuesta.')
  await expect(warning).toHaveCount(2)
  await expect(page.locator('li').filter({ hasText: 'Explicación conceptual' }).getByText('El diagrama cambió', { exact: false })).toHaveCount(0)
  await expect(page.locator('li').filter({ hasText: 'Respuesta abierta' }).getByText('El diagrama cambió', { exact: false })).toHaveCount(0)
  await expect(page.locator('li').filter({ hasText: 'Explicación teórica de Qwen' }).getByText('El diagrama cambió', { exact: false })).toHaveCount(0)
  await expect(page.getByText('La IA puede equivocarse. Revisa sus respuestas.')).toHaveCount(1)
  await expect(page.getByText('Respuesta anterior')).toBeVisible()
  await expect(page.getByText('Pregunta anterior')).toBeVisible()
})

test('el límite de contexto se comparte con el equipo sin publicar una respuesta falsa', async ({ page, browser }) => {
  const state = room()
  await state.install(page, 'Ana')
  const otherContext = await browser.newContext({ baseURL: 'http://127.0.0.1:4173' })
  const other = await otherContext.newPage()
  await state.install(other, 'Pedro')
  await page.evaluate(() => { document.body.dataset.longContext = 'true' })
  await other.evaluate(() => { document.body.dataset.longContext = 'true' })
  await page.getByLabel('Pregunta o consulta para la IA').fill('Explícame este modelo')
  await page.getByRole('button', { name: 'Preguntar a la IA' }).click()
  await expect(page.getByText('La pregunta y el contexto superan la capacidad', { exact: false })).toBeVisible({ timeout: 20000 })
  await expect(other.getByText('La pregunta y el contexto superan la capacidad', { exact: false })).toBeVisible({ timeout: 10000 })
  expect(state.completions).toHaveLength(1)
  expect(state.completions[0]).toMatchObject({ failed: true, failureReason: 'CONTEXT_TOO_LONG', content: '' })
  expect(state.messages).toHaveLength(1)
  await other.reload()
  await other.getByRole('button', { name: 'Asistente IA · Qwen3', exact: true }).click()
  await expect(other.getByText('La pregunta y el contexto superan la capacidad', { exact: false })).toBeVisible()
  await otherContext.close()
})

test('el botón consulta actividad anterior y conserva el borrador', async ({ page, browser }) => {
  const state = room()
  state.add('Actividad reciente, hay más versiones.', 'Asistente · actividad registrada', randomUUID(),
    { kind: 'ASISTENTE', continuationQuestion: 'Actividad antes de la versión 10' })
  state.add('Mensaje de persona con metadatos falsos.', 'Ana', randomUUID(),
    { kind: 'PERSONA', continuationQuestion: 'Actividad antes de la versión 999' })
  await state.install(page, 'Ana')
  const otherContext = await browser.newContext({ baseURL: 'http://127.0.0.1:4173' })
  const other = await otherContext.newPage()
  await state.install(other, 'Pedro')
  const button = page.getByRole('button', { name: 'Ver actividad anterior' })
  await expect(button).toHaveCount(1)
  await page.getByLabel('Pregunta o consulta para la IA').fill('Borrador sin enviar')
  await expect(button).toBeDisabled()
  await page.getByLabel('Pregunta o consulta para la IA').fill('')
  await button.click()
  await expect(page.getByText('Versión 9: Ana creó Producto.', { exact: true })).toBeVisible()
  await expect(other.getByText('Versión 9: Ana creó Producto.', { exact: true })).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: 'Asistente IA · Qwen3', exact: true }).click()
  await expect(page.getByText('Versión 9: Ana creó Producto.', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Ver actividad anterior' })).toBeVisible()
  await otherContext.close()
})

test('una respuesta vacía del modelo muestra una alternativa compartida', async ({ page }) => {
  const state = room()
  await state.install(page, 'Ana')
  await page.evaluate(() => { document.body.dataset.aiChatRaw = '' })
  await page.getByLabel('Pregunta o consulta para la IA').fill('Explícame el proyecto')
  await page.getByRole('button', { name: 'Preguntar a la IA' }).click()
  await expect(page.getByText('Actualmente no tengo una respuesta adecuada para esa pregunta. ¿Puedes reformularla o darme más detalles?', { exact: true })).toBeVisible({ timeout: 15000 })
  expect(state.completions).toHaveLength(1)
})

test('el aviso de respuesta no disponible queda separado de la revisión', async ({ page }) => {
  const state = room()
  state.add('Actualmente no tengo una respuesta adecuada.', 'Asistente · respuesta no disponible', randomUUID(), { kind: 'ASISTENTE' })
  await state.install(page, 'Ana')
  const note = page.getByText('No se obtuvo una respuesta adecuada. Puedes volver a preguntar.')
  await expect(note).toBeVisible()
  await expect(note).toHaveCSS('display', 'block')
  await expect(page.getByText('Revisión 0', { exact: true })).toBeVisible()
})

test('una pregunta explícita muestra la respuesta compartida y el estado', async ({ page, browser }) => {
  const state = room()
  await state.install(page, 'Ana')
  const otherContext = await browser.newContext({ baseURL: 'http://127.0.0.1:4173' })
  const other = await otherContext.newPage()
  await state.install(other, 'Pedro')
  await page.getByLabel('Pregunta o consulta para la IA').fill('¿Cómo se relacionan?')
  await page.getByRole('button', { name: 'Preguntar a la IA' }).click()
  await expect(page.getByText(/Consulta pendiente/)).toBeVisible()
  await expect(other.getByText('¿Cómo se relacionan?', { exact: true })).toBeVisible()
  state.options.failCompletion = true
  await expect(page.getByText('Hay una asociación entre las clases.', { exact: true })).toBeVisible()
  await expect(other.getByText('Hay una asociación entre las clases.', { exact: true })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Mensajes del equipo' }).getByText('Qwen3-1.7B · IA local', { exact: true })).toBeVisible()
  await expect.poll(() => state.completions.length).toBe(2)
  expect(state.completions[0]).toEqual(state.completions[1])
  const total = Number(await page.locator('body').getAttribute('data-qwen-calls') ?? 0)
    + Number(await other.locator('body').getAttribute('data-qwen-calls') ?? 0)
  expect(total).toBe(1)
  await otherContext.close()
})

test('una carga detenida termina con aviso y permite volver a intentar', async ({ page }) => {
  const state = room()
  await state.install(page, 'Ana')
  await page.evaluate(() => { document.body.dataset.stallQwen = 'true' })
  await page.clock.install()
  await page.getByLabel('Pregunta o consulta para la IA').fill('Explica el diagrama')
  await page.getByRole('button', {name:'Preguntar a la IA'}).click()
  await expect(page.getByText(/Consulta pendiente/)).toBeVisible()
  await page.clock.fastForward(5000)
  await expect(page.getByRole('button', {name:'Cancelar consulta'})).toBeVisible()
  // Wait until the worker request has started, then advance its bounded timeout.
  await expect(page.locator('body')).toHaveAttribute('data-qwen-load-started', 'true')
  await page.clock.fastForward(181000)
  await expect(page.getByText(/Qwen no terminó de cargar en 3 minutos/)).toBeVisible()
  await expect(page.getByRole('button', {name:'Reintentar en este equipo'})).toBeEnabled()
})

test('si faltan recursos pide preparación y permite cancelar desde el botón de envío', async ({ page }) => {
  const state = room()
  await state.install(page, 'Ana')
  await page.evaluate(() => caches.delete('modela-ai-v1'))
  await page.getByLabel('Pregunta o consulta para la IA').fill('¿Qué clases hay?')
  await page.getByRole('button', { name: 'Preguntar a la IA' }).click()
  await expect(page.getByLabel('Elegir carpeta local de Qwen')).toBeAttached({ timeout: 12000 })
  await expect(page.getByRole('button', { name: 'Descargar desde el servidor' })).toBeVisible()
  await expect(page.getByText(/1,46 GB/)).toBeVisible()
  await page.getByRole('button', { name: 'Cancelar consulta' }).click()
  await expect(page.getByText(/Consulta cancelada/)).toBeVisible()
  expect(state.messages.filter(message => message.content === '¿Qué clases hay?')).toHaveLength(1)
})

test('otra ventana de la misma cuenta no se identifica como otro participante', async ({ page, browser }) => {
  const state = room()
  await state.install(page, 'Ana')
  await page.evaluate(() => { document.body.dataset.stallChat = 'true' })
  await page.getByLabel('Pregunta o consulta para la IA').fill('Explica la relación del diagrama')
  await page.getByRole('button', { name: 'Preguntar a la IA' }).click()
  await expect(page.locator('body')).toHaveAttribute('data-qwen-calls', '1', { timeout: 15000 })
  const otherContext = await browser.newContext({ baseURL: 'http://127.0.0.1:4173' })
  const other = await otherContext.newPage()
  await state.install(other, 'Ana')
  await expect(other.getByText('Qwen está procesando la consulta en una sesión de Ana.')).toBeVisible()
  await expect(other.getByText(/Otro participante está atendiendo/)).toHaveCount(0)
  await otherContext.close()
})

test('otro participante atiende la consulta cuando vence la reserva del navegador desconectado', async ({ page, browser }) => {
  const state = room()
  await state.install(page, 'Ana')
  await page.evaluate(() => { document.body.dataset.stallChat = 'true' })
  await page.getByLabel('Pregunta o consulta para la IA').fill('Explica la relación del diagrama')
  await page.getByRole('button', { name: 'Preguntar a la IA' }).click()
  await expect(page.locator('body')).toHaveAttribute('data-qwen-calls', '1', { timeout: 15000 })
  const otherContext = await browser.newContext({ baseURL: 'http://127.0.0.1:4173' })
  const other = await otherContext.newPage()
  await state.install(other, 'Pedro')
  await expect(other.getByText(/La consulta se está procesando\. Puede estar ejecutándose en otra ventana o dispositivo/)).toBeVisible()
  await page.close()
  // The mock advances the server lease; PostgreSQL integration tests exercise real expiry and tokens.
  state.expireClaim()
  await expect(other.getByText('Hay una asociación entre las clases.', { exact: true })).toBeVisible({ timeout: 20000 })
  await expect(other.getByText('Explica la relación del diagrama', { exact: true })).toBeVisible()
  expect(state.completions).toHaveLength(1)
  await other.reload()
  await other.getByRole('button', { name: 'Asistente IA · Qwen3', exact: true }).click()
  await expect(other.getByText('Hay una asociación entre las clases.', { exact: true })).toBeVisible()
  await otherContext.close()
})

test('una IA ya cargada atiende otra consulta sin cargarla en el segundo navegador', async ({ page, browser }) => {
  const state = room()
  await state.install(page, 'Ana')
  await page.getByLabel('Pregunta o consulta para la IA').fill('Primera consulta')
  await page.getByRole('button', { name: 'Preguntar a la IA' }).click()
  await expect(page.getByText('Hay una asociación entre las clases.', { exact: true })).toBeVisible({ timeout: 15000 })
  await expect(page.getByText(/Respuesta compartida/)).toBeVisible()
  const otherContext = await browser.newContext({ baseURL: 'http://127.0.0.1:4173' })
  const other = await otherContext.newPage()
  await state.install(other, 'Pedro')
  await other.evaluate(() => caches.delete('modela-ai-v1'))
  await other.getByLabel('Pregunta o consulta para la IA').fill('Segunda consulta')
  await other.getByRole('button', { name: 'Preguntar a la IA' }).click()
  await expect(other.getByText('Hay una asociación entre las clases.', { exact: true })).toHaveCount(2, { timeout: 15000 })
  await expect(other.getByRole('button', { name: 'Preparar y continuar' })).toHaveCount(0)
  await expect(other.locator('body')).not.toHaveAttribute('data-qwen-load-started', 'true')
  await otherContext.close()
})

test('dos participantes consultan el historial anterior sin ejecutar HTML', async ({ page, browser }) => {
  const state = room()
  for (let i = 1; i <= 31; i++) state.add(`Anterior ${i}`)
  await state.install(page, 'Ana')
  await page.getByRole('button', { name: 'Mensajes anteriores' }).click()
  await expect(page.getByText('Anterior 1', { exact: true })).toBeVisible()
  // Different accounts require separate browser storage/cookies, as in real sessions.
  const otherContext = await browser.newContext({ baseURL: 'http://127.0.0.1:4173' })
  const other = await otherContext.newPage()
  await state.install(other, 'Pedro')
  await page.getByLabel('Pregunta o consulta para la IA').fill('Revisemos Compra y Producto <img src=x onerror=alert(1)>')
  await page.getByRole('button', { name: 'Preguntar a la IA' }).click()
  await expect(other.getByRole('list', { name: 'Mensajes del equipo' })).toContainText('Revisemos Compra y Producto')
  await expect(other.locator('.conversation-messages img')).toHaveCount(0)
  await expect(page.getByLabel('Pregunta o consulta para la IA')).toHaveValue('')
  await expect(other.getByText('Hay una asociación entre las clases.', { exact: true })).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: 'Asistente IA · Qwen3', exact: true }).click()
  await expect(page.getByRole('list', { name: 'Mensajes del equipo' })).toContainText('Hay una asociación entre las clases.')
  await page.screenshot({ path: '../../.qa/conversation-dialog.png' })
  await otherContext.close()
})

test('un envío incierto conserva el borrador y la clave de reintento sin saltar mensajes concurrentes', async ({ page }) => {
  const state = room()
  state.add('Inicio')
  await state.install(page, 'Ana')
  state.options.insertBeforePost = true
  state.options.failNextPost = true
  await page.getByLabel('Pregunta o consulta para la IA').fill('Mi propuesta')
  await page.getByRole('button', { name: 'Preguntar a la IA' }).click()
  await expect(page.getByRole('alert')).toContainText('No se pudo confirmar el envío')
  await expect(page.getByLabel('Pregunta o consulta para la IA')).toHaveValue('Mi propuesta')
  await page.getByRole('button', { name: 'Preguntar a la IA' }).click()
  await expect(page.getByLabel('Pregunta o consulta para la IA')).toHaveValue('')
  await expect(page.getByText('Mensaje concurrente', { exact: true })).toBeVisible()
  await expect(page.getByText('Mi propuesta', { exact: true })).toHaveCount(1)
  expect(state.requestIds).toHaveLength(2)
  expect(state.requestIds[0]).toBe(state.requestIds[1])
  expect(state.messages).toHaveLength(3)
})

test('la consulta periódica retira el historial y el formulario si se revoca el acceso', async ({ page }) => {
  const state = room()
  state.add('Mensaje privado del equipo')
  await state.install(page, 'Ana')
  await expect(page.getByText('Mensaje privado del equipo', { exact: true })).toBeVisible()
  state.options.denied = true
  await expect(page.getByRole('alert')).toContainText('Acceso revocado')
  await expect(page.getByText('Mensaje privado del equipo', { exact: true })).toHaveCount(0)
  await expect(page.getByLabel('Pregunta o consulta para la IA')).toHaveCount(0)
})
