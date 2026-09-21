# CU09/CU10 — primer incremento: lectura XMI

## Experiencia vigente: cargar → revisar resumen → confirmar

Por decisión posterior del usuario, se elimina la elección técnica obligatoria para casos conocidos. Al cargar el archivo se analiza automáticamente: el servidor sugiere Double para el primitivo Real y marca únicamente asociaciones con cero extremos como vacías. La interfaz prepara una segunda vista previa con estas propuestas y muestra `Pedido.total: Real → Double` y que se omitirá una relación vacía. No hay guardado hasta «Confirmar importación». Tipos desconocidos y relaciones con un solo extremo no reciben sugerencia automática.

«Opciones avanzadas» permite cambiar o retirar las propuestas; cada elección vuelve a validar automáticamente y bloquea la confirmación mientras se procesa. Cambiar el nombre no obliga a repetir el análisis; el servidor valida el nombre al guardar. Se conservan el documento congelado para reintentos y los controles de permisos/CSRF. Los UUID de las incidencias no aparecen en el resumen de usuario.

Verificación: suite completa de 92 pruebas backend aprobada; después, las 6 pruebas del lector aprobadas al añadir un caso para tipo desconocido/relación incompleta. Build correcto, lint solo con avisos previos; 2 E2E aprobadas (controlada con anulación de propuesta y reintento, y XML real importado/recuperado sin elecciones obligatorias). Captura revisada en `.qa/import-xmi-simple.png`. Backend local actualizado; el usuario debe actualizar la aplicación y puede necesitar iniciar sesión de nuevo tras el reinicio. Este flujo reemplaza la secuencia manual de revisiones descrita en los incrementos históricos siguientes.

## Cuarto incremento vigente: importación en la interfaz

En la lista de diagramas del proyecto, ADMINISTRACION/EDICION dispone de «Importar XML de EA». `ImportXmiDialog` reutiliza Modal y el cliente API. Lee hasta 2 MiB como bytes/base64; permite nombrar, revisar incidencias, elegir tipos y excluir asociaciones inválidas explícitamente. Cada cambio invalida la vista previa anterior. Muestra clases/atributos, obligatoriedad, visibilidad, relaciones, herencia y avisos; nunca preselecciona Double ni exclusiones. Los estilos/tamaños/metadatos EA se declaran fuera del subconjunto.

Confirmar envía exactamente el documento revisado a POST `/projects/{project}/diagrams`, que vuelve a comprobar autorización y `DiagramDocument.validate()`. Se crea un diagrama nuevo y se abre en el editor; no reemplaza otros diagramas. Tras iniciar el guardado se congelan documento e identidades para reintentar sin duplicados; las decisiones quedan bloqueadas hasta terminar o cerrar. Cancelar antes de confirmar no escribe. No necesita migración ni nuevo endpoint de guardado.

Verificación: **92 pruebas backend aprobadas**, incluida confirmación tras vista previa, revocación antes de guardar, recuperación y reintento idempotente. Build web correcto; lint sin errores nuevos (persisten dos avisos previos en DiagramCanvas). **2 E2E aprobadas**: respuestas controladas para invalidación/confirmación/reintento y recorrido real con API/PostgreSQL: carga del XML, Real→Double elegido, exclusión elegida, cero diagramas antes de confirmar, tres clases/dos relaciones guardadas y recuperadas al recargar con herencia correcta. Proyecto de prueba eliminado lógicamente al terminar. Backend local reiniciado para cargar el endpoint.

Para probar: abrir proyecto → «Importar XML de EA» → seleccionar pruebaA.xml → «Revisar importación» → seleccionar equivalencia para Real y decidir excluir la asociación vacía → revisar nuevamente → «Confirmar importación». Los atributos id sin isID=true no se convierten automáticamente en identificadores. CU09 está disponible para el subconjunto probado; CU10 exportación y compatibilidad general siguen pendientes. CONTINUAR_AQUI.md y Word intactos.

## Tercer incremento: resoluciones explícitas y API de vista previa

Verificación: suite backend completa, **92 pruebas aprobadas, 0 fallos/errores**, Maven BUILD SUCCESS.

`EaXmiConverter.preview` acepta equivalencias por ID de atributo y exclusiones por ID de asociación inválida. Sin elecciones, el comportamiento bloqueante anterior se conserva. Solo permite resolver tipos pendientes al catálogo del editor y excluir asociaciones reportadas con extremos inválidos. IDs desconocidos, tipos inventados o intentos de excluir relaciones válidas producen RESOLUTION_INVALID. Los cambios elegidos aparecen en notices; se vuelve a validar el documento completo, sin alterar XML ni base de datos.

POST `/api/projects/{project}/imports/xmi/preview`: JSON con `name`, `xmlBase64`, `attributeTypes` (objeto, vacío inicialmente), `excludedInvalidAssociations` (lista vacía inicialmente). Base64 conserva los bytes y la codificación windows-1252. Máximo XML decodificado 2 MiB y nombre 100 caracteres. Reutiliza `DiagramService.creationPermission`: administrador o EDICION, sesión y CSRF requeridos. Retorna 200 con document=null e issues si hay incidencias; o documento validado y notices si están resueltas. Cache-Control no-store. XML/base64 inválido devuelve 400 XMI_INVALIDO. No persiste ni confirma importaciones.

