import { test, expect, type Page, type APIRequestContext } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Diagram } from '../src/features/modeling/domain/model'
import { createDiagram } from '../src/features/modeling/domain/model'

test.describe('Etapa 3 · diagramas con API real', () => {
  test.skip(process.env.MODELA_E2E_REAL !== '1', 'Requiere backend local y MODELA_E2E_REAL=1')
  let projectId: string
  async function write(request: APIRequestContext, path: string, method: string, data?: unknown) {
    const csrf = await (await request.get('/api/auth/csrf')).json()
    const result = await request.fetch(`/api${path}`, {
      method,
      data,
      headers: { [csrf.headerName]: csrf.token },
    })
    expect(result.ok(), `API ${method} ${path}: ${result.status()}`).toBe(true)
    return result.status() === 204 ? undefined : result.json()
  }
  async function login(request: APIRequestContext) {
    const settings = JSON.parse(
      readFileSync(resolve(import.meta.dirname, '../../..', '.local/backend.json'), 'utf8').replace(
        /^\uFEFF/,
        '',
      ),
    )
    await write(request, '/auth/admin', 'POST', {
      correo: settings.BOOTSTRAP_ADMIN_EMAIL,
      password: settings.BOOTSTRAP_ADMIN_PASSWORD,
    })
  }
  test.beforeEach(async ({ page }) => {
    await login(page.request)
    const project = await write(page.request, '/projects', 'POST', {
      nombre: `Diagramas E2E ${Date.now()}`,
      descripcion: 'Verificación de la tercera etapa',
    })
    projectId = project.id
  })
  test.afterEach(async ({ page }) => {
    const response = await page.request.get(`/api/projects/${projectId}`)
    if (response.ok()) {
      const project = await response.json()
      await write(page.request, `/projects/${projectId}?revision=${project.revision}`, 'DELETE')
    }
  })
  async function newDiagram(page: Page) {
    await page.goto(`/workspace?project=${projectId}`)
    await page.getByRole('button', { name: 'Nuevo diagrama', exact: true }).click()
    await page.getByLabel('Nombre del diagrama', { exact: true }).fill('Pedidos del proyecto')
    await page.getByRole('button', { name: 'Guardar diagrama', exact: true }).click()
    await expect(
      page.getByRole('heading', { name: 'Pedidos del proyecto', exact: true }),
    ).toBeVisible()
  }
  async function addClass(page: Page, name: string) {
    await page.getByRole('button', { name: 'Nueva clase', exact: true }).click()
    await page.getByLabel('Nombre de la clase', { exact: true }).fill(name)
    await page.getByRole('button', { name: 'Guardar propiedades', exact: true }).click()
    await expect(page.locator('.class-node').filter({ hasText: name })).toHaveCount(1)
  }
  async function saved(page: Page) {
    const id = new URL(page.url()).searchParams.get('diagram')
    return (await (await page.request.get(`/api/projects/${projectId}/diagrams/${id}`)).json())
      .document as Diagram
  }
  async function prepareCopy(page: Page) {
    await page
      .getByRole('button', { name: 'Preparar para trabajar sin conexión', exact: true })
      .click()
    await expect(page).toHaveURL(/offline=1/)
    await expect(
      page.getByText('Sincronizado · copia disponible sin conexión', { exact: true }),
    ).toBeVisible()
  }
  async function prepareProject(page: Page) {
    await page.goto(`/workspace?project=${projectId}`)
    await page.getByRole('button', { name: 'Preparar proyecto sin conexión', exact: true }).click()
    await expect(
      page.getByRole('button', { name: 'Nuevo diagrama sin conexión', exact: true }),
    ).toBeEnabled()
  }
  async function createOffline(page: Page, name: string) {
    await page.getByRole('button', { name: 'Nuevo diagrama sin conexión', exact: true }).click()
    await page.getByLabel('Nombre del diagrama', { exact: true }).fill(name)
    await page.getByRole('button', { name: 'Crear en este equipo', exact: true }).click()
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible()
    return new URL(page.url()).searchParams.get('diagram')!
  }
  test('5B: proyecto vacío permite crear y editar offline; el panel sincroniza sin abrir el editor', async ({
    page,
    context,
  }, info) => {
    test.setTimeout(60000)
    await prepareProject(page)
    await context.setOffline(true)
    const id = await createOffline(page, 'Creado sin red')
    await addClass(page, 'ClienteLocal')
    await page.reload()
    await expect(page.locator('.class-node')).toContainText('ClienteLocal')
    await page.goto('/workspace?copies=1')
    await expect(
      page.getByText('Diagrama nuevo pendiente de sincronizar', { exact: true }),
    ).toBeVisible()
    await page.screenshot({ path: info.outputPath('proyecto-nuevo-offline.png'), fullPage: true })
    expect(
      (await (await page.request.get(`/api/projects/${projectId}/diagrams`)).json()).total,
    ).toBe(0)
    await context.setOffline(false)
    await expect(page.getByText('Sin pendientes', { exact: true })).toBeVisible({ timeout: 20000 })
    const remote = await (
      await page.request.get(`/api/projects/${projectId}/diagrams/${id}`)
    ).json()
    expect(remote.document.name).toBe('Creado sin red')
    expect(remote.document.classes[0].name).toBe('ClienteLocal')
    expect(remote.versionActual).toBe(1)
  })
  test('5B: reintentar creación tras respuesta perdida conserva una edición remota posterior', async ({
    page,
    context,
  }) => {
    test.setTimeout(60000)
    await prepareProject(page)
    await context.setOffline(true)
    const id = await createOffline(page, 'Creación original')
    const path = `/projects/${projectId}/diagrams/${id}`
    let dropped = false
    const ids: string[] = []
    await page.route('**/changes/create', async (route) => {
      ids.push(route.request().postDataJSON().id)
      if (dropped) return route.continue()
      dropped = true
      const response = await route.fetch()
      expect(response.ok()).toBe(true)
      const remote = (await response.json()).current
      remote.document.name = 'Edición posterior de otra sesión'
      await write(page.request, path, 'PUT', {
        revision: remote.revision,
        document: remote.document,
      })
      await route.abort('connectionclosed')
    })
    await context.setOffline(false)
    await expect(page.getByText(/Envío sin confirmar/)).toBeVisible({ timeout: 20000 })
    await page.reload()
    await expect(
      page.getByRole('heading', { name: 'Edición posterior de otra sesión', exact: true }),
    ).toBeVisible()
    expect(new Set(ids).size).toBe(1)
    expect(ids.length).toBeGreaterThanOrEqual(2)
    expect((await (await page.request.get(`/api${path}`)).json()).revision).toBe(1)
    expect(
      (await (await page.request.get(`/api/projects/${projectId}/diagrams`)).json()).total,
    ).toBe(1)
  })
  test('5B: la cola procesa otras copias aunque una tenga conflicto y otra se elimine', async ({
    page,
    context,
  }) => {
    test.setTimeout(90000)
    const docs = ['Uno', 'Dos', 'Tres'].map((name) => createDiagram(name))
    const urls: string[] = []
    for (const doc of docs) {
      await write(page.request, `/projects/${projectId}/diagrams`, 'POST', doc)
      await page.goto(`/workspace?project=${projectId}&diagram=${doc.id}`)
      await prepareCopy(page)
      urls.push(page.url())
    }
    await context.setOffline(true)
    for (let i = 0; i < docs.length; i++) {
      await page.goto(urls[i])
      await renameCopy(page, `Local ${i}`)
    }
    const firstPath = `/projects/${projectId}/diagrams/${docs[0].id}`
    const first = await (await page.request.get(`/api${firstPath}`)).json()
    first.document.name = 'Nombre remoto en conflicto'
    await write(page.request, firstPath, 'PUT', {
      revision: first.revision,
      document: first.document,
    })
    await write(page.request, `/projects/${projectId}/diagrams/${docs[2].id}?revision=0`, 'DELETE')
    await page.goto('/workspace?copies=1')
    await context.setOffline(false)
    await expect(page.getByText('Sin pendientes', { exact: true })).toBeVisible({ timeout: 20000 })
    await expect(page.getByText('Conflicto pendiente', { exact: true })).toBeVisible()
    await expect(
      page.getByText('Requiere comprobar permiso con conexión', { exact: true }),
    ).toBeVisible()
    expect(
      (await (await page.request.get(`/api/projects/${projectId}/diagrams/${docs[1].id}`)).json())
        .document.name,
    ).toBe('Local 1')
    await page.goto(urls[0])
    const dialog = page.getByRole('dialog', { name: 'Resolver cambios' })
    await expect(dialog).toContainText('Local 0')
    await page.getByLabel('Elección 1', { exact: true }).selectOption('local')
    await page.getByRole('button', { name: 'Guardar resolución', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    expect((await (await page.request.get(`/api${firstPath}`)).json()).document.name).toBe(
      'Local 0',
    )
  })
  test('5B: cerrar sesión durante el envío del panel conserva el recibo para recuperar sin duplicar', async ({
    page,
    context,
  }) => {
    test.setTimeout(60000)
    await prepareProject(page)
    await context.setOffline(true)
    const id = await createOffline(page, 'Alta con respuesta demorada')
    await page.goto('/workspace?copies=1')
    let release = () => {},
      committed = false,
      delivered = false
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    await page.route('**/changes/create', async (route) => {
      const response = await route.fetch()
      expect(response.ok()).toBe(true)
      committed = true
      await gate
      await route.fulfill({ response })
      delivered = true
    })
    try {
      await context.setOffline(false)
      await expect.poll(() => committed, { timeout: 20000 }).toBe(true)
      await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click()
      await expect(
        page.getByRole('heading', { name: 'Accede a tu espacio', exact: true }),
      ).toBeVisible()
      release()
      await expect.poll(() => delivered).toBe(true)
      await page.unroute('**/changes/create')
      await login(page.request)
      await page.goto('/workspace?copies=1')
      await expect(page.getByText('Sin pendientes', { exact: true })).toBeVisible({
        timeout: 20000,
      })
      expect(
        (await (await page.request.get(`/api/projects/${projectId}/diagrams/${id}`)).json())
          .revision,
      ).toBe(0)
      expect(
        (await (await page.request.get(`/api/projects/${projectId}/diagrams`)).json()).total,
      ).toBe(1)
    } finally {
      release()
      await context.setOffline(false)
      await login(page.request)
    }
  })
  async function renameCopy(page: Page, name: string) {
    await page.getByRole('button', { name: 'Renombrar diagrama', exact: true }).click()
    await page.getByLabel('Nombre del diagrama', { exact: true }).fill(name)
    await page.getByRole('button', { name: 'Guardar nombre', exact: true }).click()
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible()
  }
  test('P-CU08/12 offline: guarda varios cambios, recarga sin red y combina al reconectar', async ({
    page,
    context,
  }, info) => {
    test.setTimeout(60000)
    await newDiagram(page)
    const diagramId = new URL(page.url()).searchParams.get('diagram')
    await prepareCopy(page)
    await context.setOffline(true)
    await renameCopy(page, 'Trabajo sin internet')
    await addClass(page, 'ClienteOffline')
    await page.reload()
    await expect(
      page.getByRole('heading', { name: 'Trabajo sin internet', exact: true }),
    ).toBeVisible()
    await expect(page.locator('.class-node')).toContainText('ClienteOffline')
    await page.screenshot({ path: info.outputPath('edicion-offline.png'), fullPage: true })
    // APIRequestContext is independent of browser network emulation: another client edits centrally.
    const path = `/projects/${projectId}/diagrams/${diagramId}`
    const remote = await (await page.request.get(`/api${path}`)).json()
    expect(remote.document.name).toBe('Pedidos del proyecto')
    remote.document.classes.push({
      id: crypto.randomUUID(),
      name: 'Servidor',
      abstract: false,
      position: { x: 100, y: 100 },
      attributes: [],
    })
    await write(page.request, path, 'PUT', { revision: remote.revision, document: remote.document })
    await context.setOffline(false)
    await expect(
      page.getByText('Sincronizado · copia disponible sin conexión', { exact: true }),
    ).toBeVisible({ timeout: 20000 })
    expect((await saved(page)).name).toBe('Trabajo sin internet')
    expect((await saved(page)).classes.map((c) => c.name).sort()).toEqual([
      'ClienteOffline',
      'Servidor',
    ])
    await page.reload()
    await expect(page.locator('.class-node')).toHaveCount(2)
  })
  test('P-CU12 offline: conflicto al reconectar conserva propuesta y permite elegir', async ({
    page,
    context,
  }) => {
    test.setTimeout(60000)
    await newDiagram(page)
    const path = `/projects/${projectId}/diagrams/${new URL(page.url()).searchParams.get('diagram')}`
    await prepareCopy(page)
    await context.setOffline(true)
    await renameCopy(page, 'Nombre local')
    const remote = await (await page.request.get(`/api${path}`)).json()
    remote.document.name = 'Nombre remoto'
    await write(page.request, path, 'PUT', { revision: remote.revision, document: remote.document })
    await context.setOffline(false)
    const dialog = page.getByRole('dialog', { name: 'Resolver cambios' })
    await expect(dialog).toContainText('Nombre local', { timeout: 20000 })
    await expect(dialog).toContainText('Nombre remoto')
    await page.reload()
    await expect(dialog).toContainText('Nombre local')
    await page.getByLabel('Elección 1', { exact: true }).selectOption('local')
    await page.getByRole('button', { name: 'Guardar resolución', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    expect((await saved(page)).name).toBe('Nombre local')
  })
  test('P-CU12 offline: respuesta perdida y recarga reenvían el mismo UUID sin duplicar', async ({
    page,
  }) => {
    test.setTimeout(60000)
    await newDiagram(page)
    await prepareCopy(page)
    let dropped = false
    const ids: string[] = []
    await page.route('**/diagrams/*/changes', async (route) => {
      if (route.request().method() !== 'POST') return route.continue()
      ids.push(route.request().postDataJSON().id)
      if (!dropped) {
        dropped = true
        await route.fetch()
        await route.abort('connectionclosed')
      } else await route.continue()
    })
    await renameCopy(page, 'Enviado una vez')
    await page.getByRole('button', { name: 'Actualizar y sincronizar', exact: true }).click()
    await expect(page.getByText(/Envío sin confirmar/)).toBeVisible()
    const revision = (await saved(page)).localRevision
    await page.reload()
    await expect(
      page.getByText('Sincronizado · copia disponible sin conexión', { exact: true }),
    ).toBeVisible()
    expect(ids.length).toBeGreaterThanOrEqual(2)
    expect(new Set(ids).size).toBe(1)
    expect((await saved(page)).localRevision).toBe(revision)
  })
  test('P-CU13 offline: cerrar sesión bloquea otra pestaña y recupera pendientes al autenticar', async ({
    page,
    context,
  }) => {
    test.setTimeout(60000)
    await newDiagram(page)
    await prepareCopy(page)
    const copyUrl = page.url()
    const other = await context.newPage()
    await other.goto('/workspace?copies=1')
    await expect(
      other.getByRole('heading', { name: 'Copias sin conexión', exact: true }),
    ).toBeVisible()
    await context.setOffline(true)
    await renameCopy(page, 'Pendiente privado')
    await other.getByRole('button', { name: 'Cerrar sesión', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Pendiente privado', exact: true })).toHaveCount(
      0,
    )
    await page.reload()
    await expect(
      page.getByRole('heading', { name: 'Accede a tu espacio', exact: true }),
    ).toBeVisible()
    await context.setOffline(false)
    // First navigation completes the deferred server logout before signing in again.
    await page.goto('/workspace')
    await expect(
      page.getByRole('heading', { name: 'Accede a tu espacio', exact: true }),
    ).toBeVisible()
    await login(page.request)
    await page.goto(copyUrl)
    await expect(
      page.getByRole('heading', { name: 'Pendiente privado', exact: true }),
    ).toBeVisible()
    await expect(
      page.getByText('Sincronizado · copia disponible sin conexión', { exact: true }),
    ).toBeVisible()
    await other.close()
  })
  test('P-CU12 offline: proyecto eliminado bloquea la copia sin perder su propuesta', async ({
    page,
    context,
  }) => {
    test.setTimeout(60000)
    await newDiagram(page)
    await prepareCopy(page)
    await context.setOffline(true)
    await renameCopy(page, 'Pendiente eliminado')
    const project = await (await page.request.get(`/api/projects/${projectId}`)).json()
    await write(page.request, `/projects/${projectId}?revision=${project.revision}`, 'DELETE')
    await context.setOffline(false)
    await expect(
      page.getByRole('heading', { name: 'Pendiente eliminado', exact: true }),
    ).toHaveCount(0, { timeout: 20000 })
    await page.goto('/workspace?copies=1')
    await expect(
      page.getByRole('heading', { name: 'Pendiente eliminado', exact: true }),
    ).toBeVisible()
    await expect(
      page.getByText('Requiere comprobar permiso con conexión', { exact: true }),
    ).toBeVisible()
  })
  test('P-CU13 offline: una confirmación tardía no desbloquea copias tras cerrar sesión', async ({
    page,
    context,
  }) => {
    test.setTimeout(60000)
    await newDiagram(page)
    await prepareCopy(page)
    const copyUrl = page.url()
    const other = await context.newPage()
    await other.goto('/workspace?copies=1')
    await expect(other.getByRole('button', { name: 'Cerrar sesión', exact: true })).toBeVisible()
    let release = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    let committed = false,
      delivered = false
    await page.route('**/diagrams/*/changes', async (route) => {
      if (route.request().method() !== 'POST') return route.continue()
      const response = await route.fetch()
      expect(response.ok()).toBe(true)
      committed = true
      await gate
      await route.fulfill({ response })
      delivered = true
    })
    try {
      await renameCopy(page, 'Confirmación demorada')
      await page.getByRole('button', { name: 'Actualizar y sincronizar', exact: true }).click()
      await expect.poll(() => committed).toBe(true)
      await other.getByRole('button', { name: 'Cerrar sesión', exact: true }).click()
      await expect(
        page.getByRole('heading', { name: 'Accede a tu espacio', exact: true }),
      ).toBeVisible()
      release()
      await expect.poll(() => delivered).toBe(true)
      await expect(
        page.getByRole('heading', { name: 'Confirmación demorada', exact: true }),
      ).toHaveCount(0)
      await login(page.request)
      await page.goto(copyUrl)
      await expect(
        page.getByText('Sincronizado · copia disponible sin conexión', { exact: true }),
      ).toBeVisible()
      expect((await saved(page)).localRevision).toBe(1)
    } finally {
      release()
      await login(page.request)
      await other.close()
    }
  })
  test('P-CU12: cambios compatibles se integran sin abrir resolución', async ({
    page,
    context,
  }) => {
    await newDiagram(page)
    await addClass(page, 'Cliente')
    const other = await context.newPage()
    await other.goto(page.url())
    await other.locator('.class-node').click()
    await other.getByLabel('Nombre de la clase', { exact: true }).fill('Comprador')
    await page.getByRole('button', { name: 'Renombrar diagrama', exact: true }).click()
    await page.getByLabel('Nombre del diagrama', { exact: true }).fill('Nombre compartido')
    await page.getByRole('button', { name: 'Guardar nombre', exact: true }).click()
    await expect(
      page.getByRole('heading', { name: 'Nombre compartido', exact: true }),
    ).toBeVisible()
    await other.getByRole('button', { name: 'Guardar propiedades', exact: true }).click()
    await expect(
      other.getByRole('heading', { name: 'Nombre compartido', exact: true }),
    ).toBeVisible()
    await expect(other.locator('.class-node')).toContainText('Comprador')
    await expect(other.getByRole('dialog', { name: 'Resolver cambios' })).toHaveCount(0)
    expect((await saved(other)).classes[0].name).toBe('Comprador')
    await other.close()
  })

  test('P-CU12: conflicto se recupera al reabrir, valida valor nuevo y exige revisar otra carrera', async ({
    page,
    context,
  }, info) => {
    test.setTimeout(60000)
    await newDiagram(page)
    const other = await context.newPage()
    await other.goto(page.url())
    await other.getByRole('button', { name: 'Renombrar diagrama', exact: true }).click()
    await other.getByLabel('Nombre del diagrama', { exact: true }).fill('Mi propuesta')
    await page.getByRole('button', { name: 'Renombrar diagrama', exact: true }).click()
    await page.getByLabel('Nombre del diagrama', { exact: true }).fill('Propuesta del servidor')
    await page.getByRole('button', { name: 'Guardar nombre', exact: true }).click()
    await expect(
      page.getByRole('heading', { name: 'Propuesta del servidor', exact: true }),
    ).toBeVisible()
    await other.getByRole('button', { name: 'Guardar nombre', exact: true }).click()
    const dialog = other.getByRole('dialog', { name: 'Resolver cambios' })
    await expect(dialog).toContainText('Mi propuesta')
    await expect(dialog).toContainText('Propuesta del servidor')
    await other.getByRole('button', { name: 'Dejar pendiente', exact: true }).click()
    await other.reload()
    await expect(dialog).toContainText('Mi propuesta')
    await other.getByLabel('Elección 1', { exact: true }).selectOption('custom')
    await other.getByLabel('Nuevo valor 1', { exact: true }).fill('')
    await other.getByRole('button', { name: 'Guardar resolución', exact: true }).click()
    await expect(dialog.getByRole('alert')).toBeVisible()
    expect((await saved(page)).name).toBe('Propuesta del servidor')
    await other.getByLabel('Nuevo valor 1', { exact: true }).fill('Acuerdo final')
    // A third committed revision arrives while choices are being reviewed.
    const id = new URL(page.url()).searchParams.get('diagram')
    const path = `/projects/${projectId}/diagrams/${id}`
    const current = await (await page.request.get(`/api${path}`)).json()
    current.document.name = 'Tercera propuesta'
    await write(page.request, path, 'PUT', {
      revision: current.revision,
      document: current.document,
    })
    await other.getByRole('button', { name: 'Guardar resolución', exact: true }).click()
    await expect(dialog).toContainText('Tercera propuesta')
    await expect(other.getByLabel('Elección 1', { exact: true })).toHaveValue('')
    await other.screenshot({ path: info.outputPath('resolver-conflicto.png'), fullPage: true })
    await other.setViewportSize({ width: 390, height: 844 })
    expect(await other.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    )
    await other.screenshot({
      path: info.outputPath('resolver-conflicto-estrecho.png'),
      fullPage: true,
    })
    await other.getByLabel('Elección 1', { exact: true }).selectOption('custom')
    await other.getByLabel('Nuevo valor 1', { exact: true }).fill('Acuerdo final')
    await other.getByRole('button', { name: 'Guardar resolución', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await expect(other.getByRole('heading', { name: 'Acuerdo final', exact: true })).toBeVisible()
    expect(await (await page.request.get(`/api${path}/changes`)).json()).toEqual([])
    await other.close()
  })

  test('P-CU12: respuesta perdida se reintenta sin duplicar la versión', async ({ page }) => {
    await newDiagram(page)
    let interrupted = false
    await page.route('**/diagrams/*/changes', async (route) => {
      if (route.request().method() === 'POST' && !interrupted) {
        interrupted = true
        const response = await route.fetch()
        expect(response.ok()).toBe(true)
        await route.abort('connectionclosed')
      } else await route.continue()
    })
    await page.getByRole('button', { name: 'Renombrar diagrama', exact: true }).click()
    await page.getByLabel('Nombre del diagrama', { exact: true }).fill('Guardado una vez')
    await page.getByRole('button', { name: 'Guardar nombre', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('No se pudo conectar')
    const first = await saved(page)
    expect(first.name).toBe('Guardado una vez')
    await expect(page.getByLabel('Nombre del diagrama', { exact: true })).toHaveValue(
      'Guardado una vez',
    )
    await page.getByRole('button', { name: 'Guardar nombre', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Guardado una vez', exact: true })).toBeVisible()
    expect((await saved(page)).localRevision).toBe(first.localRevision)
  })
  test('P-CU12: una respuesta tardía no repone datos después de cerrar sesión', async ({
    page,
  }) => {
    test.setTimeout(45000)
    await newDiagram(page)
    await expect(page.getByLabel('Usuarios conectados')).toContainText('1 usuario(s) conectado(s)')
    let release = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    let committed = false
    let delivered = false
    await page.route('**/diagrams/*/changes', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue()
        return
      }
      const response = await route.fetch()
      expect(response.ok()).toBe(true)
      committed = true
      await gate
      await route.fulfill({ response })
      delivered = true
    })
    try {
      await page.getByRole('button', { name: 'Renombrar diagrama', exact: true }).click()
      await page.getByLabel('Nombre del diagrama', { exact: true }).fill('Respuesta demorada')
      await page.getByRole('button', { name: 'Guardar nombre', exact: true }).click()
      await expect.poll(() => committed).toBe(true)
      await write(page.request, '/auth/logout', 'POST')
      await expect(page.getByRole('alert')).toContainText(
        /ya no están disponibles|Debes iniciar sesión/,
        {
          timeout: 15000,
        },
      )
      release()
      await expect.poll(() => delivered).toBe(true)
      await expect(
        page.getByRole('button', { name: 'Recargar diagrama', exact: true }),
      ).toBeEnabled()
      await expect(
        page.getByRole('heading', { name: 'Respuesta demorada', exact: true }),
      ).toHaveCount(0)
      await expect(page.getByLabel('Nombre del diagrama', { exact: true })).toHaveCount(0)
    } finally {
      release()
      await login(page.request)
    }
  })
  test('P-CU08: WebSocket reconecta, conserva propuestas y cierra una sesión finalizada', async ({
    page,
    browser,
  }, info) => {
    test.setTimeout(60000)
    await newDiagram(page)
    const independent = await browser.newContext({ baseURL: 'http://127.0.0.1:4173' })
    try {
      await login(independent.request)
      const second = await independent.newPage()
      let attempts = 0
      let cut = () => {}
      const revisions: number[] = []
      await second.routeWebSocket('**/live', (channel) => {
        attempts++
        const server = channel.connectToServer()
        server.onMessage((message) => {
          const state = JSON.parse(String(message))
          revisions.push(state.revision)
          channel.send(message)
        })
        cut = () => {
          channel.close({ code: 1012, reason: 'Prueba de reconexion' })
          server.close({ code: 1012, reason: 'Prueba de reconexion' })
        }
      })
      await second.goto(page.url())
      await expect(second.getByLabel('Usuarios conectados')).toContainText('2 conexiones')
      cut()
      const id = new URL(page.url()).searchParams.get('diagram')
      const path = `/projects/${projectId}/diagrams/${id}`
      const first = await (await page.request.get(`/api${path}`)).json()
      first.document.name = 'Guardado durante desconexión'
      const updated = await write(page.request, path, 'PUT', {
        revision: first.revision,
        document: first.document,
      })
      await expect.poll(() => attempts).toBeGreaterThanOrEqual(2)
      await expect.poll(() => revisions.includes(updated.revision)).toBe(true)
      await expect(
        second.getByRole('heading', { name: 'Guardado durante desconexión', exact: true }),
      ).toBeVisible()
      await second.getByRole('button', { name: 'Renombrar diagrama', exact: true }).click()
      await second.getByLabel('Nombre del diagrama', { exact: true }).fill('Propuesta conservada')
      updated.document.name = 'Cambio confirmado'
      const next = await write(page.request, path, 'PUT', {
        revision: updated.revision,
        document: updated.document,
      })
      await expect.poll(() => revisions.includes(next.revision)).toBe(true)
      await expect(second.getByText('Hay cambios de otra sesión.', { exact: false })).toBeVisible()
      await expect(second.getByLabel('Nombre del diagrama', { exact: true })).toHaveValue(
        'Propuesta conservada',
      )
      await page.screenshot({ path: info.outputPath('presencia-en-vivo.png'), fullPage: true })
      await write(independent.request, '/auth/logout', 'POST')
      await expect(second.getByRole('alert')).toContainText(
        /ya no están disponibles|Debes iniciar sesión/,
        {
          timeout: 15000,
        },
      )
      await expect(second.getByLabel('Nombre del diagrama', { exact: true })).toHaveCount(0)
      await expect(page.getByLabel('Usuarios conectados')).not.toContainText('conexiones', {
        timeout: 15000,
      })
    } finally {
      await independent.close()
    }
  })

  test('P-CU05: canal real rechaza origen ajeno y conexión anónima', async ({ page, browser }) => {
    await newDiagram(page)
    const id = new URL(page.url()).searchParams.get('diagram')
    const endpoint = `/api/projects/${projectId}/diagrams/${id}/live`
    const rejected = await page.request.get(endpoint, {
      headers: {
        Origin: 'http://evil.example',
        Connection: 'Upgrade',
        Upgrade: 'websocket',
        'Sec-WebSocket-Version': '13',
        'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==',
      },
    })
    expect(rejected.status()).toBe(403)
    const anonymous = await browser.newContext()
    try {
      const stranger = await anonymous.newPage()
      await stranger.goto('http://127.0.0.1:4173/')
      const opened = await stranger.evaluate(
        (path) =>
          new Promise<boolean>((resolve) => {
            const ws = new WebSocket(`ws://127.0.0.1:4173${path}`)
            const timeout = setTimeout(() => {
              ws.close()
              resolve(false)
            }, 5000)
            ws.onopen = () => {
              clearTimeout(timeout)
              ws.close()
              resolve(true)
            }
            ws.onerror = () => {
              clearTimeout(timeout)
              resolve(false)
            }
          }),
        endpoint,
      )
      expect(opened).toBe(false)
    } finally {
      await anonymous.close()
    }
  })
  test('P-CU08 parcial: dos sesiones reciben clases, atributos, relaciones y posiciones sin recargar', async ({
    page,
    browser,
  }) => {
    await newDiagram(page)
    const secondContext = await browser.newContext({ baseURL: 'http://127.0.0.1:4173' })
    try {
      await login(secondContext.request)
      const second = await secondContext.newPage()
      await second.goto(page.url())
      await expect(
        second.getByRole('heading', { name: 'Pedidos del proyecto', exact: true }),
      ).toBeVisible()
      await expect(second.getByLabel('Usuarios conectados')).toContainText(
        '1 usuario(s) conectado(s)',
      )
      await expect(second.getByLabel('Usuarios conectados')).toContainText('2 conexiones')
      await addClass(page, 'Cliente')
      await addClass(page, 'Pedido')
      await expect(second.locator('.class-node')).toHaveCount(2, { timeout: 12000 })
      // Update the full graph through the same authenticated API used by the editor.
      const id = new URL(page.url()).searchParams.get('diagram')
      const path = `/projects/${projectId}/diagrams/${id}`
      const envelope = await (await page.request.get(`/api${path}`)).json()
      const model: Diagram = envelope.document
      model.name = 'Cambios compartidos'
      model.classes[0].position = { x: 120, y: 180 }
      model.classes[0].attributes.push({
        id: crypto.randomUUID(),
        name: 'codigo',
        dataType: 'String',
        visibility: 'private',
        identifier: false,
        required: true,
      })
      model.relations.push({
        id: crypto.randomUUID(),
        name: 'compras',
        type: 'association',
        sourceId: model.classes[0].id,
        targetId: model.classes[1].id,
        sourceMultiplicity: '1',
        targetMultiplicity: '0..*',
      })
      await write(page.request, path, 'PUT', { revision: envelope.revision, document: model })
      await expect(
        second.getByRole('heading', { name: 'Cambios compartidos', exact: true }),
      ).toBeVisible({ timeout: 12000 })
      await expect(second.locator('.class-node').filter({ hasText: 'Cliente' })).toContainText(
        'codigo',
      )
      await expect(second.locator('.react-flow__edge')).toHaveCount(1)
      await expect(second.locator('.react-flow__node').filter({ hasText: 'Cliente' })).toHaveCSS(
        'transform',
        'matrix(1, 0, 0, 1, 120, 180)',
      )
      await second.getByRole('button', { name: 'Renombrar diagrama', exact: true }).click()
      await second
        .getByLabel('Nombre del diagrama', { exact: true })
        .fill('Respuesta de segunda sesión')
      await second.getByRole('button', { name: 'Guardar nombre', exact: true }).click()
      await expect(
        page.getByRole('heading', { name: 'Respuesta de segunda sesión', exact: true }),
      ).toBeVisible({ timeout: 12000 })
    } finally {
      await secondContext.close()
    }
    await expect(page.getByLabel('Usuarios conectados')).not.toContainText('2 conexiones')
  })

  test('P-CU08 parcial: actualización conserva formulario y se recupera de fallo de consulta', async ({
    page,
    context,
  }) => {
    await newDiagram(page)
    await addClass(page, 'Cliente')
    const other = await context.newPage()
    // Exercise the periodic fallback deliberately without a WebSocket transport.
    await other.routeWebSocket('**/live', (socket) => socket.close())
    await other.goto(page.url())
    await expect(other.locator('.class-node')).toHaveCount(1)
    await other.locator('.class-node').click()
    await other.getByLabel('Nombre de la clase', { exact: true }).fill('PropuestaPendiente')
    await page.getByRole('button', { name: 'Renombrar diagrama', exact: true }).click()
    await page.getByLabel('Nombre del diagrama', { exact: true }).fill('Cambio externo')
    await page.getByRole('button', { name: 'Guardar nombre', exact: true }).click()
    await page.getByLabel('Nombre de la clase', { exact: true }).fill('ClienteServidor')
    await page.getByRole('button', { name: 'Guardar propiedades', exact: true }).click()
    await expect(other.getByText('Hay cambios de otra sesión.', { exact: false })).toBeVisible({
      timeout: 12000,
    })
    await expect(other.getByLabel('Nombre de la clase', { exact: true })).toHaveValue(
      'PropuestaPendiente',
    )
    await other.getByRole('button', { name: 'Guardar propiedades', exact: true }).click()
    await expect(other.getByRole('dialog', { name: 'Resolver cambios' })).toContainText(
      'PropuestaPendiente',
    )
    await other.getByLabel('Elección 1', { exact: true }).selectOption('local')
    await other.getByRole('button', { name: 'Guardar resolución', exact: true }).click()
    await expect(other.getByRole('dialog', { name: 'Resolver cambios' })).toHaveCount(0)
    await expect(other.getByRole('heading', { name: 'Cambio externo', exact: true })).toBeVisible()
    await other.route('**/diagrams/*/state', (route) => route.abort())
    await expect(
      other.getByText('No se pudieron consultar cambios.', { exact: false }),
    ).toBeVisible({ timeout: 12000 })
    await expect(other.locator('.class-node')).toHaveCount(1)
    await other.unroute('**/diagrams/*/state')
    await expect(other.getByText('Actualización automática activa', { exact: false })).toBeVisible({
      timeout: 12000,
    })
    await other.route('**/diagrams/*/state', (route) =>
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Acceso revocado' }),
      }),
    )
    await expect(other.getByRole('alert')).toContainText('Acceso revocado', { timeout: 12000 })
    await expect(other.locator('.class-node')).toHaveCount(0)
    await other.close()
  })
  test('P-CU06/07/08: guardar estructura, recuperar en otra sesión y eliminar', async ({
    page,
    browser,
  }, info) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await newDiagram(page)
    await addClass(page, 'Cliente')
    await page.getByRole('button', { name: 'Agregar atributo', exact: true }).click()
    await page.getByLabel('Nombre del atributo', { exact: true }).fill('nombre')
    await page.getByRole('button', { name: 'Guardar atributo', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Editar atributo nombre' })).toBeVisible()
    await addClass(page, 'Pedido')
    await page.getByRole('button', { name: 'Relación', exact: true }).click()
    await page.getByLabel('Nombre de la relación').fill('realiza')
    await page.getByRole('button', { name: 'Guardar relación', exact: true }).click()
    await expect(page.locator('.react-flow__edge')).toHaveCount(1)
    const model = await saved(page)
    const node = page.locator('.react-flow__node').filter({ hasText: 'Pedido' })
    await node.focus()
    await node.press('ArrowRight')
    await expect
      .poll(async () => (await saved(page)).classes[1].position.x)
      .toBe(model.classes[1].position.x + 10)
    await page.screenshot({ path: info.outputPath('editor-proyecto.png'), fullPage: true })
    await page.setViewportSize({ width: 390, height: 844 })
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true)
    await page.screenshot({ path: info.outputPath('editor-proyecto-estrecho.png'), fullPage: true })
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.reload()
    await expect(page.locator('.class-node')).toHaveCount(2)
    await expect(page.locator('.react-flow__edge')).toHaveCount(1)
    // Fresh browser storage with only the authenticated cookie proves data came from the server.
    const separate = await browser.newContext({
      storageState: { cookies: await page.context().cookies(), origins: [] },
    })
    const second = await separate.newPage()
    await second.goto(page.url())
    await expect(second.locator('.class-node')).toHaveCount(2)
    await separate.close()
    await page.getByRole('button', { name: 'Renombrar diagrama', exact: true }).click()
    await page.getByLabel('Nombre del diagrama', { exact: true }).fill('Modelo de ventas')
    await page.getByRole('button', { name: 'Guardar nombre', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Modelo de ventas', exact: true })).toBeVisible()
    await page.getByRole('link', { name: 'Volver a diagramas', exact: true }).click()
    await expect(
      page.getByRole('button', { name: 'Eliminar diagrama Modelo de ventas', exact: true }),
    ).toBeVisible()
    await page.screenshot({ path: info.outputPath('diagramas-proyecto.png'), fullPage: true })
    await page
      .getByRole('button', { name: 'Eliminar diagrama Modelo de ventas', exact: true })
      .click()
    await page.getByRole('button', { name: 'Confirmar eliminación', exact: true }).click()
    await expect(
      page.getByRole('heading', { name: 'Este proyecto aún no tiene diagramas' }),
    ).toBeVisible()
    expect(errors).toEqual([])
  })
  test('P-CU08: dos pestañas rechazan cambios antiguos y fallo de red conserva formulario', async ({
    page,
    context,
  }) => {
    await newDiagram(page)
    await addClass(page, 'Cliente')
    const other = await context.newPage()
    await other.goto(page.url())
    await expect(other.locator('.class-node')).toHaveCount(1)
    // Opening the form first deliberately retains an old revision while the other tab saves.
    await other.getByRole('button', { name: 'Renombrar diagrama', exact: true }).click()
    await other.getByLabel('Nombre del diagrama', { exact: true }).fill('Cambio antiguo')
    await page.getByRole('button', { name: 'Renombrar diagrama', exact: true }).click()
    await page.getByLabel('Nombre del diagrama', { exact: true }).fill('Cambio primero')
    await page.getByRole('button', { name: 'Guardar nombre', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Cambio primero', exact: true })).toBeVisible()
    await other.getByRole('button', { name: 'Guardar nombre', exact: true }).click()
    await expect(other.getByRole('dialog', { name: 'Resolver cambios' })).toContainText(
      'Cambio antiguo',
    )
    expect((await saved(page)).name).toBe('Cambio primero')
    await other.close()
    await page.getByRole('button', { name: 'Renombrar diagrama', exact: true }).click()
    await page.getByLabel('Nombre del diagrama', { exact: true }).fill('Sin red')
    await page.route('**/api/**', (route) => route.abort('internetdisconnected'))
    await page.getByRole('button', { name: 'Guardar nombre', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('No se pudo conectar')
    await expect(page.getByLabel('Nombre del diagrama', { exact: true })).toHaveValue('Sin red')
    await page.unroute('**/api/**')
    expect((await saved(page)).name).toBe('Cambio primero')
    await page.getByRole('button', { name: 'Guardar nombre', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Sin red', exact: true })).toBeVisible()
  })
  test('P-CU07: copiar borrador conserva original y remapea identidades', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Crear mi primer diagrama', exact: true }).click()
    await addClass(page, 'Local')
    const local = await page.evaluate(
      () =>
        new Promise<Diagram[]>((resolve, reject) => {
          const request = indexedDB.open('uml-local-drafts-v1', 1)
          request.onerror = () => reject(request.error)
          request.onsuccess = () => {
            const db = request.result
            const read = db.transaction('diagrams').objectStore('diagrams').getAll()
            read.onsuccess = () => {
              db.close()
              resolve(read.result)
            }
          }
        }),
    )
    await page.goto(`/workspace?project=${projectId}`)
    await page.getByRole('button', { name: 'Copiar borrador local', exact: true }).click()
    await page
      .getByRole('combobox', { name: 'Borrador local', exact: true })
      .selectOption({ label: 'Diagrama 1' })
    await page.getByRole('button', { name: 'Guardar diagrama', exact: true }).click()
    await expect(page.locator('.class-node').filter({ hasText: 'Local' })).toHaveCount(1)
    const remote = await saved(page)
    expect(remote.id).not.toBe(local[0].id)
    expect(remote.classes[0].id).not.toBe(local[0].classes[0].id)
    await page.goto('/')
    await expect(page.locator('.class-node').filter({ hasText: 'Local' })).toHaveCount(1)
  })
})
