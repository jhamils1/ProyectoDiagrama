import { expect, test } from '@playwright/test'
import path from 'node:path'

// Prueba con Florence-2 real. Preparar ai:prepare-vision y build antes de ejecutarla.
test('Florence-2 reconoce la pizarra y vuelve a analizarla sin internet', async ({
  page,
  context,
}) => {
  test.skip(process.env.VISION_REAL !== '1', 'Requiere el modelo visual local preparado (305 MB).')
  test.setTimeout(300_000)
  const external: string[] = []
  page.on('request', (request) => {
    if (/^https?:/.test(request.url()) && !request.url().startsWith('http://127.0.0.1:4173'))
      external.push(request.url())
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Crear mi primer diagrama' }).click()
  await page.getByRole('button', { name: 'Desde imagen' }).click()
  const file = path.resolve(process.cwd(), '../../diagrama-pizarra-prueba.png')
  await page.locator('#uml-image').setInputFiles(file)
  const start = Date.now()
  await page.getByRole('button', { name: 'Analizar imagen' }).click()
  await expect(page.getByText('Revisa los elementos antes de agregarlos.')).toBeVisible({
    timeout: 140_000,
  })
  console.log(
    `Florence-2 real: primera preparación y análisis ${((Date.now() - start) / 1000).toFixed(1)} s`,
  )
  await expect(page.getByLabel('Multiplicidad origen', { exact: true }).nth(0)).toHaveValue('1')
  await expect(page.getByLabel('Multiplicidad destino', { exact: true }).nth(0)).toHaveValue('0..*')
  await page.getByRole('button', { name: 'Agregar al diagrama' }).click()
  await expect(page.locator('.class-node')).toHaveCount(3)
  await expect(page.locator('.react-flow__edge')).toHaveCount(2)
  await expect(page.locator('.class-node').filter({ hasText: 'Cliente' })).toContainText('nombre')
  await expect(page.locator('.class-node').filter({ hasText: 'Pedido' })).toContainText('fecha')
  await expect(page.locator('.class-node').filter({ hasText: 'Producto' })).toContainText('precio')
  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('.class-node')).toHaveCount(3)
  await page.getByRole('button', { name: 'Desde imagen' }).click()
  await page.locator('#uml-image').setInputFiles(file)
  const offlineStart = Date.now()
  await page.getByRole('button', { name: 'Analizar imagen' }).click()
  await expect(page.getByText('Revisa los elementos antes de agregarlos.')).toBeVisible({
    timeout: 140_000,
  })
  console.log(`Florence-2 real sin internet: ${((Date.now() - offlineStart) / 1000).toFixed(1)} s`)
  expect(external).toEqual([])
})
