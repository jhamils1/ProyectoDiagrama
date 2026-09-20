# ADR 002 · Primera entrega del editor web

Estado: implementada la parte local descrita; CU07/CU08 continúan parcialmente cubiertos.

## Alcance de la etapa

Crear y renombrar borradores locales; agregar, editar y eliminar clases y atributos; crear, editar y eliminar asociaciones/generalizaciones; mover clases; guardar y recuperar el modelo; abrir la aplicación compilada sin conexión tras la preparación inicial.

Son borradores de este navegador, sin cuentas ni pertenencia a proyectos compartidos. No se los presenta como proyectos autorizados de CU04–CU06. No se implementaron todavía Spring Boot, PostgreSQL, Flutter, permisos, sincronización central, IA, XMI ni generación. Esta etapa no modifica esas tecnologías o requisitos.

## Diseño adoptado

- React + TypeScript estricto + Vite. React Flow se limita a la representación visual; el dominio no importa React ni React Flow.
- Módulo `apps/web/src/features/modeling`, separado en dominio, aplicación, infraestructura e interfaz. La aplicación coordina validación y persistencia, y actualiza el estado visible después de confirmar escritura.
- IndexedDB mediante `idb` para los borradores; Zod para validar su esquema y funciones de dominio para invariantes. Si la lectura falla, no se reinicializa ni reemplaza la base existente.
- Comparación y escritura de la revisión local en una sola transacción IndexedDB. Dos pestañas con la misma base no pueden confirmar ambas modificaciones. La operación rechazada se informa, pero no se conserva como entidad Conflicto: CU12 sigue pendiente.
- `schemaVersion = 1` identifica el formato del borrador; `localRevision` identifica escrituras locales. No equivale a `Diagrama.versionActual` ni a una instantánea histórica central.
- PWA mediante service worker generado por vite-plugin-pwa. Recursos de aplicación cacheados en la compilación de producción; actualización ofrecida al usuario para evitar recargar mientras escribe formularios. El modo de desarrollo no acredita apertura offline.
- Cada operación confirmada en la interfaz se guarda automáticamente; las propiedades/atributos se confirman mediante su formulario. La semántica de Guardar colaborativo en H05 sigue pendiente.

## Reglas concretadas para esta etapa

| Área | Regla |
| --- | --- |
| Identidad | UUID estable y único dentro del documento para diagrama y elementos. |
| Nombres UML | De 1 a 80 caracteres, letras ASCII, números y guion bajo; sin dígito inicial. Se recortan espacios externos. Unicidad sin distinguir mayúsculas por diagrama/clase. Es un subconjunto inicial; faltan reglas finales de nombres reservados y tipos del generador. |
| Diagrama | Nombre de 1 a 100 caracteres, texto libre recortado. |
| Tipos de atributos | String, Integer, Long, Decimal, Boolean, Date, DateTime, UUID. Visibilidad private/public/protected/package. |
| Identificador | Como máximo uno por clase en esta etapa; si existe debe ser obligatorio. Esto no acredita que un diagrama sin identificador sea válido para generar backend. |
| Asociaciones | Extremos del mismo diagrama; se admiten reflexivas y multiplicidades numéricas, `*` e intervalos ordenados. Duplicado = mismo tipo, origen, destino y nombre sin distinguir mayúsculas. |
| Generalización | Origen = subclase, destino = superclase. Una superclase por clase, sin autorreferencias ni ciclos. Se representa con triángulo hueco hacia la superclase. |
| Eliminación | Eliminar una clase exige confirmación y elimina sus atributos y relaciones del borrador en una escritura. Esta política local no decide cascadas ni retención del historial central. |
| Posiciones | Coordenadas finitas; se guardan al terminar de arrastrar o mover con flechas. Medidas del renderizador permanecen fuera del modelo persistido. |

## Correspondencia con el diseño académico

| Concepto del contexto | Tipo local | Persistencia actual | Persistencia central |
| --- | --- | --- | --- |
| Diagrama | Diagram | Registro IndexedDB con elementos anidados | Pendiente |
| ClaseUML | UmlClass | `Diagram.classes` | Pendiente |
| AtributoUML | UmlAttribute | `UmlClass.attributes` | Pendiente |
| RelacionUML | UmlRelation | `Diagram.relations` | Pendiente |
| Usuario, Participacion, Proyecto, VersionDiagrama, Cambio, Conflicto | No implementados | No implementados | Pendiente |

Guardar un borrador estructurado local no sustituye el diseño central de 10 entidades/tablas ni convierte el JSON en la única persistencia de la herramienta terminada. Al integrar proyectos y cuentas habrá que definir migración/importación de estos borradores y aislamiento por usuario, sin asignarles permisos automáticamente.

## Límites y siguiente incremento

El borrado de datos del navegador o su expulsión por falta de espacio puede eliminar borradores. Todavía no hay respaldo exportable, historial ni recuperación de versiones. No se afirma cumplimiento completo de trabajo offline multiusuario.

El siguiente incremento puede conectar acceso/proyectos con Spring Boot y PostgreSQL una vez concretados D03–D06, mientras se prepara la evaluación del ADR 001. La selección de biblioteca y almacenamiento web de D08/D02 queda resuelta; Flutter, contratos centrales y mapeo de generación siguen pendientes.
