import { expect, test } from '@playwright/test'

test('asociación IA: aclarar, clases existentes, confirmar y recuperar (motor simulado)', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.Worker = class {
      onmessage: ((event: { data: unknown }) => void) | null = null
      postMessage({ id, type }: { id: number; type: string }) {
        if (type === 'generate')
          document.body.dataset.calls = String(Number(document.body.dataset.calls ?? 0) + 1)
        setTimeout(
          () =>
            this.onmessage?.({
              data: {
                id,
                result:
                  type === 'load'
                    ? {}
                    : {
                        raw: JSON.stringify({
                          status: 'propose',
                          operations: [
                            {
                              type: 'addRelation',
                              source: 'Cliente',
                              target: 'Pedido',
                              kind: 'association',
                              sourceMultiplicity: '1',
                              targetMultiplicity: document.body.dataset.multiplicity ?? '0..*',
                            },
                          ],
                        }),
                        elapsedMs: 1,
                        inputTokens: 1,
                        outputTokens: 1,
                        tokenLimitReached: false,
                      },
              },
            }),
          0,
        )
      }
      terminate() {}
    } as unknown as typeof Worker
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Crear mi primer diagrama' }).click()
  for (const name of ['Cliente', 'Pedido']) {
    await page.getByRole('button', { name: 'Nueva clase', exact: true }).click()
    await page.getByLabel('Nombre de la clase', { exact: true }).fill(name)
    await page.getByLabel('Nombre de la clase', { exact: true }).press('Enter')
  }
  await page.evaluate(async () => {
    const cache = await caches.open('modela-ai-v1')
    const files = Array.from({ length: 9 }, (_, i) => ({
      url: `/ai/association-test-${i}`,
      sha256: '0'.repeat(64),
      bytes: 1,
    }))
    for (const file of files)
      await cache.put(file.url, new Response('x', { headers: { 'x-modela-sha256': file.sha256 } }))
    await cache.put(
      '/ai/manifest-qwen3-1.7b-external.json',
      new Response(
        JSON.stringify({
          id: 'onnx-community/Qwen3-1.7B-ONNX',
          revision: 'cc6a06a21d614e9b8e92a6adfab1074d4e7d2438',
          transformers: '4.3.0',
          format: 'external-v1',
          files,
        }),
      ),
    )
  })
  await page.getByRole('button', { name: 'Asistente IA', exact: true }).click()
  await page.getByRole('button', { name: 'Cargar IA local' }).click()
  const status = page.getByRole('dialog').getByRole('status')
  await expect(status).toContainText('IA lista')
  const send = async (instruction: string) => {
    await page.getByLabel('Instrucción UML').fill(instruction)
    await page.getByRole('button', { name: 'Generar propuesta' }).click()
  }
  await send('Asocia Cliente con Pedido.')
  await expect(status).toContainText('Aclara las multiplicidades')
  await send('Un Cliente tiene muchos Ausentes y cada Ausente pertenece a un Cliente.')
  await expect(status).toContainText('La clase Ausente no existe')
  expect(await page.locator('body').getAttribute('data-calls')).toBeNull()
  const instruction =
    'Crear una asociación entre Cliente y Pedido, donde un Cliente puede tener muchos Pedidos y cada Pedido pertenece a un solo Cliente.'
  await page.evaluate(() => {
    document.body.dataset.multiplicity = '1'
  })
  await send(instruction)
  await expect(status).toContainText('no coincide')
  await expect(page.getByRole('button', { name: 'Confirmar y guardar' })).toHaveCount(0)
  await page.evaluate(() => {
    document.body.dataset.multiplicity = '0..*'
  })
  await send(instruction)
  await expect(page.getByRole('region', { name: 'Vista previa IA' })).toContainText(
    'Cliente 1 — 0..* Pedido',
  )
  await expect(page.locator('.react-flow__edge')).toHaveCount(0)
  await page.getByRole('button', { name: 'Descartar propuesta' }).click()
  await expect(page.locator('.react-flow__edge')).toHaveCount(0)
  await send(instruction)
  await page.getByRole('button', { name: 'Confirmar y guardar' }).click()
  await expect(status).toContainText('Cambios guardados')
  await page.getByRole('button', { name: 'Cerrar asistente' }).click()
  await page.reload()
  await expect(page.locator('.react-flow__edge')).toHaveCount(1)
  await expect(page.locator('.class-node')).toHaveCount(2)
})