Pruebas añadidas: elegir Double para Real y excluir explícitamente la asociación vacía habilita la muestra; resolver solo una incidencia no basta; opciones falsas/tipos no admitidos se rechazan. Integración API comprueba anónimo, CSRF, ajeno, CONSULTA, EDICION, administrador, revocación, XML inválido y ausencia de diagramas nuevos tras consultar la vista previa.

Siguiente paso: interfaz de carga, decisiones, vista previa y confirmación; revalidar autorización y contenido al guardar. No hay botón nuevo todavía. No reiniciar el backend de demostración por este endpoint interno hasta conectar la interfaz. Exportación CU10 pendiente.

## Segundo incremento vigente: conversión validada sin persistencia

`EaXmiConverter.preview(bytes, nombre)` convierte el subconjunto soportado a `DiagramDocument` y reutiliza `validate()`. Devuelve documento únicamente si no hay incidencias bloqueantes; nunca entrega un modelo parcial listo para guardar. No hay endpoint, botón ni escritura en base de datos todavía.

El lector añade abstracción explícita `isAbstract`, posición UMLDI, visibilidad, multiplicidad del atributo e identificador explícito `isID`. La conversión conserva posiciones y propone cuadrícula con aviso si no existen. Atributos 1 → required=true; 0..1 → false; otras multiplicidades bloquean. Un atributo llamado id no se interpreta como clave sin isID=true. Nuevos UUID por conversión evitan reutilizar identidades de diagramas existentes. Generalización conserva hijo/padre; sus cadenas internas 1/1 satisfacen el contrato existente del editor y no representan cardinalidad UML de herencia.

Decisiones sin resolver bloquean: Real, asociación vacía, visibilidad o multiplicidades ausentes, referencias inválidas. Métodos, agregación/composición explícita y algunas características de atributos no representables producen incidencias. La conversión no renombra nombres inválidos ni descarta relaciones incorrectas. Los metadatos y extensiones EA fuera del subconjunto aún requieren auditoría antes de exponer una importación general (paquetes anidados, estereotipos, marcas de identificador de EA, características representadas solo en extensiones y selección entre diagramas).

Evidencia: **11 pruebas específicas aprobadas** (5 lector + 6 conversor), BUILD SUCCESS. La muestra original sigue bloqueada correctamente por Real y asociación vacía. Una variante exclusivamente de prueba, con Double y sin la asociación vacía, se convierte y valida: clases, tipos, obligatoriedad, visibilidad, posiciones y referencias. También se comprueban abstracción/isID, identidades nuevas, nombres incompatibles, rechazo de métodos/colecciones y aviso de cuadrícula. No se modificó pruebaA.xml ni la muestra original de tests. Próximo incremento: resolver incidencias de forma explícita y preparar vista previa/confirmación con permisos antes de guardar. CU10 exportación sigue pendiente.

## Primer incremento (histórico)

Se implementa únicamente un inventario de lectura, no una importación persistida ni exportación. `EaXmiReader` analiza bytes de la muestra UML 2.5 exportada por EA, respetando la codificación declarada (windows-1252). La copia de prueba está en `apps/api/src/test/resources/interoperability/ea-sample.xml`; `pruebaA.xml` original no se modifica.

Reconoce tres clases, cuatro atributos, asociación Cliente 1 — 0..* Pedido y herencia ClientePremium → Cliente. Resuelve tipos primitivos por referencia interna o URI estándar, sin acceder a la red. Normaliza long/String/int y demás alias conocidos al catálogo del editor. Real queda sin equivalencia, con incidencia TYPE_MAPPING_REQUIRED; no se sustituye por Double silenciosamente. La asociación sin extremos se registra como ASSOCIATION_ENDS_INVALID. No inventa multiplicidades ausentes. Los identificadores son referencias externas XMI, no UUID nuevos del editor.

Seguridad: máximo 2 MiB; DTD y entidades externas prohibidas, XInclude deshabilitado. Identificadores duplicados de definiciones empaquetadas se rechazan; EA puede repetir referencias en metadatos de dibujo y estos no se confunden con definiciones.

Evidencia: 5 pruebas específicas aprobadas, BUILD SUCCESS. Archivo real, tipos y extremos, herencia, incidencias, codificación con ñ, multiplicidades ausentes, XML malformado, formato/tamaño y DTD externo. El primer ensayo detectó identificadores repetidos en metadatos EA; el lector se ajustó a resolver definiciones packagedElement y la repetición pasó.

Pendiente para el siguiente incremento: resolver Real mediante decisión explícita; transformar el inventario al modelo validado del editor, preservar abstracción/visibilidad/multiplicidad de atributos/posiciones e identificadores cuando estén documentados; inventariar elementos no soportados antes de habilitar importación. No interpretar este lector como conversor universal ni ignorar silenciosamente elementos no inventariados (operaciones, paquetes, estereotipos y otras relaciones). Faltan vista previa con incidencias y confirmación, permisos, persistencia, botones y CU10 exportación/recorrido real en EA. No hay endpoint ni cambios en la base de datos. CONTINUAR_AQUI.md y Word intactos.
