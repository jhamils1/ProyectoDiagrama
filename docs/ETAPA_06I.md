# Etapa 6I: atributos sin tipo de dato

Decisión del usuario: el tipo no es obligatorio al agregar un atributo. [ADR 019](decisiones/ADR-019-atributos-sin-tipo.md).

## Funcionamiento

En el editor, **Agregar atributo** inicia con **Sin tipo**. Se puede guardar así, asignarle un tipo después o volver a dejarlo sin tipo. No se presupone String. El indicador **Obligatorio** se refiere al valor del atributo y es independiente del tipo.

En el asistente se admiten:

```text
Agrega modelo a Vehiculo.
Agrega el atributo modelo en la clase Vehiculo.
Agrega el atributo modelo a la clase Vehiculo.
Agrega modelo sin tipo a Vehiculo.
Agrega modelo obligatorio a Vehiculo.
Crea Vehiculo y agrega marca a Vehiculo.
Crea la clase vehiculo con atributo marca.
Crea la clase Producto con el atributo precio.
```

Las clases referenciadas deben existir, salvo creación explícita. Se conserva el flujo Generar propuesta → revisar → Confirmar y guardar. Las instrucciones con tipo explícito continúan disponibles. No se amplía a listas arbitrarias de atributos ni a otras formas de lenguaje.

Ampliación posterior solicitada: se admite la forma `agrega el atributo modelo en la clase vehiculo` (sin punto final y con clase en minúsculas). «El atributo» es opcional y el destino puede expresarse como «a», «a la clase» o «en la clase». Se conservan nombres, tipo opcional y obligatoriedad. Se amplía el ejemplo del prompt y se precisa que el reintento debe devolver una propuesta corregida, no un objeto de error; guardado sin cambios. Pruebas en `attributePhrase.test.ts` y `untyped.test.ts`; 135 unitarias aprobadas, compilación y lint correctos. Reproducción del ensayo de esta frase: `node scripts/ai/editor-demo.mjs --attribute-phrase`.

## Datos y correspondencia

Ampliación «clase con atributo»: se crean ambas operaciones en una sola propuesta y se guardan juntas al confirmar. El tipo queda vacío; una clase duplicada se rechaza. `editorProposal.ts` reconoce la forma, `attributePhrase.test.ts` verifica creación conjunta, nombres alternativos, duplicados y rechazo de un tipo inventado. No cambia el prompt ni el modelo. Verificación: 138 pruebas unitarias y 5 E2E del asistente aprobadas; compilación y lint correctos. Ensayo `node scripts/ai/editor-demo.mjs --class-attribute`: frase exacta interpretada por IA local en 22,6 s, sin cambios antes de confirmar y recuperada offline tras guardar. [Evidencia real](evidencias/ia-clase-con-atributo.json).

- `model.ts` y `proposal.ts`: `dataType = ""` representa sin tipo, también al omitir el campo. Los tipos no vacíos siguen validados contra el catálogo.
- `Inspector.tsx` y `ClassNode.tsx`: selector Sin tipo y presentación sin asignación ficticia.
- `editorProposal.ts`, `untyped.ts`, `EditorAssistant.tsx`: reconoce la omisión, usa prompt específico `6I-untyped-v1` y rechaza que el modelo invente un tipo. La salida sigue siendo generada por el motor local.
- `DiagramDocument.AttributeData`: normaliza null/omisión a vacío; `DiagramRepository` conserva ese valor en `AtributoUML.tipoDato` e instantáneas. **V4** amplía la restricción de `atributo_uml.tipo_dato`; conserva atributos previos e identidades. Sin nuevas entidades ni cambios de versión IndexedDB.

Para proyectos centrales, **reiniciar el backend actualizado** con `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/backend.ps1 run`: Flyway aplica V4 a la base configurada al arrancar. No ejecutar este cliente con un backend anterior que todavía rechace el vacío. Actualizar las pestañas antiguas; no eliminarlas ni borrar sus datos. V4 se verificó en `modela_test`, no se aplicó manualmente a la base de desarrollo.

Una futura generación de backend requerirá resolver los tipos que necesite; el diagramador no debe inventarlos ahora. Las rúbricas históricas del laboratorio que exigían preguntar el tipo pertenecen al requisito anterior y no certifican esta ampliación.

## Verificación

**130 pruebas unitarias frontend, 21 E2E y 61 backend aprobadas**, compilación y lint correctos. PostgreSQL real: creación sin campo dataType, lectura del vacío, asignación y eliminación posterior del tipo mediante propuestas, historial con String preservado y rechazo de tipo inventado sin sobrescritura. Frontend: persistencia IndexedDB, comparación exacta de intención, edición manual posterior, recarga y regresión del editor/IA.

El primer intento de pruebas backend falló por restricciones del entorno de ejecución; después, por PostgreSQL detenido. Tras ejecutar fuera del sandbox e iniciar la instancia local existente, la suite completa pasó. No se modificaron las credenciales ni se reemplazó PostgreSQL por un simulador.

Ensayo real de IA: `node scripts/ai/editor-demo.mjs --untyped`: **2/2 guardados y recuperados offline**, en 11,5 y 9,8 segundos. `Agrega modelo a Lancha` y `Crea Vehiculo y agrega marca a Vehiculo` producen dataType vacío; sin modificación antes de confirmar. [Informe final](evidencias/ia-sin-tipo-6i.json). La [primera ronda](evidencias/ia-sin-tipo-6i-inicial.json) falló 0/2 porque el modelo repetía el contexto; añadir ejemplos al prompt específico corrigió ambos casos. No se ajustaron los resultados esperados. No equivale a precisión general, ni a probar todos los nombres. Las pruebas E2E anteriores usan motor simulado y se registran por separado; informe en `.qa/etapa-06i/e2e-results.json`.

CU15 permanece pendiente y requiere consulta previa. CONTINUAR_AQUI.md intacto. Word pendiente de incorporar el tipo opcional.

Verificación de la frase ampliada: `agrega el atributo modelo en la clase vehiculo` se guardó y recuperó offline con IA real en 13,9 s. Las dos primeras rondas greedy identificaron bien los elementos pero emitieron JSON inválido; se conservaron sin aplicar. La generación restringida al esquema resolvió ese fallo y se activa solo para atributos sin tipo. Los demás comandos mantienen su modo anterior. Esta prueba no certifica cualquier redacción ni elimina las limitaciones históricas del motor estructurado. Ver ADR 019.

Resultado final de esta ampliación: **135 pruebas unitarias frontend y 21 E2E aprobadas**, compilación y lint correctos. [Frase exacta con motor real](evidencias/ia-frase-atributo.json): 1/1. [Regresión con motor real](evidencias/ia-frase-atributo-regresion.json): 2/2, `Agrega modelo a Lancha` y `Crea Vehiculo y agrega marca a Vehiculo`, en 11,9 y 10,3 s. Ambos mantienen el tipo vacío, no modifican antes de confirmar y se recuperan offline. Backend sin cambios en esta ampliación; conserva la verificación anterior de 61 pruebas.
