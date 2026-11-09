import { test, expect } from '@playwright/test'

test('el administrador puede cambiar su nombre y recuperarlo al recargar', async ({ page }) => {
  let user = { id: 'a23e4567-e89b-42d3-a456-426614174000', nombre: 'Nombre anterior', correo: 'admin@test.local',
    rol: 'ADMINISTRADOR', activo: true, googleVinculado: false, revision: 0 }
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/auth/me')) return route.fulfill({ json: user })
    if (path.endsWith('/auth/csrf')) return route.fulfill({ json: { headerName: 'X-CSRF-TOKEN', token: 'test' } })
    if (path.endsWith('/users/me/name')) {
      const input = route.request().postDataJSON()
      expect(input).toEqual({ nombre: 'Nuevo nombre', revision: 0 })
      user = { ...user, nombre: input.nombre, revision: 1 }
      return route.fulfill({ json: user })
    }
    return route.fulfill({ json: { items: [], total: 0, page: 0, size: 20 } })
  })
  await page.goto('/workspace')
  await page.getByRole('button', { name: 'Editar mi nombre' }).click()
  await page.getByLabel('Tu nombre').fill(' Nuevo nombre ')
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.locator('.workspace-label')).toContainText('Nuevo nombre')
  await page.reload()
  await expect(page.locator('.workspace-label')).toContainText('Nuevo nombre')
})
