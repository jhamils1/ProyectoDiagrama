# ADR 013 · Validar datos propuestos contra la solicitud

20/09/2026. Decisión previa al segundo experimento 6C. Se resolvió la carga con datos externos: 27/30 originales. La regresión 6B todavía falla: nombres pluralizados, multiplicidades sustituidas, renombrados sin cambios y atributos inventados. La nueva suite 6C aún no fue ejecutada.

Añadir validación `6C-grounded-v1` sin cambiar prompt, pesos, esperados ni límite de una corrección. Esta validación **no crea operaciones ni reescribe JSON**: comprueba los valores que el modelo propuso contra datos explícitos de la solicitud. El único intérprete que elige operaciones continúa siendo el modelo.

- Identificadores propuestos deben aparecer como palabras completas, con mayúsculas conservadas, en la instrucción. No basta con que una clase esté en el contexto para inventarla como extremo de una relación. Instrucciones sin referencia explícita requieren aclaración en este laboratorio sin conversación previa ni selección de elementos.
- Un tipo de atributo requiere evidencia textual: tipo canónico o los sinónimos ya documentados (texto/cadena, entero, booleano). Esto puede rechazar paráfrasis adicionales; informar esta limitación en vez de adivinar.
- Si se mencionan multiplicidad/origen/destino y valores numéricos, no proponer valores distintos de los literales presentes. No inferir cardinalidades mediante reglas.
- Renombrar al mismo nombre no constituye una propuesta útil: rechazar el no-op. El dominio UML sigue comprobando referencias, duplicados y ciclos.

Enviar el error concreto al único intento de corrección del mismo modelo. Si persiste, rechazar sin aplicar ni convertir ese fallo en acierto del corpus. Mantener métricas y guardar versión de validación. El chequeo no garantiza intención: una operación omitida o datos intercambiados que sí aparecen en el texto pueden superarlo. Añadir pruebas de esos límites.

Conservar informes previos sin este chequeo y repetir originales/6B antes de evaluar los 20 casos 6C todavía reservados. No modificar esos casos después de ver resultados. Siguen vigentes todos los umbrales de ADR 012 y el alcance de laboratorio; no declarar integración completa.

## Resultado posterior

Validación implementada tanto en la corrección como en la aceptación final. Resultado: 28/30 originales, 17/20 de 6B y 15/20 de la nueva suite. Propuestas aceptadas incorrectas: 0, 0 y 1 respectivamente; en C08 el modelo marcó un atributo obligatorio sin solicitarlo, límite no cubierto por la comprobación literal. No se alcanzan todos los umbrales; se conserva la validación como mejora del laboratorio y no se aprueba integración. No se ajustó tras observar la suite clínica; ahora es conocida. Evidencia y próximos pasos en ETAPA_06C.
