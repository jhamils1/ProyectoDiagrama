import { AutoTokenizer, AutoModelForCausalLM, env, Tensor } from '@huggingface/transformers'
import { StructuredOutputProcessor } from '@huggingface/transformers-structured-output'
import { generationSchema } from '../domain/decoding'
import { isModelKey, modelCatalog } from './modelCatalog'
import { cachedResource } from './resourceCache'

env.allowRemoteModels = false
env.allowLocalModels = true
env.localModelPath = `${self.location.origin}/ai/models/`
env.useBrowserCache = false
// El registro de archivos de Transformers 4 consulta primero su caché para recursos
// locales HTTP. Exponer únicamente la caché ya verificada evita consultas al Hub.
env.useCustomCache = true
env.customCache = {
  match: async (request: string) => {
    const url = new URL(request, self.location.origin)
    if (url.origin !== self.location.origin || !url.pathname.startsWith('/ai/')) return undefined
    return cachedResource(await caches.open('modela-ai-v1'), url.href)
  },
  put: async () => {
    /* Solo prepareResources escribe recursos verificados. */
  },
}
env.backends.onnx.wasm!.wasmPaths = {
  mjs: `${self.location.origin}/ai/runtime/ort-wasm-simd-threaded.asyncify.mjs`,
  wasm: `${self.location.origin}/ai/runtime/ort-wasm-simd-threaded.asyncify.wasm`,
}
env.backends.onnx.wasm!.numThreads = 1

let tokenizer: Awaited<ReturnType<typeof AutoTokenizer.from_pretrained>> | undefined
let model: Awaited<ReturnType<typeof AutoModelForCausalLM.from_pretrained>> | undefined
let busy = false
class ContextTooLongError extends Error {}
self.onmessage = async (event: MessageEvent) => {
  const { id, type, messages, modelKey = 'qwen3-0.6b', decoding = 'legacy' } = event.data
  if (busy) {
    self.postMessage({ id, error: 'El motor está ocupado.' })
    return
  }
  busy = true
  const start = performance.now()
  try {
    if (type === 'load') {
      self.postMessage({ id, progress: 'Buscando aceleración WebGPU…' })
      if (!isModelKey(modelKey)) throw new Error('Modelo no permitido.')
      const gpu = (
        navigator as unknown as {
          gpu?: { requestAdapter(): Promise<{ features: Set<string>; info: unknown } | null> }
        }
      ).gpu
      const adapter = await gpu?.requestAdapter()
      if (!adapter)
        throw new Error('No se encontró un adaptador WebGPU. Esta evaluación requiere WebGPU real.')
      if (!adapter.features.has('shader-f16'))
        throw new Error('El adaptador no admite shader-f16 requerido por q4f16.')
      self.postMessage({ id, progress: 'Cargando el vocabulario de Qwen…' })
      tokenizer = await AutoTokenizer.from_pretrained(modelKey)
      self.postMessage({ id, progress: 'Cargando Qwen en la GPU. Puede tardar uno o dos minutos…' })
      model = await AutoModelForCausalLM.from_pretrained(modelKey, {
        dtype: 'q4f16',
        device: 'webgpu',
        use_external_data_format: modelCatalog[modelKey].externalData,
      })
      const info = adapter.info as {
        vendor?: string
        architecture?: string
        description?: string
        device?: string
      }
      self.postMessage({
        id,
        result: {
          loadMs: performance.now() - start,
          adapter: {
            vendor: info?.vendor,
            architecture: info?.architecture,
            description: info?.description,
            device: info?.device,
          },
          userAgent: navigator.userAgent,
          device: 'webgpu',
          dtype: 'q4f16',
        },
      })
    } else if (type === 'generate' || type === 'chat') {
      if (!tokenizer || !model) throw new Error('Carga primero el modelo.')
      if (decoding !== 'legacy' && decoding !== 'structured')
        throw new Error('Modo de generación no permitido.')
      // La implementación admite kwargs Jinja; sus tipos no enumeran opciones de cada modelo.
      const templateOptions = {
        add_generation_prompt: true,
        return_dict: true as const,
        enable_thinking: false,
      }
      const inputs = tokenizer.apply_chat_template(messages, templateOptions)
      if (inputs.input_ids.dims[1] > 2048)
        throw new ContextTooLongError('La consulta y su contexto superan los 2048 tokens de esta IA local. Usa una pregunta más breve o un diagrama más pequeño.')
      const output = await model.generate({
        ...inputs,
        max_new_tokens: 256,
        do_sample: false,
        // Estado nuevo por intento. Sin fallback silencioso si la gramática falla.
        logits_processor:
          decoding === 'structured'
            ? new StructuredOutputProcessor(tokenizer, {
                type: 'json_schema',
                json_schema: generationSchema,
              })
            : undefined,
        ...(decoding === 'structured' ? { eos_token_id: tokenizer.eos_token_id } : {}),
        return_dict_in_generate: false,
      })
      if (!(output instanceof Tensor)) throw new Error('Formato de salida del motor inesperado.')
      const tokens = (output.tolist()[0] as bigint[]).slice(inputs.input_ids.dims[1])
      const raw = tokenizer.decode(tokens, { skip_special_tokens: true }).trim()
      self.postMessage({
        id,
        result: {
          raw,
          elapsedMs: performance.now() - start,
          inputTokens: inputs.input_ids.dims[1],
          outputTokens: tokens.length,
          tokenLimitReached: tokens.length >= 256,
        },
      })
    } else throw new Error('Solicitud desconocida.')
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : String(error),
      errorCode: error instanceof ContextTooLongError ? 'CONTEXT_TOO_LONG' : undefined })
  } finally {
    busy = false
  }
}
