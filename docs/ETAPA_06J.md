# CU14: tipos de atributos en instrucciones

Solicitud: admitir «Agrega el atributo modelo de tipo String en la clase vehiculo» con distintos tipos de dato.

Decisión: conservar el catálogo tipado, aceptar nombres sin distinguir mayúsculas y añadir Float y Double como tipos propios. No convertir flotantes a Decimal ni aceptar tipos arbitrarios silenciosamente. `int`/`entero` → Integer; `bool`/`booleano` → Boolean; `texto`/`cadena` → String. Los nombres de clases y atributos conservan su escritura exacta. El tipo sigue siendo opcional.

Tipos disponibles: String, Integer, Long, Decimal, Float, Double, Boolean, Date, DateTime y UUID. Ejemplos:

```text
Agrega el atributo modelo de tipo String en la clase vehiculo.
Agrega el atributo ruedas de tipo int en la clase vehiculo.
Agrega el atributo activo de tipo boolean en la clase vehiculo.
Agrega el atributo peso de tipo float en la clase vehiculo.
Agrega el atributo distancia de tipo double en la clase vehiculo.
```

La clase debe existir. La IA genera la propuesta; el validador compara el tipo canónico solicitado con la salida sin reparar ni reemplazar la respuesta del motor. Se mantiene la vista previa, confirmación, permisos y control de versión existentes.

Correspondencia: `dataTypeAliases.ts` centraliza equivalencias para reconocimiento, validación de evidencia y respuestas negativas; `proposal.ts` informa los tipos al motor. `model.ts` y `DiagramDocument.java` admiten Float/Double. Flyway V5 amplía la restricción de `atributo_uml.tipo_dato`, conservando filas y versiones anteriores. El selector manual usa el mismo catálogo. Reiniciar el backend actualizado para aplicar V5 a la base configurada; las pruebas usan modela_test.

Pruebas: `attributePhrase.test.ts` cubre String, string, int, boolean, bool, float, double, Decimal y LONG, además del rechazo de GeoPoint. `floatingTypesPersistAndKeepPreviousVersion` verifica Float/Double en PostgreSQL y la conservación de la versión anterior. Ensayo real reproducible: `node scripts/ai/editor-demo.mjs --typed-attributes`.

CU15 sigue pendiente y requiere consulta previa. CONTINUAR_AQUI.md no se modifica.

Verificación: 148 pruebas unitarias frontend, 14 E2E de editor/laboratorio y 62 backend aprobadas; compilación y lint correctos. El primer intento backend encontró una restricción de acceso a una dependencia Maven local; al repetir fuera del sandbox, Maven registró BUILD SUCCESS y Surefire cero fallos/errores (el envoltorio de ejecución informó código 1, conservándose el registro para auditoría).

[Ensayo con IA local real](evidencias/ia-tipos-6j.json): 5/5 instrucciones guardadas y recuperadas offline, ninguna aplicada antes de confirmar. String: 44,3 s; int: 35,7 s; boolean: 19,8 s; float: 20,6 s; double: 16,0 s. El informe conserva la etiqueta histórica 6F-v1 del script al comenzar la ejecución; el prompt utilizado es el actualizado con tipos y alias de esta etapa. El script ahora etiqueta estos ensayos como 6J-types-v1. No acredita interpretación de cualquier redacción o tipo arbitrario.
