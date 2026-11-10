import {
  AutoProcessor,
  Florence2Processor,
  Florence2ForConditionalGeneration,
  RawImage,
  Tensor,
  env,
} from '@huggingface/transformers'
import { reconstructImageModel, type TextRegion } from '../domain/imageGeometry'
import { cachedResource } from './resourceCache'

env.allowRemoteModels = false
env.allowLocalModels = true
env.localModelPath = `${self.location.origin}/ai/models/`
env.useBrowserCache = false
env.useCustomCache = true
env.customCache = {
  match: async (request: string) => {
    const url = new URL(request, self.location.origin)
    if (url.origin !== self.location.origin || !url.pathname.startsWith('/ai/')) return undefined
    return cachedResource(await caches.open('modela-ai-v1'), url.href)
  },
  put: async () => {},
}
env.backends.onnx.wasm!.wasmPaths = {
  mjs: `${self.location.origin}/ai/runtime/ort-wasm-simd-threaded.asyncify.mjs`,
  wasm: `${self.location.origin}/ai/runtime/ort-wasm-simd-threaded.asyncify.wasm`,
}
env.backends.onnx.wasm!.numThreads = 1

self.onmessage = async (event: MessageEvent<{ file: File }>) => {
  const started = performance.now()
  let model:
    Awaited<ReturnType<typeof Florence2ForConditionalGeneration.from_pretrained>> | undefined
  try {
    self.postMessage({ progress: 'Cargando Florence-2 en este equipo…' })
    const processor = await AutoProcessor.from_pretrained('florence2-base')
    if (!(processor instanceof Florence2Processor))
      throw new Error('El procesador no corresponde a Florence-2.')
    model = await Florence2ForConditionalGeneration.from_pretrained('florence2-base', {
      device: 'wasm',
      dtype: 'q8',
    })
    let image = await RawImage.fromBlob(event.data.file)
    if (Math.max(image.width, image.height) > 1800)
      image = await image.resize(
        Math.round((image.width * 1800) / Math.max(image.width, image.height)),
        Math.round((image.height * 1800) / Math.max(image.width, image.height)),
      )
    const read = async (input: RawImage): Promise<TextRegion[]> => {
      const inputs = await processor(input, '<OCR_WITH_REGION>')
      const ids = await model!.generate({
        ...inputs,
        max_new_tokens: 512,
        num_beams: 1,
        do_sample: false,
      })
      if (!(ids instanceof Tensor)) throw new Error('Florence-2 devolvió un formato inesperado.')
      const raw = processor.batch_decode(ids, { skip_special_tokens: false })[0]
      const output = processor.post_process_generation(raw, '<OCR_WITH_REGION>', input.size)[
        '<OCR_WITH_REGION>'
      ]
      if (typeof output === 'string' || !Array.isArray(output.quad_boxes))
        throw new Error('No se pudo leer el texto de la imagen.')
      return output.labels.map((text: string, i: number) => ({ text, box: output.quad_boxes[i] }))
    }
    self.postMessage({ progress: 'Leyendo nombres y atributos en la imagen…' })
    const regions = await read(image),
      raster = image.rgba()
    let result = reconstructImageModel(raster, regions)
    for (const relation of result.model.relations
      .filter((r) => !r.sourceMultiplicity || !r.targetMultiplicity)
      .slice(0, 3)) {
      const a = result.boxes[result.model.classes.findIndex((c) => c.name === relation.source)]
      const b = result.boxes[result.model.classes.findIndex((c) => c.name === relation.target)]
      const horizontal = a.right < b.left
      const rect = horizontal
        ? [a.right, Math.max(a.top, b.top), b.left, Math.min(a.bottom, b.bottom)]
        : [Math.max(a.left, b.left), a.bottom, Math.min(a.right, b.right), b.top]
      if (rect[2] - rect[0] < 30 || rect[3] - rect[1] < 30) continue
      self.postMessage({ progress: 'Comprobando las multiplicidades de las conexiones…' })
      const crop = await image.crop(rect.map(Math.round) as [number, number, number, number])
      const extra = await read(crop)
      regions.push(
        ...extra.map((r) => ({ text: r.text, box: r.box.map((v, i) => v + rect[i % 2]) })),
      )
    }
    result = reconstructImageModel(raster, regions)
    self.postMessage({ result: { ...result, elapsedMs: performance.now() - started } })
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : 'No se pudo analizar la imagen.',
    })
  } finally {
    await model?.dispose()
  }
}
