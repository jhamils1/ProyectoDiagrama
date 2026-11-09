import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'

test('métodos UML se guardan en API y sobreviven a recargas', async ({ page, context }) => {
  test.skip(process.env.MODELA_METHODS_REAL !== '1', 'Requiere la API aislada de métodos en 18080')
  const base = 'http://127.0.0.1:18080/api'
  async function call(path: string, method = 'GET', data?: unknown) {
    const csrf = await (await context.request.get(`${base}/auth/csrf`)).json()
    const response = await context.request.fetch(`${base}${path}`, { method, data, headers: { [csrf.headerName]: csrf.token } })
    expect(response.ok(), `${method} ${path}: ${response.status()}`).toBeTruthy()
    return response.status() === 204 ? undefined : response.json()
  }
  await call('/auth/admin', 'POST', { correo: 'admin@metodos.test', password: 'local-test-password-12345' })
  const project = await call('/projects', 'POST', { nombre: `Prueba metodos ${Date.now()}`, descripcion: 'Prueba aislada' })
  const diagram = randomUUID()
  const doc = { schemaVersion: 1, id: diagram, name: 'Vehículos de prueba', localRevision: 0, updatedAt: new Date().toISOString(),
    classes: [{ id: randomUUID(), name: 'Vehiculo', abstract: false, position: { x: 100, y: 100 }, attributes: [] }], relations: [] }
  await call(`/projects/${project.id}/diagrams`, 'POST', doc)
  await context.route('**/api/**', async route => {
    const url = new URL(route.request().url()); url.port = '18080'
    const response = await route.fetch({ url: url.href })
    if (response.status() >= 400) console.log('API error', response.status(), url.pathname, await response.text())
    await route.fulfill({ response })
  })
  await page.goto(`/workspace?project=${project.id}&diagram=${diagram}`)
  await page.locator('.class-node').filter({ hasText: 'Vehiculo' }).click()
  await page.getByRole('button', { name: 'Agregar método' }).click()
  await page.getByLabel('Nombre del método').fill('encender')
  await page.getByLabel('Tipo de retorno').selectOption('void')
  await page.getByRole('button', { name: 'Guardar método' }).click()
  await expect(page.locator('.class-node')).toContainText('encender(): void')
  await page.reload()
  await expect(page.locator('.class-node')).toContainText('encender(): void')
  await page.locator('.class-node').filter({ hasText: 'Vehiculo' }).click()
  await page.getByRole('button', { name: 'Editar método encender' }).click()
  await page.getByLabel('Nombre del método').fill('apagar')
  await page.getByRole('button', { name: 'Guardar método' }).click()
  await expect(page.locator('.class-node')).toContainText('apagar(): void')
  await page.reload()
  await expect(page.locator('.class-node')).toContainText('apagar(): void')
  const saved = await call(`/projects/${project.id}/diagrams/${diagram}`)
  expect(saved.document.classes[0].methods).toMatchObject([{ name: 'apagar', returnType: 'void' }])
  await page.locator('.class-node').filter({ hasText: 'Vehiculo' }).click()
  await page.getByRole('button', { name: 'Eliminar método apagar' }).click()
  await expect(page.locator('.class-node')).not.toContainText('apagar()')
  await page.reload()
  expect((await call(`/projects/${project.id}/diagrams/${diagram}`)).document.classes[0].methods).toEqual([])
  await page.getByRole('button', { name: 'Asistente IA · Qwen3', exact: true }).click()
  const instruction = 'Agrega el método encender con retorno void a Vehiculo'
  await page.getByLabel('Pregunta o consulta para la IA').fill(instruction)
  await page.getByRole('button', { name: 'Preguntar a la IA' }).click()
  await expect(page.getByText(instruction, { exact: true })).toBeVisible()
  await expect(page.locator('.class-node')).toContainText('encender(): void')
  await page.reload()
  await expect(page.locator('.class-node')).toContainText('encender(): void')
  const conversation = await call(`/projects/${project.id}/diagrams/${diagram}/conversation`)
  expect(conversation.items.some((item: { content: string }) => item.content === instruction)).toBe(true)
  expect(conversation.items.some((item: { kind: string; content: string }) => item.kind === 'ASISTENTE' && item.content.includes('encender() ha sido agregado'))).toBe(true)
})

