# ADR 014: evaluar generación estructurada local

Fecha: 20/09/2026. Alcance: primer incremento de 6D, CU14 parcial.

## Decisiones antes de implementar

- Conservar Qwen3-1.7B externo, prompt 6B-v3, validación 6C-grounded-v1 y un reintento. Separar el efecto del decodificador de futuros cambios semánticos; no descargar pesos nuevos.
- Evaluar `@huggingface/transformers-structured-output` **4.3.0** (Apache-2.0, 728.517 bytes descomprimidos, sin dependencias de ejecución), publicado junto con el runtime instalado. Biblioteca experimental: su presencia no demuestra compatibilidad ni precisión.
- Derivar el esquema de generación del contrato Zod. El motor no admite `pattern`: excluir únicamente esa restricción del esquema de generación y mantenerla en la validación final. No reparar JSON ni construir operaciones mediante reglas.
- Crear un procesador por generación, incluido el reintento, para no compartir estado de gramática. Mantener batch 1, límites de tokens, cancelación y ejecución offline. Registrar versión de decodificación en los informes.
- Fijar 20 casos nuevos antes de medir. Ejecutar las tres suites históricas sin cambiar sus esperados; mantener sus umbrales (27/30, 18/20, 18/20), y exigir 18/20 en la nueva. Mantener carga ≤60 s, mediana ≤15 s y p95 ≤30 s.
- Examinar manualmente las explicaciones negativas de la nueva suite: la puntuación histórica solo verifica ausencia de propuesta, no calidad de aclaración. Publicar ambos resultados sin confundirlos.

## Límites y decisiones pendientes

Este incremento evalúa estructura y compatibilidad. Herencia, instrucciones compuestas, obligatoriedad y explicaciones pueden seguir fallando aun con JSON válido. No habilitar cambios en proyectos por el solo hecho de completar este experimento. Si empeora precisión/latencia o falla el procesador, documentar el resultado y conservar una opción explícita de comparación sin restricciones; no ocultar una caída al modo anterior.

Fuentes primarias consultadas: [release 4.3.0](https://github.com/huggingface/transformers.js/releases/tag/4.3.0) y [README del paquete en ese tag](https://github.com/huggingface/transformers.js/blob/4.3.0/packages/transformers-structured-output/README.md). El perfil JSON Schema admite uniones y límites, excluye patrones de cadenas, requiere una secuencia y EOS compatible. La comprobación en este equipo queda en `docs/ETAPA_06D.md`.

## Resultado y decisión posterior

La prueba sencilla funciona offline, pero el recorrido original se interrumpe en T28 con `Token 0 does not satisfy the constraint.`. El mismo error se reproduce en una sesión nueva usando solo esa instrucción. **No adoptar generación estructurada como modo predeterminado ni certificarla como compatible para el conjunto de operaciones.** Mantenerla exclusivamente como opción experimental de diagnóstico.

Se detienen las restantes suites de precisión de esta variante al fallar la condición previa de ejecución estable. No se publican porcentajes sobre una suite incompleta ni se consideran aprobados casos no ejecutados. Los 20 casos 6D siguen reservados, sin inferencia; podrán evaluar un futuro candidato. Los umbrales permanecen intactos. Resolver este fallo o cambiar la estrategia requiere otro incremento y decisión explícita; modificar simultáneamente el prompt aquí impediría aislar la causa.
