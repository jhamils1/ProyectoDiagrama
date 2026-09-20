import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Explicit opt-in: these tests use the real API and write isolated, named test records.
test.describe('Etapa 2 · API real con PostgreSQL', () => {
  test.skip(
    process.env.MODELA_E2E_REAL !== '1',
    'Requiere backend local iniciado y MODELA_E2E_REAL=1',
  )

  test('P-CU02/03/04/05/13: administrar un equipo, persistir y cerrar sesión', async ({
    page,
    context,
  }, info) => {
    test.setTimeout(90_000)
    const settings = JSON.parse(
      readFileSync(
        resolve(import.meta.dirname, '../../..', '.local/backend.json'),
        'utf8',
      ).replace(/^\uFEFF/, ''),
    )
    const suffix = Date.now().toString()
    const name = `Equipo E2E ${suffix}`
    const person = `Ana E2E ${suffix}`
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('/workspace')
    await expect(page.getByRole('heading', { name: 'Accede a tu espacio' })).toBeVisible()
    await page.screenshot({ path: info.outputPath('01-acceso.png'), fullPage: true })
    await page.getByRole('button', { name: 'Administrador', exact: true }).click()
    await page.getByLabel('Correo del Administrador').fill(settings.BOOTSTRAP_ADMIN_EMAIL)
    await page.getByLabel('Contraseña', { exact: true }).fill(settings.BOOTSTRAP_ADMIN_PASSWORD)
    await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Proyectos', exact: true })).toBeVisible()
    const cookie = (await context.cookies()).find((c) => c.name === 'MODELA_SESSION')
    expect(cookie?.httpOnly).toBe(true)
    expect(cookie?.sameSite).toBe('Lax')

    await page.getByRole('button', { name: 'Usuarios', exact: true }).click()
    await page.getByRole('button', { name: 'Nuevo colaborador', exact: true }).click()
    await page.getByLabel('Nombre del colaborador').fill(person)
    await page.getByLabel('Correo del colaborador').fill(`e2e.${suffix}@gmail.com`)
    await page.getByRole('button', { name: 'Guardar colaborador', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.getByRole('button', { name: 'Proyectos', exact: true }).click()
    await page.getByRole('button', { name: 'Nuevo proyecto', exact: true }).click()
    await page.getByLabel('Nombre del proyecto').fill(name)
    await page
      .getByLabel('Descripción', { exact: true })
      .fill('Verificación real de usuarios y permisos con PostgreSQL.')
    await page.getByRole('button', { name: 'Guardar proyecto', exact: true }).click()
    const card = page.locator('.project-card').filter({ hasText: name })
    await expect(card).toBeVisible()
    await page.reload()
    await expect(card).toBeVisible()
    await page.screenshot({ path: info.outputPath('02-proyectos.png'), fullPage: true })
    await card.getByRole('button', { name: 'Participantes', exact: true }).click()
    await page.getByRole('button', { name: 'Agregar participante', exact: true }).click()
    await page
      .getByRole('combobox', { name: 'Colaborador', exact: true })
      .selectOption({ label: `${person} · e2e.${suffix}@gmail.com` })
    await page.getByRole('combobox', { name: 'Permiso', exact: true }).selectOption('CONSULTA')
    await page.getByRole('button', { name: 'Guardar participante', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.getByLabel(`Permiso de ${person}`, { exact: true }).selectOption('EDICION')
    await expect(page.getByLabel(`Permiso de ${person}`, { exact: true })).toHaveValue('EDICION')
    await page.reload()
    await card.getByRole('button', { name: 'Participantes', exact: true }).click()
    await expect(page.getByLabel(`Permiso de ${person}`, { exact: true })).toHaveValue('EDICION')
    await page.screenshot({ path: info.outputPath('03-participantes.png'), fullPage: true })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.screenshot({
      path: info.outputPath('04-participantes-estrecho.png'),
      fullPage: true,
    })
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.getByRole('button', { name: `Quitar participante ${person}`, exact: true }).click()
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Quitar participante', exact: true })
      .click()
    await expect(page.getByLabel(`Permiso de ${person}`, { exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: 'Todos los proyectos', exact: true }).click()
    await card.getByRole('button', { name: `Eliminar proyecto ${name}`, exact: true }).click()
    await page.getByRole('button', { name: 'Confirmar eliminación', exact: true }).click()
    await expect(card).toHaveCount(0)
    await page.getByRole('button', { name: 'Usuarios', exact: true }).click()
    await page.getByRole('button', { name: `Editar usuario ${person}`, exact: true }).click()
    await page.getByLabel('Cuenta activa', { exact: true }).uncheck()
    await page.getByRole('button', { name: 'Guardar colaborador', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Accede a tu espacio' })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Accede a tu espacio' })).toBeVisible()
    expect(errors).toEqual([])
  })

  test('P-CU02: API no cacheada, acceso anónimo y CSRF rechazados', async ({ request }) => {
    const data = await request.get('/api/projects')
    expect(data.status()).toBe(401)
    expect(data.headers()['cache-control']).toContain('no-store')
    const login = await request.post('/api/auth/admin', {
      data: { correo: 'admin@modela.local', password: 'invalid' },
    })
    expect(login.status()).toBe(403)
    expect((await login.json()).code).toBe('SIN_PERMISO')
  })
})
