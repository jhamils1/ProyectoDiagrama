import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, readFile, writeFile, rename, copyFile, stat } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('../../', import.meta.url))
const modelKey = process.argv.find((arg) => arg.startsWith('--model='))?.slice(8) ?? 'qwen3-0.6b'
if (!['qwen3-0.6b', 'qwen3-1.7b'].includes(modelKey))
  throw new Error(
    'Modelo de descarga no permitido. Para datos externos prepara 1.7b y ejecuta scripts/ai/externalize.py.',
  )
const lock = JSON.parse(
  await readFile(
    new URL(
      modelKey === 'qwen3-1.7b' ? './model-1.7b-lock.json' : './model-lock.json',
      import.meta.url,
    ),
    'utf8',
  ),
)
const target = path.join(root, 'apps/web/public/ai')
const digest = async (file) => {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(file)) hash.update(chunk)
  return hash.digest('hex')
}
const manifest = { ...lock, transformers: '4.3.0', runtime: '', files: [] }
for (const item of lock.files) {
  const relative = `models/${modelKey}/${item.name}`
  const destination = path.join(target, relative)
  await mkdir(path.dirname(destination), { recursive: true })
  const valid = await stat(destination)
    .then(async (s) => s.size === item.bytes && (await digest(destination)) === item.sha256)
    .catch(() => false)
  if (!valid) {
    console.log(`Descargando ${item.name} (${(item.bytes / 1e6).toFixed(1)} MB)`)
    const response = await fetch(
      `https://huggingface.co/${lock.id}/resolve/${lock.revision}/${item.name}`,
      { signal: AbortSignal.timeout(20 * 60_000) },
    )
    if (!response.ok || !response.body) throw new Error(`Descarga rechazada: ${response.status}`)
    const partial = `${destination}.part`
    await pipeline(Readable.fromWeb(response.body), createWriteStream(partial))
    if ((await stat(partial)).size !== item.bytes || (await digest(partial)) !== item.sha256)
      throw new Error(`Integridad incorrecta: ${item.name}`)
    await rename(partial, destination)
  }
  manifest.files.push({ url: `/ai/${relative}`, bytes: item.bytes, sha256: item.sha256 })
}
const runtimeRoot = path.join(root, 'node_modules/onnxruntime-web')
manifest.runtime = JSON.parse(
  await readFile(path.join(runtimeRoot, 'package.json'), 'utf8'),
).version
await mkdir(path.join(target, 'runtime'), { recursive: true })
for (const name of [
  'ort-wasm-simd-threaded.asyncify.mjs',
  'ort-wasm-simd-threaded.asyncify.wasm',
]) {
  const source = path.join(runtimeRoot, 'dist', name)
  await copyFile(source, path.join(target, 'runtime', name))
  manifest.files.push({
    url: `/ai/runtime/${name}`,
    bytes: (await stat(source)).size,
    sha256: await digest(source),
  })
}
await writeFile(
  path.join(target, modelKey === 'qwen3-1.7b' ? 'manifest-qwen3-1.7b.json' : 'manifest.json'),
  JSON.stringify(manifest, null, 2) + '\n',
)
console.log(
  `Recursos verificados: ${(manifest.files.reduce((n, f) => n + f.bytes, 0) / 1e6).toFixed(1)} MB. Ejecuta build para incluirlos en preview.`,
)
