# CU14: herencia con frase «La clase» y nombres del español

Solicitud: `La clase automóvil hereda de vehiculo`.

Decisiones: conservar exactamente los nombres, sin quitar tildes ni elegir clases parecidas. Habilitar letras españolas precompuestas (áéíóúüñ y sus mayúsculas) en nombres de clases y atributos, junto con las letras ASCII, números y guion bajo existentes. No se admiten espacios, guiones ni números iniciales. No se amplía a cualquier alfabeto Unicode. Ambas clases deben existir; no se crean automáticamente.

`editorProposal.ts` admite el prefijo opcional «La clase» y «hereda de la clase». Genera la intención de generalización con automóvil como hija y vehiculo como padre. La IA debe devolver la operación correspondiente; el flujo existente valida, muestra vista previa y guarda únicamente tras confirmar. Se conservan permisos, revisiones, bloqueo de autoherencia y ciclos.

Correspondencia: `model.ts`, `proposal.ts`, `editorProposal.ts`, `association.ts`, `responses.ts` y `DiagramDocument.java` comparten el alfabeto ampliado. El prompt conserva los nombres con tildes. Flyway V6 amplía las restricciones de `clase_uml.nombre` y `atributo_uml.nombre`, sin renombrar datos existentes. Reiniciar el backend actualizado para aplicar V6 a la base configurada; las pruebas usan modela_test.

Pruebas: `inheritancePhrase.test.ts` verifica dirección, nombres exactos, ausencia de cambios antes de aplicar, clases inexistentes y ciclos. `spanishNamesPersistWithoutLosingAccents` verifica automóvil y año en PostgreSQL y rechazo de espacios. Ensayo reproducible: `node scripts/ai/editor-demo.mjs --inheritance-phrase`.

CU15 permanece pendiente; CONTINUAR_AQUI.md no se modifica.

Verificación final: 151 pruebas unitarias frontend y 63 backend aprobadas; 11 E2E editor/asistente y, tras ajustar el prompt, las 5 del asistente repetidas satisfactoriamente. Compilación y lint correctos. Maven y Surefire registraron BUILD SUCCESS con cero fallos/errores; el envoltorio de ejecución informó código 1, como en 6J, conservándose `.qa/backend-spanish-test.log`.

La [primera inferencia](evidencias/ia-herencia-6k-inicial.json) rechazó erróneamente por autoherencia y no se aplicó. Se añadió `inheritanceMessages` con un ejemplo de nombres diferentes al ensayo y se mantuvo el modo greedy. [Resultado real final](evidencias/ia-herencia-6k.json): frase exacta interpretada en 11,1 s, dirección correcta, nombres con tilde conservados, sin cambios antes de confirmar y recuperación offline después de guardar. El informe mantiene la etiqueta histórica 6F-v1 del script, pero el prompt final usado fue el específico de `inheritance.ts`. Un caso positivo no acredita cualquier redacción.
