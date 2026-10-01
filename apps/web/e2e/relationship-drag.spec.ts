import { test, expect, type Page } from '@playwright/test'

async function prepare(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Crear mi primer diagrama' }).click()
  for (const name of ['Cliente', 'Pedido']) {
    await page.getByRole('button', { name: 'Nueva clase', exact: true }).click()
    await page.getByLabel('Nombre de la clase', { exact: true }).fill(name)
    await page.getByLabel('Nombre de la clase', { exact: true }).press('Enter')
    await expect(page.locator('.class-heading').filter({ hasText: name })).toBeVisible()
  }
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('uml-local-drafts-v1', 1)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result
      const tx = db.transaction('diagrams', 'readwrite')
      const store = tx.objectStore('diagrams')
      const read = store.getAll()
      read.onsuccess = () => {
        const diagram = read.result[0]
        diagram.classes[0].position = { x: 0, y: 0 }
        diagram.classes[1].position = { x: 420, y: 0 }
        store.put(diagram)
      }
      tx.oncomplete = () => { db.close(); resolve() }
      tx.onerror = () => reject(tx.error)
    }
  }))
  await page.reload()
  await expect(page.locator('.class-node')).toHaveCount(2)
  await page.getByRole('button', { name: 'Ajustar a la vista' }).click()
}

test('dragging the arrow after selection draws a preview and opens the relation dialog', async ({ page }, info) => {
  await prepare(page)
  const source = page.locator('.class-node').filter({ hasText: 'Cliente' })
  const target = page.locator('.class-node').filter({ hasText: 'Pedido' })
  await source.locator('.class-heading').click()
  const arrow = source.locator('.relationship-drag-handle')
  const a = (await arrow.boundingBox())!
  const b = (await target.boundingBox())!
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
  await page.mouse.down()
  await page.mouse.move((a.x + b.x) / 2, a.y + a.height / 2, { steps: 10 })
  await expect(page.locator('.react-flow__connection-path')).toBeVisible()
  await page.screenshot({ path: info.outputPath('connection-preview.png') })
  await page.mouse.move(b.x, b.y + b.height / 2, { steps: 10 })
  await page.mouse.up()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByLabel('Clase de origen')).toHaveValue(await source.locator('.target').first().getAttribute('data-nodeid') as string)
  await page.getByRole('button', { name: 'Guardar relación', exact: true }).click()
  await expect(page.locator('.react-flow__edge')).toHaveCount(1)
  await page.locator('.react-flow__pane').click({ position: { x: 20, y: 20 } })
  await expect(page.locator('.react-flow__edge')).toHaveCount(1)
  await page.reload()
  await expect(page.locator('.react-flow__edge')).toHaveCount(1)
})

test('drop on the class body creates inheritance in the chosen direction', async ({ page }) => {
  await prepare(page)
  const source = page.locator('.class-node').filter({ hasText: 'Pedido' })
  const target = page.locator('.class-node').filter({ hasText: 'Cliente' })
  await source.locator('.class-heading').click()
  // This also exercises a different zoom and the opposite drag direction.
  await page.getByRole('button', { name: 'Alejar', exact: true }).click()
  await target.locator('.class-heading').hover()
  const a = (await source.locator('.relationship-drag-handle').boundingBox())!
  const b = (await target.boundingBox())!
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
  await page.mouse.down()
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 20 })
  await expect(page.locator('.react-flow__connection-path')).toBeVisible()
  await page.mouse.up()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByLabel('Tipo de relación').selectOption('generalization')
  await expect(page.getByLabel('Subclase').locator('option:checked')).toHaveText('Pedido')
  await expect(page.getByLabel('Superclase').locator('option:checked')).toHaveText('Cliente')
  await page.getByRole('button', { name: 'Guardar relación', exact: true }).click()
  await expect(page.locator('.react-flow__edge-generalization')).toHaveCount(1)
  await page.reload()
  await expect(page.locator('.react-flow__edge-generalization')).toHaveCount(1)
})

test('empty drop cancels, then many-to-many drop creates Detalle once', async ({ page }) => {
  await prepare(page)
  const source = page.locator('.class-node').filter({ hasText: 'Cliente' })
  const target = page.locator('.class-node').filter({ hasText: 'Pedido' })
  await source.locator('.class-heading').click()
  const a = (await source.locator('.relationship-drag-handle').boundingBox())!
  const b = (await target.boundingBox())!
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
  await page.mouse.down()
  await page.mouse.move((a.x + b.x) / 2, a.y + a.height / 2, { steps: 10 })
  await expect(page.locator('.react-flow__connection-path')).toBeVisible()
  await page.mouse.up()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('.react-flow__connection-path')).toHaveCount(0)
  await expect(page.locator('.react-flow__edge')).toHaveCount(0)
  await source.locator('.class-heading').click()
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
  await page.mouse.down()
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 20 })
  await page.mouse.up()
  await page.getByLabel('Tipo de multiplicidad').selectOption('many-to-many')
  await page.getByRole('button', { name: 'Guardar relación', exact: true }).click()
  await expect(page.locator('.class-heading').filter({ hasText: 'Detalle' })).toHaveCount(1)
  await expect(page.locator('.react-flow__edge-association')).toHaveCount(1)
  await expect(page.locator('.react-flow__edge-associationClass')).toHaveCount(1)
  await page.reload()
  await expect(page.locator('.react-flow__edge-associationClass')).toHaveCount(1)
})
