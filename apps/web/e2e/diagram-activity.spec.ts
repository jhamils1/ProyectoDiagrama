import { test, expect, type Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'

async function setup(page: Page) {
  const project = randomUUID(), diagram = randomUUID()
  const user = { id: randomUUID(), nombre: 'Ana', correo: 'ana@test.local', rol: 'COLABORADOR', activo: true }
  await page.routeWebSocket('**/live', () => {})
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/activity')) return route.fallback()
    let json: unknown = {}
    if (path.endsWith('/auth/me')) json = user
    else if (path.endsWith('/state')) json = { revision: 1, permiso: 'CONSULTA' }
    else if (path.endsWith('/changes')) json = []
    else if (path.endsWith(`/projects/${project}`)) json = { id: project, nombre: 'Equipo', permiso: 'CONSULTA', revision: 0 }
    else if (path.endsWith(`/diagrams/${diagram}`)) json = {
      revision: 1, versionActual: 2, permiso: 'CONSULTA',
      document: { schemaVersion: 1, id: diagram, name: 'Ventas', localRevision: 1,
        updatedAt: '2026-11-06T12:00:00Z', classes: [], relations: [] },
    }
    await route.fulfill({ json })
  })
  const entry = { version: 2, createdAt: '2026-11-06T12:00:00Z', authorId: user.id, authorName: 'Ana',
    totalChanges: 1, changes: [{ kind: 'class', elementId: randomUUID(), label: 'Producto',
      action: 'created', property: '', before: null, after: null }] }
  return { entry, open: () => page.goto(`/workspace?project=${project}&diagram=${diagram}`) }
}

test('participante de consulta abre actividad, pagina, cierra y recupera lo guardado', async ({ page }) => {
  const state = await setup(page)
  await page.route('**/activity*', async route => {
    const old = new URL(route.request().url()).searchParams.has('beforeVersion')
    await route.fulfill({ json: { items: [old ? {
      ...state.entry, version: 1, authorId: null, authorName: null, totalChanges: 0, changes: [],
    } : state.entry], nextBeforeVersion: old ? null : 2 } })
  })
  await state.open()
  await page.getByRole('button', { name: 'Actividad del diagrama', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Actividad del diagrama' })
  await expect(dialog).toContainText('Ana')
  await expect(dialog).toContainText('Creó clase Producto')
  await page.getByRole('button', { name: 'Ver cambios anteriores' }).click()
  await expect(dialog).toContainText('Autor no registrado')
  await expect(dialog).toContainText('Versión 2')
  await page.getByRole('button', { name: 'Cerrar actividad' }).click()
  await expect(dialog).toHaveCount(0)
  await page.reload()
  await page.getByRole('button', { name: 'Actividad del diagrama', exact: true }).click()
  await expect(dialog).toContainText('Creó clase Producto')
})

test('actividad permite reintentar y retira los datos cuando se revoca el acceso', async ({ page }) => {
  const state = await setup(page)
  let status = 503
  await page.route('**/activity*', async route => {
    await route.fulfill({ status, json: status === 200
      ? { items: [state.entry], nextBeforeVersion: 1 }
      : { message: status === 404 ? 'Acceso no disponible.' : 'Servicio no disponible.' } })
  })
  await state.open()
  await page.getByRole('button', { name: 'Actividad del diagrama', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Actividad del diagrama' })
  await expect(dialog.getByRole('alert')).toContainText('Servicio no disponible')
  status = 200
  await page.getByRole('button', { name: 'Actualizar actividad' }).click()
  await expect(dialog).toContainText('Creó clase Producto')
  status = 404
  await page.getByRole('button', { name: 'Ver cambios anteriores' }).click()
  await expect(dialog.getByRole('alert')).toContainText('Acceso no disponible')
  await expect(dialog).not.toContainText('Creó clase Producto')
})

test('consulta más cambios de una versión y retira el contenido si se revoca el acceso', async ({ page }) => {
  const state = await setup(page)
  const change = (label: string) => ({ kind: 'class', elementId: randomUUID(), label,
    action: 'created', property: '', before: null, after: null })
  let denied = false
  await page.route(/\/activity(?:\/2\/changes)?(?:\?.*)?$/, async route => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/2/changes')) {
      expect(url.searchParams.get('offset')).toBe('1')
      return route.fulfill(denied ? { status: 404, json: { message: 'Acceso no disponible.' } }
        : { json: { version: 2, items: [change('Proveedor')], totalChanges: 2, nextOffset: null } })
    }
    await route.fulfill({ json: { items: [{ ...state.entry, totalChanges: 2 }], nextBeforeVersion: null } })
  })
  await state.open()
  await page.getByRole('button', { name: 'Actividad del diagrama', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Actividad del diagrama' })
  await expect(dialog).toContainText('Se muestran 1 de 2 cambios')
  await dialog.getByRole('button', { name: 'Ver más cambios de la versión 2' }).click()
  await expect(dialog).toContainText('Creó clase Producto')
  await expect(dialog).toContainText('Creó clase Proveedor')
  await expect(dialog.getByRole('button', { name: 'Ver más cambios de la versión 2' })).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Actualizar actividad' }).click()
  denied = true
  await dialog.getByRole('button', { name: 'Ver más cambios de la versión 2' }).click()
  await expect(dialog.getByRole('alert')).toContainText('Acceso no disponible')
  await expect(dialog).not.toContainText('Producto')
})
