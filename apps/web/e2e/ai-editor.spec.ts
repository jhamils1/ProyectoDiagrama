import { expect, test, type Page } from '@playwright/test'

async function setup(page: Page) {
  await page.addInitScript(() => {
    window.Worker = class {
      onmessage: ((event: { data: unknown }) => void) | null = null
      postMessage({ id, type, decoding }: { id: number; type: string; decoding: string }) {
        if (type === 'generate') document.body.dataset.editorAiDecoding = decoding
        if (type === 'generate')
          document.body.dataset.aiCalls = String(Number(document.body.dataset.aiCalls ?? 0) + 1)
        setTimeout(
          () =>
            this.onmessage?.({
              data: {
                id,
                result:
                  type === 'load'
                    ? {}
                    : {
                        raw: document.body.dataset.aiRaw,
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
  await page.evaluate(async () => {
    const cache = await caches.open('modela-ai-v1')
    const files = Array.from({ length: 9 }, (_, i) => ({
      url: `/ai/editor-test-${i}`,
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
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('IA lista')
}
async function proposal(page: Page, instruction: string, operations: unknown[]) {
  await page.evaluate((ops) => {
    document.body.dataset.aiRaw = JSON.stringify({ status: 'propose', operations: ops })
  }, operations)
  await page.getByLabel('Instrucción UML').fill(instruction)
  await page.getByRole('button', { name: 'Generar propuesta' }).click()
}

test('atributo sin tipo: IA, guardar, definir tipo y quitarlo sin perder el atributo', async ({
  page,
}) => {
  await setup(page)
  await proposal(page, 'Crea Vehiculo y agrega modelo a Vehiculo.', [
    { type: 'addClass', name: 'Vehiculo' },
    { type: 'addAttribute', className: 'Vehiculo', name: 'modelo', dataType: '' },
  ])
  await expect(page.getByRole('region', { name: 'Vista previa IA' })).toContainText(
    'modelo: sin tipo',
  )
  await expect(page.locator('body')).toHaveAttribute('data-editor-ai-decoding', 'structured')
  await page.getByRole('button', { name: 'Confirmar y guardar' }).click()
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('Cambios guardados')
  await page.getByRole('button', { name: 'Cerrar asistente' }).click()
  await page.reload()
  await expect(page.locator('.class-node')).toContainText('sin tipo')
  await page.locator('.class-tree button').filter({ hasText: 'Vehiculo' }).click()
  await page.getByRole('button', { name: 'Editar atributo modelo' }).click()
  await expect(page.getByLabel('Tipo de dato')).toHaveValue('')
  await page.getByLabel('Tipo de dato').selectOption('String')
  await page.getByLabel('Nombre del atributo', { exact: true }).press('Enter')
  await expect(page.locator('.class-node')).toContainText('String')
  await page.getByRole('button', { name: 'Editar atributo modelo' }).click()
  await page.getByLabel('Tipo de dato').selectOption('')
  await page.getByLabel('Nombre del atributo', { exact: true }).press('Enter')
  await page.reload()
  await expect(page.locator('.class-node')).toContainText('sin tipo')
})

test('IA editor: vista previa, descarte, guardado atómico y recuperación offline (motor simulado)', async ({
  page,
  context,
}) => {
  await setup(page)
  const ops = [
    { type: 'addClass', name: 'Faro' },
    { type: 'addAttribute', className: 'Faro', name: 'altura', dataType: 'Decimal' },
  ]
  await proposal(page, 'Crea Faro y agrega altura de tipo Decimal a Faro.', ops)
  await expect(page.getByRole('region', { name: 'Vista previa IA' })).toContainText(
    'Faro.altura: Decimal',
  )
  await expect(page.locator('.class-node')).toHaveCount(0)
  await page.getByRole('button', { name: 'Descartar propuesta' }).click()
  await expect(page.locator('.class-node')).toHaveCount(0)
  await page.getByRole('button', { name: 'Generar propuesta' }).click()
  await page.getByRole('button', { name: 'Confirmar y guardar' }).click()
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('Cambios guardados')
  await page.getByRole('button', { name: 'Cerrar asistente' }).click()
  await expect(page.locator('.class-node')).toContainText('altura')
  await expect(page.locator('.statusbar')).toContainText('r1')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload()
  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('.class-node')).toContainText('Faro')
  await expect(page.locator('.class-node')).toContainText('altura')
})

test('IA editor: bloquea métodos antes de inferir y propuestas que cambian la intención', async ({
  page,
}) => {
  await setup(page)
  await proposal(page, 'Agrega el método navegar con retorno Boolean a Lancha.', [
    { type: 'addClass', name: 'Lancha' },
  ])
  await expect(page.getByRole('dialog').getByRole('status')).toContainText(
    'Instrucción no disponible',
  )
  expect(await page.locator('body').getAttribute('data-ai-calls')).toBeNull()
  await proposal(page, 'Crea la clase Carga.', [
    { type: 'addClass', name: 'Carga' },
    { type: 'deleteClass', name: 'Carga' },
  ])
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('no coincide')
  await expect(page.getByRole('button', { name: 'Confirmar y guardar' })).toHaveCount(0)
  await expect(page.locator('.class-node')).toHaveCount(0)
})

test('IA editor: otra pestaña no pierde cambios al confirmar una propuesta antigua', async ({
  page,
  context,
}) => {
  await setup(page)
  await proposal(page, 'Crea la clase Carga.', [{ type: 'addClass', name: 'Carga' }])
  await expect(page.getByRole('button', { name: 'Confirmar y guardar' })).toBeEnabled()
  const other = await context.newPage()
  await other.goto('/')
  await other.getByRole('button', { name: 'Nueva clase', exact: true }).click()
  await expect(other.locator('.class-node')).toHaveCount(1)
  await page.getByRole('button', { name: 'Confirmar y guardar' }).click()
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('No se confirmó')
  await page.getByRole('button', { name: 'Cerrar asistente' }).click()
  await page.reload()
  await expect(page.locator('.class-node')).toHaveCount(1)
  await expect(page.locator('.class-node')).not.toContainText('Carga')
})

test('IA editor: conserva los campos manuales abiertos antes de usar el asistente', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Crear mi primer diagrama' }).click()
  await page.getByRole('button', { name: 'Nueva clase', exact: true }).click()
  await page.getByLabel('Nombre de la clase', { exact: true }).fill('Pendiente')
  await expect(page.getByRole('button', { name: 'Asistente IA', exact: true })).toBeDisabled()
  await page.getByLabel('Nombre de la clase', { exact: true }).press('Enter')
  await expect(page.getByRole('button', { name: 'Asistente IA', exact: true })).toBeEnabled()
})
