# Prueba del flujo de presentación

Abrir la aplicación local en http://127.0.0.1:4173/ y crear un diagrama de prueba vacío. Abrir **Asistente IA** y cargar el modelo local. Sus recursos deben estar preparados antes de desconectar Internet. El primer uso en otro perfil o navegador puede requerir descargar el modelo.

Enviar una instrucción a la vez, revisar su vista previa y pulsar **Confirmar y guardar** antes de continuar:

```text
Crea la clase vehiculo con atributo marca
Agrega el atributo modelo en la clase vehiculo
Agrega el atributo ruedas de tipo int en la clase vehiculo.
Crea la clase automóvil.
La clase automóvil hereda de vehiculo
Crea la clase Cliente.
Crea la clase Pedido.
Crear una asociación entre Cliente y Pedido, donde un Cliente puede tener muchos Pedidos y cada Pedido pertenece a un solo Cliente.
```

Resultado esperado: cuatro clases. `vehiculo` contiene `marca` y `modelo` sin tipo, más `ruedas: Integer`. `automóvil` hereda de `vehiculo`. `Cliente 1 — 0..* Pedido` es una asociación. Cerrar el asistente y recargar debe conservar todos los elementos. Los nombres y sus mayúsculas/tildes deben coincidir.

Reproducción automatizada con el modelo real: `node scripts/ai/editor-demo.mjs --presentation`. Usa un perfil de navegador de QA y un diagrama nuevo; verifica que no se escribe antes de confirmar, ocho guardados, los tipos y referencias finales y la recuperación offline. No modifica diagramas del perfil personal. La prueba local offline y las pruebas de diagramas centrales con API real se registran por separado.

El backend actualizado aplica V4–V6 al arrancar. Esta prueba no amplía el alcance a visión, métodos ni generación completa de sistemas.

## Verificación y ajuste

El backend arrancó correctamente en 8080 y Flyway aplicó V4, V5 y V6 a la base de desarrollo existente. La aplicación está disponible en 4173. Las 21 pruebas E2E con API real pasaron; cubren diagramas centrales, persistencia, sincronización offline, conflictos, sesiones y WebSocket. Reporte en `.qa/presentation/api-e2e-results.json`.

La [primera ronda con IA real](evidencias/ia-presentacion-inicial.json) guardó 7/8 instrucciones. `int` falló con atributos ya presentes: el modelo devolvió literalmente int y después un motivo inválido. La validación bloqueó ambos intentos sin alterar el diagrama. Se añadió `typed.ts` con un prompt acotado, equivalencias tomadas de `dataTypeAliases.ts` y ejemplo sobre otra clase. `EditorAssistant.tsx` lo usa para atributos con tipo explícito y conserva la validación exacta de intención, el modo greedy y la confirmación. No se normaliza ni sustituye la salida del motor para forzar un éxito.

Tras el ajuste: 151 pruebas unitarias, lint y compilación correctos; cinco E2E del asistente aprobadas (`.qa/presentation/assistant-e2e-results.json`). Un intento de iniciar el ensayo antes de finalizar la generación del Service Worker falló al cargar `sw.js`; se repitió con la compilación completada, sin cambiar el código para ocultar ese error de preparación.

[Ronda final con IA real](evidencias/ia-presentacion-final.json): **8/8 instrucciones guardadas**, ninguna modifica el diagrama antes de confirmar. `verifiedFinalGraph=true` y `recovered=true`: cuatro clases, tres atributos con los tipos esperados y las dos relaciones con dirección y multiplicidades correctas, conservadas al recargar sin conexión. Los tiempos por instrucción fueron aproximadamente 7–25 segundos. Es evidencia del guion probado, no de interpretación universal ni de rendimiento en cualquier equipo.
