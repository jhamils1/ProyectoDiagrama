import { test, expect, type Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'

async function setup(page: Page, permission = 'EDICION') {
  const project = randomUUID(), diagram = randomUUID()
  await page.routeWebSocket('**/live', () => {})
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/backend')) return route.fallback()
    let json: unknown = {}
    if (path.endsWith('/auth/me')) json = { id: randomUUID(), nombre: 'Demo', correo: 'demo@test.local', rol: 'COLABORADOR', activo: true, revision: 0 }
    else if (path.endsWith('/state')) json = { revision: 3, permiso: permission }
    else if (path.endsWith(`/projects/${project}`)) json = { id: project, nombre: 'Proyecto demo', descripcion: '', permiso: permission, revision: 0 }
    else if (path.endsWith(`/diagrams/${diagram}`)) json = {
      revision: 3, versionActual: 4, permiso: permission,
      document: { schemaVersion: 1, id: diagram, name: 'Modelo demo', localRevision: 3, updatedAt: new Date().toISOString(),
        classes: [{ id: randomUUID(), name: 'Cliente', abstract: false, position: { x: 50, y: 50 }, attributes: [] }], relations: [] },
    }
    await route.fulfill({ json })
  })
  return { project, diagram, open: () => page.goto(`/workspace?project=${project}&diagram=${diagram}`) }
}

test('CU11 descarga la revisión guardada y muestra errores sin descargar', async ({ page }) => {
  const state = await setup(page)
  let valid = false
  await page.route('**/backend?revision=*', async route => {
    expect(new URL(route.request().url()).searchParams.get('revision')).toBe('3')
    if (valid) await route.fulfill({ contentType: 'application/zip', body: Buffer.from('PK\x05\x06' + '\x00'.repeat(18)) })
    else await route.fulfill({ status: 422, json: { code: 'GENERACION_INVALIDA', message: 'Revisa el modelo', issues: [{ message: 'Marca un atributo Long como identificador de Cliente.' }] } })
  })
  await state.open()
  const button = page.getByRole('button', { name: 'Generar backend', exact: true })
  await button.click()
  await expect(page.getByRole('alert')).toContainText('Marca un atributo Long')
  valid = true
  const download = page.waitForEvent('download')
  await button.click()
  expect((await download).suggestedFilename()).toBe(`backend-${state.diagram}-r3.zip`)
  await expect(page.getByRole('alert')).toHaveCount(0)
  await page.locator('.class-node').click()
  await page.getByLabel('Nombre de la clase', { exact: true }).fill('Pendiente')
  await expect(button).toBeDisabled()
})

test('CU11 consulta no permite generar', async ({ page }) => {
  const state = await setup(page, 'CONSULTA')
  await state.open()
  await expect(page.getByRole('button', { name: 'Generar backend', exact: true })).toBeDisabled()
})
