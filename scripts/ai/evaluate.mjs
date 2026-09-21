import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('../../', import.meta.url))
const directory = path.join(root, '.qa/etapa-06f')
await mkdir(directory, { recursive: true })
const smoke = process.argv.includes('--smoke')
const holdout = process.argv.includes('--holdout')
const newCases = process.argv.includes('--newcases')
const reserved6d = process.argv.includes('--reserved6d')
const reserved6f = process.argv.includes('--reserved6f')
if ([smoke, holdout, newCases, reserved6d, reserved6f].filter(Boolean).length > 1)
  throw new Error('Selecciona una sola suite por ejecución.')
if (process.argv.includes('--legacy') && process.argv.includes('--structured'))
  throw new Error('Selecciona un solo modo de generación.')
const decoding = process.argv.includes('--structured') ? 'structured' : 'legacy'
const manualInstruction = process.argv.find((arg) => arg.startsWith('--instruction='))?.slice(14)
if (manualInstruction && !smoke) throw new Error('--instruction requiere --smoke.')
const countExpected = holdout || newCases || reserved6d || reserved6f ? 20 : 30
const modelKey = process.argv.find((arg) => arg.startsWith('--model='))?.slice(8) ?? 'qwen3-0.6b'
if (!['qwen3-0.6b', 'qwen3-1.7b', 'qwen3-1.7b-external'].includes(modelKey))
  throw new Error('Modelo no permitido.')
