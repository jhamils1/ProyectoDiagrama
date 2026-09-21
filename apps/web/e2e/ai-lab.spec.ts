import { expect, test } from '@playwright/test'

for (const decoding of ['legacy', 'structured']) {
  test(`IA: ${decoding} rechaza datos sin respaldo tras la corrección (motor simulado)`, async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.Worker = class {
        onmessage: ((event: { data: unknown }) => void) | null = null
        postMessage({ id, type, decoding }: { id: number; type: string; decoding: string }) {
          if (type === 'generate') {
            document.body.dataset.aiDecoding = decoding
            document.body.dataset.aiCalls = String(Number(document.body.dataset.aiCalls ?? 0) + 1)
          }
          if (type === 'generate' && document.body.dataset.failAi === 'true') {
            setTimeout(
              () => this.onmessage?.({ data: { id, error: 'Fallo de gramática simulado' } }),
              0,
            )
            return
          }
          setTimeout(
            () =>
              this.onmessage?.({
                data: {
                  id,
                  result:
                    type === 'load'
                      ? {
                          loadMs: 1,
                          adapter: {},
                          userAgent: 'simulado',
                          device: 'simulado',
                          dtype: 'simulado',
                        }
                      : {
                          raw:
                            document.body.dataset.aiRaw ??
                            '{"status":"propose","operations":[{"type":"addClass","name":"Inventada"}]}',
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
    await page.goto('/ai-lab')
    await page.getByLabel('Generación', { exact: true }).selectOption(decoding)
    await page.evaluate(async () => {
      const cache = await caches.open('modela-ai-v1')
      const files = Array.from({ length: 8 }, (_, i) => ({
        url: `/ai/test-${i}`,
        bytes: 1,
        sha256: '0'.repeat(64),
      }))
      for (const file of files)
        await cache.put(
          file.url,
          new Response('x', { headers: { 'x-modela-sha256': file.sha256 } }),
        )
      await cache.put(
        '/ai/manifest.json',
        new Response(
          JSON.stringify({
            id: 'onnx-community/Qwen3-0.6B-ONNX',
            revision: 'da1453100cf3ff33ef56d17983fc7a8648706db6',
            transformers: '4.3.0',
            files,
          }),
        ),
      )
    })
    await page.getByRole('button', { name: 'Cargar modelo local' }).click()
    await page.getByRole('button', { name: 'Interpretar texto', exact: true }).click()
    await expect(page.locator('.ai-results li')).toContainText('Rechazada por validación:')
    await expect(page.locator('.ai-results li')).toContainText(
      'no aparece exactamente en la solicitud',
    )
    await expect(page.locator('.ai-results li')).not.toContainText('Propuesta válida')
    await expect(page.locator('body')).toHaveAttribute('data-ai-decoding', decoding)
    await page.evaluate(() => {
      document.body.dataset.aiRaw =
        '{"status":"propose","operations":[{"type":"addAttribute","className":"Pedido","name":"inicio","dataType":"DateTime","required":true}]}'
    })
    await page.getByLabel('Instrucción en español').fill('Pedido necesita inicio de tipo DateTime.')
    await page.getByRole('button', { name: 'Interpretar texto', exact: true }).click()
    await expect(page.locator('.ai-results li')).toContainText('No se solicitó obligatoriedad')
    await expect(page.locator('.ai-results li')).not.toContainText('Propuesta válida')
    await page.evaluate(() => {
      document.body.dataset.aiRaw =
        '{"status":"reject","reason":"unknown_class","subject":"Pedido"}'
    })
    await page.getByLabel('Instrucción en español').fill('Elimina Pedido.')
    await page.getByRole('button', { name: 'Interpretar texto', exact: true }).click()
    await expect(page.locator('.ai-results li')).toContainText('La clase citada sí existe')
    await page.evaluate(() => {
      document.body.dataset.aiRaw =
        '{"status":"reject","reason":"unsupported_operation","feature":"methods"}'
    })
    await page.getByLabel('Instrucción en español').fill('Agrega el método calcular a Pedido.')
    await page.getByRole('button', { name: 'Interpretar texto', exact: true }).click()
    await expect(page.locator('.ai-results li')).toContainText(
      'La edición de métodos todavía no está implementada',
    )
    const callsBeforeScope = await page.locator('body').getAttribute('data-ai-calls')
    await page.getByLabel('Instrucción en español').fill('Crea un sistema de biblioteca.')
    await page.getByRole('button', { name: 'Interpretar texto', exact: true }).click()
    await expect(page.locator('.ai-results li')).toContainText('sin inferencia del modelo')
    await expect(page.locator('.ai-results li')).toContainText('No genero sistemas completos')
    await expect(page.locator('body')).toHaveAttribute('data-ai-calls', callsBeforeScope!)
    await page
      .getByLabel('Generación', { exact: true })
      .selectOption(decoding === 'legacy' ? 'structured' : 'legacy')
    await expect(page.locator('.ai-results li')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Descargar informe' })).toBeDisabled()
    await page.evaluate(() => {
      document.body.dataset.failAi = 'true'
    })
    await page.getByLabel('Instrucción en español').fill('Crea Factura.')
    await page.getByRole('button', { name: 'Interpretar texto', exact: true }).click()
    await expect(page.getByRole('status')).toHaveText('Fallo de gramática simulado')
    await expect(
      page.getByRole('button', { name: 'Interpretar texto', exact: true }),
    ).toBeDisabled()
    await expect(page.locator('.ai-results li')).toHaveCount(0)
  })
}

test('IA: datos externos no acepta el manifiesto monolítico aunque coincidan modelo y revisión', async ({
  page,
}) => {
  await page.route('**/ai/manifest-qwen3-1.7b-external.json', (route) =>
    route.fulfill({
      json: {
        id: 'onnx-community/Qwen3-1.7B-ONNX',
        revision: 'cc6a06a21d614e9b8e92a6adfab1074d4e7d2438',
        transformers: '4.3.0',
        files: Array(9).fill({}),
      },
    }),
  )
  await page.goto('/ai-lab')
  await page.getByLabel('Modelo local', { exact: true }).selectOption('qwen3-1.7b-external')
  await page.getByRole('button', { name: 'Preparar recursos sin conexión' }).click()
  await expect(page.getByRole('status')).toHaveText(
    'El manifiesto no corresponde a esta evaluación.',
    { timeout: 15000 },
  )
})

test('IA: no carga datos externos cuando falta el archivo de pesos en caché', async ({ page }) => {
  await page.goto('/ai-lab')
  await page.evaluate(async () => {
    const cache = await caches.open('modela-ai-v1')
    const files = Array.from({ length: 9 }, (_, i) => ({
      url: `/ai/models/qwen3-1.7b-external/test-${i}`,
      bytes: 1,
      sha256: '0'.repeat(64),
    }))
    files[8].url = '/ai/models/qwen3-1.7b-external/onnx/model_q4f16.onnx_data'
    for (const file of files.slice(0, 8))
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
  await page.getByLabel('Modelo local', { exact: true }).selectOption('qwen3-1.7b-external')
  await page.getByRole('button', { name: 'Cargar modelo local' }).click()
  await expect(page.getByRole('status')).toHaveText(
    'La caché está incompleta. Prepara los recursos nuevamente.',
  )
  await expect(page.getByRole('button', { name: 'Interpretar texto', exact: true })).toBeDisabled()
})

test('IA: el modelo mayor exige su propio manifiesto y no usa el del pequeño', async ({ page }) => {
  await page.route('**/ai/manifest-qwen3-1.7b.json', (route) =>
    route.fulfill({
      json: {
        id: 'onnx-community/Qwen3-0.6B-ONNX',
        revision: 'da1453100cf3ff33ef56d17983fc7a8648706db6',
        transformers: '4.3.0',
        files: Array(8).fill({}),
      },
    }),
  )
  await page.goto('/ai-lab')
  await page.getByLabel('Modelo local', { exact: true }).selectOption('qwen3-1.7b')
  await page.getByRole('button', { name: 'Preparar recursos sin conexión' }).click()
  await expect(page.getByRole('status')).toHaveText(
    'El manifiesto no corresponde a esta evaluación.',
    { timeout: 15000 },
  )
  await page.getByRole('button', { name: 'Cargar modelo local' }).click()
  await expect(page.getByRole('status')).toHaveText('Prepara primero los recursos locales.')
})

test('IA: laboratorio aislado informa recursos ausentes y mantiene el editor disponible', async ({
  page,
}) => {
  await page.goto('/ai-lab')
  await expect(page.getByRole('heading', { name: 'Laboratorio de IA local' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Interpretar texto', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Cargar modelo local' }).click()
  await expect(page.getByRole('status')).toHaveText('Prepara primero los recursos locales.')
  await expect(page.getByRole('button', { name: 'Cargar modelo local' })).toBeEnabled()
  await page.getByRole('link', { name: 'Volver al editor' }).click()
  await expect(page.getByRole('button', { name: 'Crear mi primer diagrama' })).toBeVisible()
})

test('IA: preparación incompleta no habilita inferencia ni marca éxito', async ({ page }) => {
  await page.route('**/ai/manifest.json', (route) =>
    route.fulfill({ status: 404, body: 'missing' }),
  )
  await page.goto('/ai-lab')
  await page.getByRole('button', { name: 'Preparar recursos sin conexión' }).click()
  await expect(page.getByRole('status')).toContainText('Primero ejecuta npm.cmd run ai:prepare', {
    timeout: 15000,
  })
  await expect(page.getByRole('button', { name: 'Interpretar texto', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Preparar recursos sin conexión' })).toBeEnabled()
})

test('IA: rechaza recursos cuyo hash no coincide', async ({ page }) => {
  await page.route('**/ai/manifest.json', (route) =>
    route.fulfill({
      json: {
        id: 'onnx-community/Qwen3-0.6B-ONNX',
        revision: 'da1453100cf3ff33ef56d17983fc7a8648706db6',
        transformers: '4.3.0',
        files: Array.from({ length: 8 }, (_, i) => ({
          url: `/ai/invalid-${i}.bin`,
          bytes: 1,
          sha256: '0'.repeat(64),
        })),
      },
    }),
  )
  await page.route('**/ai/invalid-*.bin', (route) => route.fulfill({ body: 'x' }))
  await page.goto('/ai-lab')
  await page.getByRole('button', { name: 'Preparar recursos sin conexión' }).click()
  await expect(page.getByRole('status')).toContainText('Integridad incorrecta', { timeout: 15000 })
  await page.getByRole('button', { name: 'Cargar modelo local' }).click()
  await expect(page.getByRole('status')).toHaveText('Prepara primero los recursos locales.')
})

test('IA: cancelar preparación descarta una respuesta tardía', async ({ page }) => {
  let release!: () => void
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/ai/manifest.json', async (route) => {
    await held
    await route.fulfill({ status: 404, body: 'missing' }).catch(() => {})
  })
  await page.goto('/ai-lab')
  const request = page.waitForRequest('**/ai/manifest.json')
  await page.getByRole('button', { name: 'Preparar recursos sin conexión' }).click()
  await request
  await page.getByRole('button', { name: 'Cancelar y liberar modelo' }).click()
  release()
  await expect(page.getByRole('status')).toContainText('Cancelado.')
  await expect(page.getByRole('button', { name: 'Interpretar texto', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Preparar recursos sin conexión' })).toBeEnabled()
})
