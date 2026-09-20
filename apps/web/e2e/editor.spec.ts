import { test, expect, type Page } from '@playwright/test'
import type { Diagram } from '../src/features/modeling/domain/model'

async function newDraft(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Crear mi primer diagrama' }).click()
  await expect(page.getByRole('heading', { name: 'Diagrama 1', exact: true })).toBeVisible()
}
async function addClass(page: Page, name: string) {
  await page.getByRole('button', { name: 'Nueva clase', exact: true }).click()
  await page.getByLabel('Nombre de la clase', { exact: true }).fill(name)
  await page.getByRole('button', { name: 'Guardar propiedades' }).click()
  await expect(page.locator('.class-node').filter({ hasText: name })).toHaveCount(1)
}
async function readDrafts(page: Page): Promise<Diagram[]> {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open('uml-local-drafts-v1', 1)
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const db = request.result
          const read = db.transaction('diagrams').objectStore('diagrams').getAll()
          read.onsuccess = () => {
            db.close()
            resolve(read.result)
          }
          read.onerror = () => {
            db.close()
            reject(read.error)
          }
        }
      }),
  )
}

test('P-CU07/08: crear, editar, mover y recargar un borrador sin conexión', async ({
  page,
  context,
}, info) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await newDraft(page)
  await page.getByRole('button', { name: 'Renombrar diagrama' }).click()
  await page.getByLabel('Nombre del diagrama', { exact: true }).fill('Gestión de pedidos')
  await page.getByRole('button', { name: 'Guardar nombre' }).click()
  await addClass(page, 'Cliente')
  await page.getByRole('button', { name: 'Agregar atributo', exact: true }).click()
  await page.getByLabel('Nombre del atributo', { exact: true }).fill('nombre')
  await page.getByRole('button', { name: 'Guardar atributo', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Editar atributo nombre' })).toBeVisible()
  await addClass(page, 'Pedido')
  await page.getByRole('button', { name: 'Agregar atributo', exact: true }).click()
  await page.getByLabel('Nombre del atributo', { exact: true }).fill('total')
  await page.getByLabel('Tipo de dato').selectOption('Decimal')
  await page.getByRole('button', { name: 'Guardar atributo', exact: true }).click()
  await page.getByRole('button', { name: 'Relación', exact: true }).click()
  await page.getByLabel('Nombre de la relación').fill('realiza')
  await page.getByRole('button', { name: 'Guardar relación' }).click()
  await expect(page.locator('.react-flow__edge')).toHaveCount(1)
  await page.locator('.react-flow__controls-fitview').click()
  const node = page.locator('.class-node').filter({ hasText: 'Pedido' }).locator('.class-heading')
  const box = await node.boundingBox()
  expect(box).not.toBeNull()
  const before = await readDrafts(page)
  await page.mouse.move(box!.x + 30, box!.y + 20)
  await page.mouse.down()
  await page.mouse.move(box!.x + 60, box!.y + 100, { steps: 8 })
  await page.mouse.up()
  await expect
    .poll(async () => (await readDrafts(page))[0].classes[1].position.y)
    .not.toBe(before[0].classes[1].position.y)
  const saved = await readDrafts(page)
  await page.screenshot({ path: info.outputPath('editor-desktop.png'), fullPage: true })
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload()
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null)
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Gestión de pedidos', exact: true })).toBeVisible()
  expect(await readDrafts(page)).toEqual(saved)
  await addClass(page, 'Producto')
  await page.reload()
  await expect(page.locator('.class-node').filter({ hasText: 'Producto' })).toHaveCount(1)
  expect(errors).toEqual([])
})

test('P-CU08: una edición inválida no cambia el diagrama guardado', async ({ page }) => {
  await newDraft(page)
  await addClass(page, 'Cliente')
  await addClass(page, 'Pedido')
  const before = await readDrafts(page)
  await page.getByLabel('Nombre de la clase', { exact: true }).fill('cliente')
  await page.getByRole('button', { name: 'Guardar propiedades' }).click()
  await expect(page.getByRole('alert')).toContainText('Ya existe una clase')
  expect(await readDrafts(page)).toEqual(before)
})

test('P-CU08: confirma el borrado de una clase relacionada y conserva la restante', async ({
  page,
}) => {
  await newDraft(page)
  await addClass(page, 'Cliente')
  await addClass(page, 'Pedido')
  await page.getByRole('button', { name: 'Relación', exact: true }).click()
  await page.getByRole('button', { name: 'Guardar relación' }).click()
  await expect(page.locator('.react-flow__edge')).toHaveCount(1)
  await page.getByRole('button', { name: 'Eliminar clase', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('1 relación(es)')
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
  expect((await readDrafts(page))[0].relations).toHaveLength(1)
  await page.getByRole('button', { name: 'Eliminar clase', exact: true }).click()
  await page.getByRole('button', { name: 'Eliminar clase y dependencias' }).click()
  await expect(page.locator('.react-flow__edge')).toHaveCount(0)
  await page.reload()
  await expect(page.locator('.class-node')).toHaveCount(1)
  expect((await readDrafts(page))[0].classes[0].name).toBe('Cliente')
})

test('P-CU08: dos pestañas no sobrescriben cambios silenciosamente', async ({ page, context }) => {
  await newDraft(page)
  await addClass(page, 'Cliente')
  const second = await context.newPage()
  await second.goto('/')
  await expect(second.locator('.class-node')).toHaveCount(1)
  await addClass(page, 'Pedido')
  await second.getByRole('button', { name: 'Nueva clase', exact: true }).click()
  await expect(second.getByRole('alert')).toContainText('otra pestaña')
  expect((await readDrafts(second))[0].classes.map((c) => c.name)).toEqual(['Cliente', 'Pedido'])
  await second.reload()
  await expect(second.locator('.class-node')).toHaveCount(2)
})

test('el editor se adapta a una ventana estrecha sin desbordar horizontalmente', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await newDraft(page)
  await addClass(page, 'Producto')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  await expect(page.getByLabel('Nombre de la clase', { exact: true })).toBeVisible()
  await page.screenshot({ path: info.outputPath('editor-narrow.png'), fullPage: true })
})

test('P-CU08: mover una clase con el teclado persiste la posición', async ({ page }) => {
  await newDraft(page)
  await addClass(page, 'Producto')
  const before = (await readDrafts(page))[0].classes[0].position
  await page.locator('.react-flow__node').focus()
  await page.keyboard.press('ArrowRight')
  await expect
    .poll(async () => (await readDrafts(page))[0].classes[0].position.x)
    .toBe(before.x + 10)
  await page.reload()
  await expect(page.locator('.class-node')).toHaveCount(1)
  expect((await readDrafts(page))[0].classes[0].position.x).toBe(before.x + 10)
})
