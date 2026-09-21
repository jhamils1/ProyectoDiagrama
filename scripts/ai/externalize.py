"""Reempaqueta pesos locales verificados; no descarga ni recuantiza el modelo."""
import hashlib
import json
from pathlib import Path
import shutil
import onnx

ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT / 'apps/web/public/ai'
SOURCE = PUBLIC / 'models/qwen3-1.7b'
TARGET = PUBLIC / 'models/qwen3-1.7b-external'
LOCK = json.loads((ROOT / 'scripts/ai/model-1.7b-lock.json').read_text('utf-8'))


def digest(path):
    with path.open('rb') as file:
        return hashlib.file_digest(file, 'sha256').hexdigest()


def fingerprint(model):
    # Comprueba todos los campos del modelo, excepto la ubicación física de pesos.
    copy = onnx.ModelProto()
    copy.CopyFrom(model)
    tensors = []
    for tensor in copy.graph.initializer:
        tensors.append((tensor.name, hashlib.sha256(tensor.raw_data).hexdigest()))
        tensor.ClearField('raw_data')
        tensor.ClearField('external_data')
        tensor.ClearField('data_location')
    return hashlib.sha256(copy.SerializeToString(deterministic=True)).hexdigest(), tensors


def main():
    if onnx.__version__ != '1.19.0':
        raise RuntimeError('Utiliza ONNX 1.19.0 en el entorno aislado.')
    for item in LOCK['files']:
        path = SOURCE / item['name']
        if path.stat().st_size != item['bytes'] or digest(path) != item['sha256']:
            raise RuntimeError(f'Original no verificado: {item["name"]}')
    TARGET.mkdir(parents=True, exist_ok=True)
    (TARGET / 'onnx').mkdir(exist_ok=True)
    source_model = SOURCE / 'onnx/model_q4f16.onnx'
    target_model = TARGET / 'onnx/model_q4f16.onnx'
    target_data = TARGET / 'onnx/model_q4f16.onnx_data'
    print('Leyendo el original verificado...', flush=True)
    model = onnx.load(source_model)
    before = fingerprint(model)
    # Ruta fija del artefacto derivado; evita que ONNX agregue bytes a una copia previa.
    target_data.write_bytes(b'')
    onnx.save_model(model, target_model, save_as_external_data=True,
                    all_tensors_to_one_file=True, location=target_data.name,
                    size_threshold=1024, convert_attribute=False)
    del model
    print('Verificando estructura y cada inicializador...', flush=True)
    converted = onnx.load(target_model)
    if fingerprint(converted) != before:
        raise RuntimeError('El modelo derivado no conserva estructura y pesos.')
    del converted
    for item in LOCK['files']:
        if not item['name'].startswith('onnx/'):
            shutil.copyfile(SOURCE / item['name'], TARGET / item['name'])
    original_manifest = json.loads((PUBLIC / 'manifest-qwen3-1.7b.json').read_text('utf-8'))
    files = []
    for name in [item['name'] for item in LOCK['files']] + ['onnx/model_q4f16.onnx_data']:
        path = TARGET / name
        files.append({'url': f'/ai/models/qwen3-1.7b-external/{name}',
                      'bytes': path.stat().st_size, 'sha256': digest(path)})
    for item in original_manifest['files']:
        if item['url'].startswith('/ai/runtime/'):
            path = PUBLIC / item['url'].removeprefix('/ai/')
            if digest(path) != item['sha256']:
                raise RuntimeError('Runtime no verificado.')
            files.append(item)
    manifest = {**original_manifest, 'format': 'external-v1', 'files': files,
                'conversion': {'onnx': onnx.__version__, 'sourceSha256': digest(source_model),
                               'structureSha256': before[0], 'initializersVerified': len(before[1])}}
    expected_path = ROOT / 'scripts/ai/model-external-lock.json'
    if manifest != json.loads(expected_path.read_text('utf-8')):
        raise RuntimeError('La conversión no coincide con el manifiesto fijado. No publicar.')
    text = json.dumps(manifest, indent=2) + '\n'
    (PUBLIC / 'manifest-qwen3-1.7b-external.json').write_text(text, encoding='utf-8')
    evidence = ROOT / '.qa/etapa-06c'
    evidence.mkdir(parents=True, exist_ok=True)
    (evidence / 'external-manifest.json').write_text(text, encoding='utf-8')
    print(f'Conversión verificada: {len(before[1])} inicializadores; grafo {target_model.stat().st_size} bytes.', flush=True)


if __name__ == '__main__':
    main()
