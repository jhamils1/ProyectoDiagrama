export const modelCatalog = {
  'qwen3-0.6b': {
    label: 'Qwen3-0.6B · 606 MB',
    id: 'onnx-community/Qwen3-0.6B-ONNX',
    revision: 'da1453100cf3ff33ef56d17983fc7a8648706db6',
    manifestUrl: '/ai/manifest.json',
    externalData: false,
    fileCount: 8,
  },
  'qwen3-1.7b': {
    label: 'Qwen3-1.7B · 1462 MB · experimental',
    id: 'onnx-community/Qwen3-1.7B-ONNX',
    revision: 'cc6a06a21d614e9b8e92a6adfab1074d4e7d2438',
    manifestUrl: '/ai/manifest-qwen3-1.7b.json',
    externalData: false,
    fileCount: 8,
  },
  'qwen3-1.7b-external': {
    label: 'Qwen3-1.7B · datos externos · experimental',
    id: 'onnx-community/Qwen3-1.7B-ONNX',
    revision: 'cc6a06a21d614e9b8e92a6adfab1074d4e7d2438',
    manifestUrl: '/ai/manifest-qwen3-1.7b-external.json',
    externalData: true,
    fileCount: 9,
  },
} as const
export type ModelKey = keyof typeof modelCatalog
export function isModelKey(value: unknown): value is ModelKey {
  return typeof value === 'string' && Object.hasOwn(modelCatalog, value)
}
