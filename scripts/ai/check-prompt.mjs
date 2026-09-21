// Comprobación local de presupuesto con el tokenizador ya preparado; no descarga pesos.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import path from 'node:path'
import ts from 'typescript'
import { AutoTokenizer, env } from '@huggingface/transformers'

env.allowRemoteModels = false
const root = path.resolve(import.meta.dirname, '../..')
const outputDir = path.join(root, '.qa/etapa-06f')
await mkdir(outputDir, { recursive: true })
const source = await readFile(
  path.join(root, 'apps/web/src/features/ai/domain/proposal.ts'),
  'utf8',
)
const js = ts.transpileModule(source.slice(source.indexOf('export const PROMPT_VERSION')), {
  compilerOptions: { module: ts.ModuleKind.ESNext },
}).outputText
const modulePath = path.join(outputDir, 'prompt-check.mjs')
await writeFile(modulePath, js)
const { messagesFor } = await import(pathToFileURL(modulePath).href)
const tokenizer = await AutoTokenizer.from_pretrained(
  path.join(root, 'apps/web/public/ai/models/qwen3-1.7b-external'),
  { local_files_only: true },
)
const messages = messagesFor('Empleado hereda de Persona.', {
  classes: ['Cliente', 'Pedido', 'Producto', 'Persona', 'Empleado'].map((name) => ({
    name,
    attributes: [],
  })),
})
const count = () =>
  tokenizer.apply_chat_template(messages, {
    add_generation_prompt: true,
    return_dict: true,
    enable_thinking: false,
  }).input_ids.dims[1]
const initial = count()
messages.push(
  {
    role: 'assistant',
    content:
      '{"status":"propose","operations":[{"type":"addClass","name":"Empleado","abstract":false}]}',
  },
  {
    role: 'user',
    content:
      'La respuesta falló la validación: Ya existe una clase con ese nombre. Devuelve un único JSON corregido para la solicitud original y su contexto. No inventes ni cambies identificadores. /no_think',
  },
)
const retry = count()
console.log(JSON.stringify({ initial, representativeRetry: retry, limit: 2048 }))
if (initial > 1800 || retry > 2048) process.exitCode = 1
