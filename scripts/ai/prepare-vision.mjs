import { createReadStream } from 'node:fs'
import { mkdir, readFile, writeFile, copyFile, stat, rename } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../', import.meta.url))
const lock = JSON.parse(await readFile(new URL('./vision-lock.json', import.meta.url), 'utf8'))
const target = path.join(root, 'apps/web/public/ai')
const fromCache = process.argv.find((a) => a.startsWith('--from-cache='))?.slice(13)
async function digest(file) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(file)) hash.update(chunk)
  return hash.digest('hex')
}
const files = []
for (const item of lock.files) {
  const relative = `models/florence2-base/${item.name}`,
    destination = path.join(target, relative)
  await mkdir(path.dirname(destination), { recursive: true })
  const valid = await stat(destination)
    .then(async (s) => s.size === item.bytes && (await digest(destination)) === item.sha256)
    .catch(() => false)
  if (!valid) {
    if (fromCache) await copyFile(path.resolve(root, fromCache, item.name), `${destination}.part`)
    else {
      console.log(`Descargando ${item.name} (${(item.bytes / 1e6).toFixed(1)} MB)`)
      const response = await fetch(
        `https://huggingface.co/${lock.id}/resolve/${lock.revision}/${item.name}`,
        { signal: AbortSignal.timeout(600_000) },
      )
      if (!response.ok || !response.body)
        throw new Error(`No se pudo descargar ${item.name}: ${response.status}`)
      await pipeline(
        Readable.fromWeb(response.body),
        (await import('node:fs')).createWriteStream(`${destination}.part`),
      )
    }
    if (
      (await stat(`${destination}.part`)).size !== item.bytes ||
      (await digest(`${destination}.part`)) !== item.sha256
    )
      throw new Error(`Integridad incorrecta: ${item.name}`)
    await rename(`${destination}.part`, destination)
  }
  files.push({ url: `/ai/${relative}`, bytes: item.bytes, sha256: item.sha256 })
}
await mkdir(path.join(target, 'runtime'), { recursive: true })
for (const name of [
  'ort-wasm-simd-threaded.asyncify.mjs',
  'ort-wasm-simd-threaded.asyncify.wasm',
]) {
  const source = path.join(root, 'node_modules/onnxruntime-web/dist', name)
  await copyFile(source, path.join(target, 'runtime', name))
  files.push({
    url: `/ai/runtime/${name}`,
    bytes: (await stat(source)).size,
    sha256: await digest(source),
  })
}
await writeFile(
  path.join(target, 'manifest-vision.json'),
  JSON.stringify({ id: lock.id, revision: lock.revision, files }, null, 2) + '\n',
)
console.log(
  `Modelo visual local preparado: ${(files.reduce((n, f) => n + f.bytes, 0) / 1e6).toFixed(1)} MB.`,
)