test('dos sesiones comparten métodos y se rechaza un editor antiguo', async ({ browser }) => {
  test.skip(process.env.MODELA_METHODS_REAL !== '1', 'Requiere la API aislada de métodos en 18080')
  test.setTimeout(60_000)
  const base = 'http://127.0.0.1:18080/api'
  const first = await browser.newContext(), second = await browser.newContext()
  async function call(ctx: typeof first, path: string, method = 'GET', data?: unknown, expected = 200) {
    const csrf = await (await ctx.request.get(`${base}/auth/csrf`)).json()
    const response = await ctx.request.fetch(`${base}${path}`, { method, data, headers: { [csrf.headerName]: csrf.token } })
    expect(response.status(), `${method} ${path}`).toBe(expected)
    return response.json()
  }
  try {
    for (const ctx of [first, second]) {
      await call(ctx, '/auth/admin', 'POST', { correo: 'admin@metodos.test', password: 'local-test-password-12345' })
      await ctx.route('**/api/**', async route => {
        const url = new URL(route.request().url()); url.port = '18080'
        await route.fulfill({ response: await route.fetch({ url: url.href }) })
      })
    }
    const project = await call(first, '/projects', 'POST', { nombre: `Equipo métodos ${Date.now()}`, descripcion: 'Prueba aislada' }, 201)
    const diagram = randomUUID()
    const doc = { schemaVersion: 1, id: diagram, name: 'Equipo', localRevision: 0, updatedAt: new Date().toISOString(),
      classes: [{ id: randomUUID(), name: 'Vehiculo', abstract: false, position: { x: 100, y: 100 }, attributes: [] }], relations: [] }
    const endpoint = `/projects/${project.id}/diagrams/${diagram}`
    await call(first, `/projects/${project.id}/diagrams`, 'POST', doc, 201)
    const a = await first.newPage(), b = await second.newPage()
    const url = `http://127.0.0.1:4173/workspace?project=${project.id}&diagram=${diagram}`
    await Promise.all([a.goto(url), b.goto(url)])
    await a.getByRole('button', { name: 'Asistente IA · Qwen3', exact: true }).click()
    await a.getByLabel('Pregunta o consulta para la IA').fill('Agrega el método encender con retorno void a Vehiculo')
    await a.getByRole('button', { name: 'Preguntar a la IA' }).click()
    await expect(a.locator('.class-node')).toContainText('encender(): void')
    await expect(b.locator('.class-node')).toContainText('encender(): void', { timeout: 20000 })
    await b.getByRole('button', { name: 'Asistente IA · Qwen3', exact: true }).click()
    await expect(b.getByText('Agrega el método encender con retorno void a Vehiculo', { exact: true })).toBeVisible()
    await expect(b.getByText('El método Vehiculo.encender() ha sido agregado.', { exact: true })).toBeVisible()
    await b.getByRole('button', { name: 'Cerrar conversación' }).click()
    const saved = await call(second, endpoint)
    const legacy = structuredClone(saved.document)
    delete legacy.classes[0].methods
    const rejected = await call(second, endpoint, 'PUT', { revision: saved.revision, document: legacy }, 409)
    expect(rejected.message).toContain('métodos')
    expect((await call(first, endpoint)).document.classes[0].methods[0].name).toBe('encender')
    await b.locator('.class-node').filter({ hasText: 'Vehiculo' }).click()
    await b.getByRole('button', { name: 'Editar método encender' }).click()
    await b.getByLabel('Nombre del método').fill('apagar')
    await b.getByRole('button', { name: 'Guardar método' }).click()
    await expect(a.locator('.class-node')).toContainText('apagar(): void', { timeout: 20000 })
    await Promise.all([a.reload(), b.reload()])
    await expect(a.locator('.class-node')).toContainText('apagar(): void')
    await expect(b.locator('.class-node')).toContainText('apagar(): void')
  } finally {
    await first.close(); await second.close()
  }
})
