# Etapa 6G: IA acotada integrada al editor

El usuario prioriza una demostración funcional con los comandos ya comprobados. [ADR 017](decisiones/ADR-017-ia-edicion-demo.md) autoriza esta integración limitada sin exigir aprobar el benchmark general de 6F. Sus fallos históricos siguen siendo válidos.

## Uso y guion de presentación

1. Ejecutar `npm.cmd run build` y `npm.cmd run preview`. Abrir `http://127.0.0.1:4173/` o un diagrama de proyecto con permiso de edición. Para proyectos centrales también debe estar iniciado el backend.
2. Preparar manualmente tres clases: `Lancha`, `Capitan` y `Embarcacion`. Guardar cualquier formulario abierto.
3. Pulsar **Asistente IA**. La primera vez, **Preparar recursos IA** (aproximadamente 1,46 GB); después, **Cargar IA local**. Los recursos externos deben estar publicados localmente según la receta de [6C](ETAPA_06C.md). Cargar usa la caché; no descarga modelos de internet durante la inferencia.
4. Escribir cada instrucción, pulsar **Generar propuesta**, revisar y **Confirmar y guardar**. También se puede descartar sin cambios.

Ejecutar en este orden sobre un diagrama preparado sin Carga ni Faro:

```text
Crea la clase Carga.
Agrega capacidad de tipo Long a Lancha.
Agrega licencia de tipo String obligatoria a Capitan.
Crea Faro y agrega altura de tipo Decimal a Faro.
Lancha hereda de Embarcacion.
Renombra Lancha a Velero.
```

Renombrar al final mantiene válidas las referencias anteriores. Después cerrar el asistente y recargar para mostrar la persistencia.

Se admiten estas formas con nombres y tipos variables, no lenguaje libre arbitrario. Tipos: String, Integer, Long, Decimal, Boolean, Date, DateTime y UUID. Las pruebas reales de este guion cubren Long, String y Decimal. El motor genera la propuesta; un validador de intención compara todas las operaciones con la instrucción admitida. No se aplican operaciones calculadas por reglas como si fueran salida de IA. Si el motor falla, se informa y permite reintentar.

## Implementación y límites

- `features/ai/domain/editorProposal.ts`: alcance limitado, comparación exacta y descripción de cambios. Impide método→atributo, operaciones extra, tipos u obligatoriedad distintos. El laboratorio conserva su contrato y métricas anteriores.
- `features/ai/ui/EditorAssistant.tsx` y `App.tsx`: modal, ejemplos, preparación/carga, cancelación, revisión, confirmación y descarte. No disponible para lectores ni con campos manuales pendientes. Al desmontar cancela el motor y descarta respuestas tardías.
- `modeling/domain/model.ts`: `applyReviewedEdit` valida la instantánea y guarda todos los elementos de una propuesta en una sola revisión, conservando sus UUID durante reintentos. Reutiliza `execute`: IndexedDB de borradores, propuestas del servidor o cola de copias offline. No modifica API, tablas ni permisos.

Métodos, asociaciones, borrado y cambios de atributos/relaciones existentes por IA quedan pendientes. Las funciones manuales existentes siguen disponibles. No genera sistemas completos. CU15 de imágenes continúa al final, condicionado al tiempo y a consulta/autorización previa.

## Verificación

113 pruebas unitarias y 19 de navegador aprobadas; compilación y lint correctos. Pruebas nuevas: comparación de intención, cambios atómicos, revisión antigua, UUID estables, permisos/bloqueo de copias offline, vista previa/descarte, recuperación offline, conflicto entre pestañas y conservación de formularios manuales. Los E2E usan motor simulado; se separan del ensayo real.

El ensayo real del editor se ejecuta con `node scripts/ai/editor-demo.mjs`, con preview activo y recursos cacheados en un perfil exclusivo de QA. Registra las seis instrucciones, la ausencia de escritura previa a confirmar, revisión guardada y recuperación tras recarga offline. No usa datos de proyectos reales. Windows mantiene una solicitud temporal de actividad durante la medición, liberada al terminar.

Resultado del ensayo real: **6/6 comandos generados, confirmados y guardados**, sin modificación antes de confirmar; diagrama recuperado íntegro tras recarga offline. Tiempos observados por propuesta: 30,9 / 14,3 / 14,3 / 14,8 / 20,7 / 14,7 segundos, en el orden del guion. Sin solicitudes externas ni errores de página registrados. [Informe con modelo inicial y final](evidencias/ia-editor-6g.json). Capturas revisadas visualmente e informe E2E en `.qa/etapa-06g`. Ensayo en Windows 11/Edge/Intel Iris Xe; no acredita funcionamiento en cualquier equipo. No se repite el benchmark general de 90 casos. El backend no se revalidó en esta etapa; la integración reutiliza su flujo de propuestas y autorización existente. No se acredita voz ni Flutter.

`CONTINUAR_AQUI.md` permanece intacto. Word pendiente de incorporar esta entrega y las decisiones de alcance.
