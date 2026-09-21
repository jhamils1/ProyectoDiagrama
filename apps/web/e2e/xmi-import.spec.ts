import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'

test('CU09 revisa decisiones antes de guardar y reintenta sin cambiar identidades', async ({ page }) => {
  const project = randomUUID(), user = randomUUID()
  const document = { schemaVersion: 1, id: randomUUID(), name: 'Diagrama importado', localRevision: 0, updatedAt: new Date().toISOString(),
    classes: [{ id: randomUUID(), name: 'Cliente', abstract: false, position: { x: 40, y: 70 }, attributes: [] }], relations: [] }
  const saved: unknown[] = []
  await page.routeWebSocket('**/live', () => {})
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    let json: unknown = {}
    if (path.endsWith('/auth/me')) json = { id: user, nombre: 'Demo', correo: 'demo@test.local', rol: 'ADMINISTRADOR', activo: true, revision: 0 }
    else if (path.endsWith('/auth/csrf')) json = { headerName: 'X-CSRF-TOKEN', token: 'test' }
    else if (path.endsWith(`/projects/${project}`)) json = { id: project, nombre: 'Proyecto demo', descripcion: '', permiso: 'ADMINISTRACION', revision: 0 }
    else if (path.endsWith('/preview')) {
      const input = route.request().postDataJSON()
      expect(Buffer.from(input.xmlBase64, 'base64').toString()).toContain('xmi:XMI')
      json = input.attributeTypes.attribute === 'Double' && input.excludedInvalidAssociations.includes('broken')
        ? { document: { ...document, name: input.name }, issues: [], notices: ['Real → Double', 'Asociación inválida excluida.'] }
        : { document: null, issues: [
          { code: 'TYPE_MAPPING_REQUIRED', elementId: 'attribute', message: 'Pedido.total usa Real.', suggestedType: 'Double' },
          { code: 'ASSOCIATION_ENDS_INVALID', elementId: 'broken', message: 'Asociación vacía', emptyAssociation: true },
        ], notices: [] }
    } else if (path.endsWith('/diagrams') && route.request().method() === 'POST') {
      saved.push(route.request().postDataJSON())
      return route.fulfill({ status: 503, json: { message: 'Respuesta temporalmente no disponible' } })
    } else if (path.endsWith('/diagrams')) json = { items: [], total: 0, page: 0, size: 20 }
    await route.fulfill({ json })
  })
  await page.goto(`/workspace?project=${project}`)
  await page.getByRole('button', { name: 'Importar XML de EA' }).click()
  await page.getByLabel('Archivo XML').setInputFiles(resolve(import.meta.dirname, '../../api/src/test/resources/interoperability/ea-sample.xml'))
  const confirm = page.getByRole('button', { name: 'Confirmar importación' })
  await expect(page.getByRole('region', { name: 'Vista previa de importación' })).toContainText('Cliente')
  await expect(confirm).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Revisar importación' })).toHaveCount(0)
  await page.getByText('Opciones avanzadas', { exact: true }).click()
  await expect(page.getByLabel('Tipo equivalente (1)')).toHaveValue('Double')
  await page.getByLabel('Excluir esta asociación inválida de la importación').uncheck()
  await expect(page.getByRole('status')).toContainText('requieren tu decisión')
  await expect(confirm).toBeDisabled()
  await page.getByLabel('Excluir esta asociación inválida de la importación').check()
  await expect(confirm).toBeEnabled()
  expect(saved).toHaveLength(0)
  await page.getByLabel('Nombre del diagrama', { exact: true }).fill('Importado revisado')
  await expect(confirm).toBeEnabled()
  await confirm.click()
  await expect(page.getByRole('alert')).toContainText('Respuesta temporalmente')
  await confirm.click()
  await expect.poll(() => saved.length).toBe(2)
  expect(saved[0]).toEqual(saved[1])
  await expect(page.getByLabel('Archivo XML')).toBeDisabled()
})

test('CU09 importa XML real, conserva relaciones y recupera el diagrama', async ({ page }) => {
  test.skip(process.env.MODELA_E2E_REAL !== '1', 'Requiere API local')
  const cfg = JSON.parse(readFileSync(resolve(import.meta.dirname, '../../../.local/backend.json'), 'utf8').replace(/^\uFEFF/, ''))
  async function write(path: string, method: string, data?: unknown) {
    const token = await (await page.request.get('/api/auth/csrf')).json()
    const response = await page.request.fetch(`/api${path}`, { method, data, headers: { [token.headerName]: token.token } })
    expect(response.ok(), `HTTP ${response.status()}`).toBe(true)
    return response.status() === 204 ? null : response.json()
  }
  await write('/auth/admin', 'POST', { correo: cfg.BOOTSTRAP_ADMIN_EMAIL, password: cfg.BOOTSTRAP_ADMIN_PASSWORD })
  const project = await write('/projects', 'POST', { nombre: `CU09 prueba ${Date.now()}`, descripcion: 'Importación XMI automatizada' })
  try {
    await page.goto(`/workspace?project=${project.id}`)
    await page.getByRole('button', { name: 'Importar XML de EA' }).click()
    await page.getByLabel('Archivo XML').setInputFiles(resolve(import.meta.dirname, '../../api/src/test/resources/interoperability/ea-sample.xml'))
    await expect(page.getByRole('region', { name: 'Vista previa de importación' })).toContainText('ClientePremium hereda de Cliente')
    await expect(page.getByRole('region', { name: 'Vista previa de importación' })).toContainText('Pedido.total: Real → Double')
    await expect(page.getByRole('region', { name: 'Vista previa de importación' })).toContainText('Se omitirá una relación vacía')
    const before = await (await page.request.get(`/api/projects/${project.id}/diagrams`)).json()
    expect(before.total).toBe(0)
    await page.screenshot({ path: resolve(import.meta.dirname, '../../../.qa/import-xmi-simple.png') })
    await page.getByRole('button', { name: 'Confirmar importación' }).click()
    await expect(page).toHaveURL(/diagram=/)
    await expect(page.locator('.class-node')).toHaveCount(3)
    await page.reload()
    await expect(page.locator('.class-node')).toHaveCount(3)
    const diagram = new URL(page.url()).searchParams.get('diagram')
    const saved = await (await page.request.get(`/api/projects/${project.id}/diagrams/${diagram}`)).json()
    expect(saved.document.relations).toHaveLength(2)
    const cliente = saved.document.classes.find((c: { name: string }) => c.name === 'Cliente')
    const premium = saved.document.classes.find((c: { name: string }) => c.name === 'ClientePremium')
    expect(saved.document.relations.find((r: { type: string }) => r.type === 'generalization')).toMatchObject({ sourceId: premium.id, targetId: cliente.id })
  } finally {
    const latest = await (await page.request.get(`/api/projects/${project.id}`)).json()
    await write(`/projects/${project.id}?revision=${latest.revision}`, 'DELETE')
  }
})
