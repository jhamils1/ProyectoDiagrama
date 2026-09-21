# ADR 016: alcance de edición y respuestas verificables

Fecha: 20/09/2026. CU14 parcial, incremento 6F.

## Requisito confirmado por el usuario

La IA asiste en la edición del diagrama UML existente mediante instrucciones concretas sobre clases, atributos, métodos y relaciones. No genera diagramas completos ni deduce entidades desde una descripción de dominio como «crear sistema de biblioteca». Puede crear clases expresamente indicadas dentro del diagrama. Esto no cancela CU15 (reconstrucción desde imagen) ni CU11 (backend generado a partir del modelo): son requisitos distintos que permanecen pendientes.

La implementación actual no contiene métodos en UmlClass, interfaz, API ni persistencia. Tampoco expone a IA todas las operaciones de edición de atributos/relaciones. Quedan pendientes dentro del alcance aprobado; no confundir capacidad todavía ausente con exclusión del producto. Incorporar métodos exige diseñar firma, parámetros, retorno y visibilidad, así como versiones, migración y sincronización antes de implementar su edición. No agregar una operación de IA que los datos no puedan conservar.

## Decisiones antes de implementar

- Primer incremento 6F: contrato de respuestas negativas, verificación de hechos y límite de asistencia. Conservar operaciones positivas, pesos 1.7B externos, modo greedy y un reintento.
- El modelo devuelve motivos enumerados y referencias; la aplicación redacta los mensajes. Eliminar explicación libre del contrato, sin aceptar silenciosamente el formato anterior.
- Comprobar nombres citados contra la solicitud, existencia/duplicados contra el modelo, tipos no admitidos contra los tipos y alias soportados, e identificadores inválidos contra el formato real. Un rechazo por clase inexistente no puede referirse a una clase presente.
- Una aclaración específica debe citar el dato presente en la solicitud; las aclaraciones sin clase indicada no deben elegir una clase del contexto. Esto verifica hechos y evita texto inventado, pero no demuestra toda la interpretación semántica (por ejemplo, el motivo de duplicado puede ser verdadero aunque el usuario no pidiera crear).
- Motivo distinto para operaciones todavía no implementadas, incluyendo métodos. Solicitudes generales de generar sistemas reciben una petición de instrucciones concretas, sin proponer clases inferidas. Una protección determinista cubre formulaciones explícitas; el prompt aplica el alcance al resto. No presentar esa protección léxica como clasificador exhaustivo del lenguaje.
- Validación compartida para el reintento y la aceptación final del laboratorio. No cambiar automáticamente identificadores, multiplicidades ni operaciones generadas.
- Verificar contrato, política, reintento y UI; definir casos nuevos antes de inferencia. El cambio de contrato hace las negativas más estrictas que las métricas históricas. No declarar mejora de precisión global sin ejecutar una evaluación completa y revisar su pertinencia.

CONTINUAR_AQUI.md queda intacto. Word requiere posteriormente reflejar la precisión de alcance y el soporte pendiente de métodos; no se modifica en este incremento de código.

## Criterio de cierre de este incremento

Completar y probar contrato, comprobaciones y política en el laboratorio; registrar los veinte casos de 6F aunque el modelo no alcance el objetivo. No ajustar los esperados después de ejecutar. La integración con proyectos sigue pendiente y exige vista previa, confirmación, permisos y persistencia, además de evaluación suficiente. El contrato reduce explicaciones inventadas; no garantiza que el modelo elija el motivo pertinente.
