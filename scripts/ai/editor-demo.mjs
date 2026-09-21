import { chromium, expect } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('../../', import.meta.url))
const associations = process.argv.includes('--associations')
const attributePhrase = process.argv.includes('--attribute-phrase')
const classAttribute = process.argv.includes('--class-attribute')
const typedAttributes = process.argv.includes('--typed-attributes')
const inheritancePhrase = process.argv.includes('--inheritance-phrase')
const presentation = process.argv.includes('--presentation')
const untyped = process.argv.includes('--untyped') || attributePhrase || classAttribute
if (associations && untyped) throw new Error('Selecciona una sola suite')
const directory = path.join(
  root,
  presentation ? '.qa/presentation' : typedAttributes ? '.qa/etapa-06j' : untyped ? '.qa/etapa-06i' : associations ? '.qa/etapa-06h' : '.qa/etapa-06g',
)
await mkdir(directory, { recursive: true })
const artifact = `editor-real-${Date.now()}`
const report = {
  recordedAt: new Date().toISOString(),
  model: 'qwen3-1.7b-external',
  prompt: presentation ? 'editor-current-per-operation' : typedAttributes ? '6J-types-v1' : untyped ? '6I-untyped-v1' : associations ? '6H-association-v1' : '6F-v1',
  editorValidation: untyped
    ? '6I-untyped-v1'
    : associations
      ? '6H-association-v1'
      : '6G-limited-v1',
  mode: presentation ? 'structured-untyped/greedy-other' : untyped ? 'structured' : 'greedy',
  offline: false,
  recovered: false,
  cases: [],
  events: [],
}
const context = await chromium.launchPersistentContext(
  path.join(root, '.qa/etapa-06a/browser-profile'),
  { channel: 'msedge', headless: true, viewport: { width: 1440, height: 1000 } },
)
let page
try {
  for (const existing of context.pages()) await existing.close()
  page = await context.newPage()
  // Evidencia solo en QA: observar la respuesta real, sin reemplazar el Worker ni su salida.
  await page.addInitScript(() => {
    window.__qaGenerations = []
    const NativeWorker = window.Worker
    window.Worker = class extends NativeWorker {
      constructor(...args) {
        super(...args)
        this.addEventListener('message', (event) => {
          if (event.data.result?.raw) window.__qaGenerations.push(event.data.result)
        })
      }
    }
  })
  context.on('request', (request) => {
    if (/^https?:/.test(request.url()) && !request.url().startsWith('http://127.0.0.1:4173/'))
      report.events.push({ externalRequest: request.url() })
  })
  page.on('pageerror', (error) => report.events.push({ pageError: error.message }))
  await page.goto('http://127.0.0.1:4173/favicon.svg')
  await page.evaluate(async () => {
    for (const registration of await navigator.serviceWorker.getRegistrations())
      await registration.unregister()
    for (const key of await caches.keys()) if (key !== 'modela-ai-v1') await caches.delete(key)
  })
  await page.goto('about:blank')
  await page.goto('http://127.0.0.1:4173/favicon.svg')
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      updateViaCache: 'none',
    })
    const worker = registration.installing ?? registration.waiting ?? registration.active
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('SW timeout')), 60000)
      const changed = () => {
        if (worker.state === 'installed') worker.postMessage({ type: 'SKIP_WAITING' })
        if (worker.state === 'activated') {
          clearTimeout(timer)
          resolve()
        }
      }
      worker.addEventListener('statechange', changed)
      changed()
    })
  })
  await page.goto('http://127.0.0.1:4173/')
  await expect(page.locator('.start-screen .spin')).toHaveCount(0)
  const first = page.getByRole('button', { name: 'Crear mi primer diagrama' })
  if (await first.count()) await first.click()
  else await page.getByRole('button', { name: 'Crear otro diagrama' }).click()
  const name = `Presentacion IA ${Date.now()}`
  await page.getByRole('button', { name: 'Renombrar diagrama' }).click()
  await page.getByLabel('Nombre del diagrama', { exact: true }).fill(name)
  await page.getByRole('button', { name: 'Guardar nombre' }).click()
  for (const className of presentation
    ? []
    : inheritancePhrase
    ? ['automóvil', 'vehiculo']
    : attributePhrase || typedAttributes
    ? ['vehiculo']
    : associations
      ? ['Cliente', 'Pedido', 'Usuario', 'Proyecto', 'Departamento', 'Empleado']
      : ['Lancha', 'Capitan', 'Embarcacion']) {
    await page.getByRole('button', { name: 'Nueva clase', exact: true }).click()
    await page.getByLabel('Nombre de la clase', { exact: true }).fill(className)
    await page.getByLabel('Nombre de la clase', { exact: true }).press('Enter')
    await expect(page.locator('.class-node').filter({ hasText: className })).toHaveCount(1)
  }
  const read = () =>
    page.evaluate(
      (title) =>
        new Promise((resolve, reject) => {
          const request = indexedDB.open('uml-local-drafts-v1', 1)
          request.onerror = () => reject(request.error)
          request.onsuccess = () => {
            const db = request.result
            const transaction = db.transaction('diagrams')
            const get = transaction.objectStore('diagrams').getAll()
            get.onsuccess = () => {
              db.close()
              resolve(get.result.find((d) => d.name === title))
            }
            get.onerror = () => {
              db.close()
              reject(get.error)
            }
          }
        }),
      name,
    )
  report.initial = await read()
  await page.reload()
  await context.setOffline(true)
  await page.reload()
  report.offline = true
  await page.getByRole('button', { name: 'Asistente IA', exact: true }).click()
  await page.getByRole('button', { name: 'Cargar IA local' }).click()
  const status = page.getByRole('dialog').getByRole('status')
  await expect(status).toContainText('IA lista', { timeout: 120000 })
  const instructions = presentation
    ? [
        'Crea la clase vehiculo con atributo marca',
        'Agrega el atributo modelo en la clase vehiculo',
        'Agrega el atributo ruedas de tipo int en la clase vehiculo.',
        'Crea la clase automóvil.',
        'La clase automóvil hereda de vehiculo',
        'Crea la clase Cliente.',
        'Crea la clase Pedido.',
        'Crear una asociación entre Cliente y Pedido, donde un Cliente puede tener muchos Pedidos y cada Pedido pertenece a un solo Cliente.',
      ]
    : inheritancePhrase
    ? ['La clase automóvil hereda de vehiculo']
    : typedAttributes
    ? [
        'Agrega el atributo modelo de tipo String en la clase vehiculo.',
        'Agrega el atributo ruedas de tipo int en la clase vehiculo.',
        'Agrega el atributo activo de tipo boolean en la clase vehiculo.',
        'Agrega el atributo peso de tipo float en la clase vehiculo.',
        'Agrega el atributo distancia de tipo double en la clase vehiculo.',
      ]
    : classAttribute
    ? ['Crea la clase vehiculo con atributo marca']
    : attributePhrase
    ? ['agrega el atributo modelo en la clase vehiculo']
    : untyped
      ? ['Agrega modelo a Lancha.', 'Crea Vehiculo y agrega marca a Vehiculo.']
      : associations
        ? [
            'Crear una asociación entre Cliente y Pedido, donde un Cliente puede tener muchos Pedidos y cada Pedido pertenece a un solo Cliente.',
            'Un Usuario puede tener muchos Proyectos y cada Proyecto pertenece a un Usuario.',
            'Un Departamento tiene muchos Empleados y cada Empleado pertenece a un Departamento.',
          ]
        : [
            'Crea la clase Carga.',
            'Agrega capacidad de tipo Long a Lancha.',
            'Agrega licencia de tipo String obligatoria a Capitan.',
            'Crea Faro y agrega altura de tipo Decimal a Faro.',
            'Lancha hereda de Embarcacion.',
            'Renombra Lancha a Velero.',
          ]
  for (const instruction of instructions) {
    await page.evaluate(() => {
      window.__qaGenerations = []
    })
    const before = await read()
    await page.getByLabel('Instrucción UML').fill(instruction)
    const start = Date.now()
    await page.getByRole('button', { name: 'Generar propuesta' }).click()
    await expect(page.getByRole('button', { name: 'Generar propuesta' })).toBeEnabled({
      timeout: 250000,
    })
    const result = {
      instruction,
      elapsedMs: Date.now() - start,
      message: await status.innerText(),
      preview: null,
      unchangedBeforeConfirmation: JSON.stringify(await read()) === JSON.stringify(before),
      saved: false,
      generations: await page.evaluate(() => window.__qaGenerations),
    }
    const preview = page.getByRole('region', { name: 'Vista previa IA' })
    if (await preview.count()) {
      result.preview = await preview.innerText()
      if (!result.unchangedBeforeConfirmation) throw new Error('Se modificó antes de confirmar')
      await page.screenshot({ path: path.join(directory, `${artifact}-preview.png`) })
      await page.getByRole('button', { name: 'Confirmar y guardar' }).click()
      await expect(status).toContainText('Cambios guardados')
      const after = await read()
      result.saved = after.localRevision === before.localRevision + 1
    }
    report.cases.push(result)
    await writeFile(path.join(directory, `${artifact}.json`), JSON.stringify(report, null, 2))
    console.log(JSON.stringify(result))
  }
  report.final = await read()
  await page.getByRole('button', { name: 'Cerrar asistente' }).click()
  await page.reload()
  report.recovered = JSON.stringify(await read()) === JSON.stringify(report.final)
  if (presentation) {
    expect(report.cases.every((item) => item.saved && item.unchangedBeforeConfirmation)).toBe(true)
    expect(report.recovered).toBe(true)
    const classes = report.final.classes
    expect(classes.map((c) => c.name).sort()).toEqual(['Cliente', 'Pedido', 'automóvil', 'vehiculo'].sort())
    const vehicle = classes.find((c) => c.name === 'vehiculo')
    expect(vehicle.attributes.map((a) => [a.name, a.dataType]).sort()).toEqual([['marca', ''], ['modelo', ''], ['ruedas', 'Integer']])
    const id = (name) => classes.find((c) => c.name === name).id
    expect(report.final.relations).toHaveLength(2)
    expect(report.final.relations).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'generalization', sourceId: id('automóvil'), targetId: id('vehiculo') }),
      expect.objectContaining({ type: 'association', sourceId: id('Cliente'), targetId: id('Pedido'), sourceMultiplicity: '1', targetMultiplicity: '0..*' }),
    ]))
    report.verifiedFinalGraph = true
  }
  await page.screenshot({ path: path.join(directory, `${artifact}-final.png`), fullPage: true })
  console.log(
    `Guardados ${report.cases.filter((item) => item.saved).length}/${instructions.length}; recuperación offline: ${report.recovered}`,
  )
} catch (error) {
  report.error = String(error)
  throw error
} finally {
  await writeFile(path.join(directory, `${artifact}.json`), JSON.stringify(report, null, 2))
  await context.close()
}