const artifact = `${modelKey}-${decoding}-${smoke ? 'smoke' : reserved6f ? 'reserved6f' : reserved6d ? 'reserved6d' : newCases ? 'newcases' : holdout ? 'holdout' : 'baseline'}-${Date.now()}`
const context = await chromium.launchPersistentContext(
  path.join(root, '.qa/etapa-06a/browser-profile'),
  {
    channel: 'msedge',
    headless: true,
    viewport: { width: 1280, height: 900 },
    acceptDownloads: true,
  },
)
const events = []
let evaluationPage
const verification = {
  modelKey,
  decoding,
  instruction: manualInstruction ?? null,
  suite: smoke
    ? 'smoke'
    : reserved6f
      ? '6F'
      : reserved6d
        ? '6D'
        : newCases
          ? '6C'
          : holdout
            ? '6B'
            : '6A',
  initialLoad: '',
  offlineLoad: '',
  cancelledInFlight: false,
  reopenedOffline: false,
}
context.on('request', (request) => {
  const url = request.url()
  if (/^https?:/.test(url) && !url.startsWith('http://127.0.0.1:4173/'))
    events.push({ externalRequest: url })
})
// Perfil exclusivo de QA: actualizar el shell de pruebas conservando pesos verificados.
try {
  for (const existing of context.pages()) await existing.close()
  const bootstrap = await context.newPage()
  await bootstrap.goto('http://127.0.0.1:4173/favicon.svg')
  await bootstrap.evaluate(async () => {
    for (const registration of await navigator.serviceWorker.getRegistrations())
      await registration.unregister()
    for (const key of await caches.keys()) if (key !== 'modela-ai-v1') await caches.delete(key)
  })
  // Soltar el cliente controlado por la inscripción anterior antes de registrar.
  await bootstrap.goto('about:blank')
  await bootstrap.goto('http://127.0.0.1:4173/favicon.svg')
  await bootstrap.evaluate(async () => {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      updateViaCache: 'none',
    })
    const worker = registration.installing ?? registration.waiting ?? registration.active
    if (!worker) throw new Error('No se registró el service worker de QA.')
    await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('La aplicación offline no se activó en QA.')),
        60000,
      )
      const changed = () => {
        if (worker.state === 'installed') worker.postMessage({ type: 'SKIP_WAITING' })
        if (worker.state === 'activated') {
          clearTimeout(timer)
          resolve()
        }
        if (worker.state === 'redundant') {
          clearTimeout(timer)
          reject(new Error('Instalación offline rechazada en QA.'))
        }
      }
      worker.addEventListener('statechange', changed)
      changed()
    })
  })
  await bootstrap.close()
  const page = await context.newPage()
  evaluationPage = page
  // Capturar el mismo Blob exportado antes de que el navegador gestione su descarga.
  // Evita perder una evaluación completa si falla saveAs en un perfil persistente.
  await context.addInitScript(() => {
    // Solo QA: exportar el Blob sin iniciar el gestor nativo de descargas de Edge.
    // En este perfil persistente dicho gestor puede cerrar el proceso headless.
    document.addEventListener(
      'click',
      (event) => {
        if (event.target instanceof HTMLAnchorElement && event.target.download)
          event.preventDefault()
      },
      true,
    )
    const original = URL.createObjectURL.bind(URL)
    URL.createObjectURL = (object) => {
      if (object instanceof Blob && object.type === 'application/json')
        window.__qaReport = object.text()
      return original(object)
    }
  })
  page.on('pageerror', (error) => {
    events.push({ pageError: error.message })
    console.log('PAGE ERROR:', error.message)
  })
  page.on('console', (message) => {
    if (message.type() === 'error') {
      events.push({ consoleError: message.text().slice(0, 1500) })
      console.log('CONSOLE ERROR:', message.text().slice(0, 1500))
    }
  })
  const status = page.getByRole('status')
  let lastStatus = ''
  async function until(check, timeout = 120_000) {
    const start = Date.now()
    while (Date.now() - start < timeout) {
      if (await check()) return
      const current = await status.textContent()
      if (current?.startsWith('Abre la versión compilada')) throw new Error(current)
      if (current?.includes("Can't create a session") || current?.includes('bad_alloc'))
        throw new Error(current)
      if (await page.getByRole('button', { name: 'Cancelar y liberar modelo' }).isDisabled())
        throw new Error(
          current || 'El laboratorio detuvo el motor antes de completar la evaluación.',
        )
      if (current !== lastStatus) {
        console.log(current)
        lastStatus = current
      }
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
    throw new Error(`Tiempo agotado. Estado: ${await status.textContent()}`)
  }
  await page.goto('http://127.0.0.1:4173/ai-lab')
  await page.getByLabel('Modelo local', { exact: true }).selectOption(modelKey)
  await page.getByLabel('Generación', { exact: true }).selectOption(decoding)
  await page.getByRole('button', { name: 'Preparar recursos sin conexión' }).click()
  await until(async () => (await status.textContent()).startsWith('Recursos verificados'), 180_000)
  console.log('Recursos preparados y verificados.')
  // Cargar online primero para medir la carga inicial, luego recrear página sin red.
  await page.getByRole('button', { name: 'Cargar modelo local' }).click()
  await until(async () => (await status.textContent()).startsWith('Modelo listo.'))
  console.log(await status.textContent())
  verification.initialLoad = await status.textContent()
  await page.getByRole('button', { name: 'Interpretar texto', exact: true }).click()
  await page.waitForTimeout(250)
  await page.getByRole('button', { name: 'Cancelar y liberar modelo' }).click()
  await page.waitForTimeout(1000)
  if (
    (await page.locator('.ai-results li').count()) !== 0 ||
    !(await page.getByRole('button', { name: 'Interpretar texto', exact: true }).isDisabled())
  )
    throw new Error('La cancelación no descartó el resultado.')
  verification.cancelledInFlight = true
  await context.setOffline(true)
  await page.reload()
  await page.getByLabel('Modelo local', { exact: true }).selectOption(modelKey)
  await page.getByLabel('Generación', { exact: true }).selectOption(decoding)
  await page.getByRole('button', { name: 'Cargar modelo local' }).click()
  await until(async () => (await status.textContent()).startsWith('Modelo listo.'))
  console.log('Recarga offline:', await status.textContent())
  verification.offlineLoad = await status.textContent()
  if (smoke) {
    if (manualInstruction) await page.getByLabel('Instrucción en español').fill(manualInstruction)
    await page.getByRole('button', { name: 'Interpretar texto', exact: true }).click()
    await until(async () => (await page.locator('.ai-results li').count()) === 1)
    console.log(await page.locator('.ai-results').textContent())
  } else {
    await page
      .getByRole('button', {
        name: reserved6f
          ? 'Evaluar 20 casos 6F'
          : reserved6d
            ? 'Evaluar 20 casos 6D'
            : newCases
              ? 'Evaluar 20 casos 6C'
              : holdout
                ? 'Evaluar 20 casos nuevos'
                : 'Evaluar 30 casos',
        exact: true,
      })
      .click()
    let previous = 0
    await until(async () => {
      const count = await page.locator('.ai-results li').count()
      if (count !== previous) {
        console.log(await page.locator('.ai-results li').last().innerText())
        previous = count
      }
      return count === countExpected
    }, 30 * 120_000)
  }
  await page.getByRole('button', { name: 'Descargar informe' }).click()
  const report = await page.evaluate(() => window.__qaReport)
  if (!report || JSON.parse(report).results.length !== (smoke ? 1 : countExpected))
    throw new Error('Informe exportado incompleto.')
  const parsedReport = JSON.parse(report)
  if (
    parsedReport.modelKey !== modelKey ||
    parsedReport.promptVersion !== '6F-v1' ||
    parsedReport.validationVersion !== '6F-reasons-v1' ||
    parsedReport.decodingVersion !==
      (decoding === 'structured' ? '6D-json-schema-v1' : '6C-greedy-v1')
  )
    throw new Error(
      'El informe no corresponde al modelo/prompt/validación esperados; revisa la compilación offline.',
    )
  await writeFile(path.join(directory, `${artifact}.json`), report)
  await page.screenshot({
    path: path.join(directory, `${artifact}.png`),
    fullPage: false,
  })
  console.log('Informe guardado en .qa/etapa-06f; inferencia después de recarga offline.')
  await page.close()
  const reopened = await context.newPage()
  await reopened.goto('http://127.0.0.1:4173/ai-lab')
  await reopened.getByLabel('Modelo local', { exact: true }).selectOption(modelKey)
  await reopened.getByLabel('Generación', { exact: true }).selectOption(decoding)
  await reopened.getByRole('button', { name: 'Cargar modelo local' }).click()
  await reopened
    .getByRole('status')
    .filter({ hasText: 'Modelo listo.' })
    .waitFor({ timeout: 120_000 })
  await reopened.getByRole('button', { name: 'Interpretar texto', exact: true }).click()
  await reopened.locator('.ai-results li').waitFor({ timeout: 120_000 })
  verification.reopenedOffline = true
  console.log('Cierre y reapertura de página sin red: inferencia completada.')
} catch (error) {
  verification.error = error instanceof Error ? error.message : String(error)
  // Conservar los casos ya completados sin presentarlos como una suite completa.
  if (evaluationPage && !evaluationPage.isClosed()) {
    try {
      const download = evaluationPage.getByRole('button', { name: 'Descargar informe' })
      if (await download.isEnabled()) {
        await download.click()
        const partial = JSON.parse(await evaluationPage.evaluate(() => window.__qaReport))
        await writeFile(
          path.join(directory, `${artifact}-partial.json`),
          JSON.stringify(
            {
              ...partial,
              complete: false,
              evaluationFailure: verification.error,
            },
            null,
            2,
          ),
        )
      }
      await evaluationPage.screenshot({ path: path.join(directory, `${artifact}-error.png`) })
    } catch (captureError) {
      verification.captureError = String(captureError)
    }
  }
  throw error
} finally {
  await writeFile(path.join(directory, `${artifact}-events.json`), JSON.stringify(events, null, 2))
  await writeFile(
    path.join(directory, `${artifact}-verification.json`),
    JSON.stringify(verification, null, 2),
  )
  await context.close()
}
