# CU10: exportación XML UML

## Evidencia manual en Enterprise Architect — 21/09/2026

El usuario descargó el XML desde Modela y lo importó en Enterprise Architect. Creó el diagrama de clases `prueba importacion` y arrastró las tres clases del paquete importado al lienzo como Link. La captura compartida en la conversación muestra:

- Cliente: `id: Long`, `nombre: String`.
- Pedido: `id: Long`, `total: Double`.
- ClientePremium: `codigo: Long`.
- Asociación Cliente–Pedido con `1..1` en Cliente y `0..*` en Pedido. `1..1` es equivalente a `1`.
- Generalización desde ClientePremium hacia Cliente, con el triángulo dirigido al padre.

Resultado: exportación e importación real comprobadas para esta muestra de clases, atributos, tipos, asociación, multiplicidades y herencia. El usuario confirmó la finalización después de indicar guardar el diagrama. La captura se recibió en el chat; no se ha guardado un archivo de imagen en el repositorio ni verificado una reapertura del proyecto EA.

Límites: distribución manual en EA, sin conservación de posiciones/estilos ni generación automática del diagrama visual. La captura no verifica isID, obligatoriedad, abstracción ni todos los casos del formato; estos no se consideran acreditados por esta prueba manual. Versión exacta de EA no registrada. Esta evidencia sustituye el pendiente de importación real de las etapas históricas siguientes, sin afirmar compatibilidad universal.

## Etapa 2: descarga desde el editor

GET `/api/projects/{project}/diagrams/{id}/xmi?revision=N` exporta una instantánea persistida autorizada. Admite administrador/editor; rechaza consulta, acceso ajeno y permisos revocados. Revisión desactualizada devuelve 409; respuesta XML descargable con no-store y nombre `diagrama-ID-rN.xml`. La exportación no crea versiones ni altera el modelo.

Botón `Exportar XML` junto a `Generar backend`, reutilizando el componente de descarga y sus bloqueos: sin conexión, cambios pendientes, guardados/formularios abiertos o permiso insuficiente. El tooltip indica que no incluye posiciones ni estilos.

Se verifican permisos y descarga en API, y descarga/conflicto/bloqueos en pruebas de navegador. La importación real de la muestra se comprobó posteriormente según la evidencia manual anterior; no se acredita conservación visual.

## Etapa 1: generador interno

`EaXmiWriter.write(DiagramDocument)` valida el modelo y genera bytes XML UTF-8, XMI 2.5.1/UML 2.5 usando los espacios de nombres del archivo EA probado. No modifica ni persiste el diagrama. Emplea un escritor XML para escapar texto y rechaza caracteres inválidos en XML 1.0.

Incluye clases, abstracción, atributos, tipos locales PrimitiveType, visibilidad, isID, obligatoriedad mediante multiplicidad, asociaciones con ambos extremos y generalizaciones hija→padre. Un tipo vacío permanece sin tipo; no se inventa identificador. Los UUID generan IDs XML estables, con prefijos separados para tipos, extremos y límites. La multiplicidad `*` se expresa como `0..*`, equivalente en UML.

No exporta todavía posiciones, estilos, tamaños ni un diagrama visual específico de EA. La etiqueta de generalización y sus multiplicidades internas no se exportan: no forman parte de la semántica de herencia representada. No hay métodos UML en el modelo actual.

Verificación: 18 pruebas aprobadas del lector, conversor y escritor. Se exporta y vuelve a importar una muestra con herencia/asociación, comparando atributos y banderas, extremos y multiplicidades. También se prueban tipos del editor, atributos sin tipo, autorrelaciones y rechazo de referencias inválidas. Esta comprobación interna NO acredita todavía importación real en Enterprise Architect.

La verificación manual de la muestra está registrada arriba. Ampliaciones de cobertura y conservación visual quedan fuera de esta evidencia.

Reproducir: `mvn -Dtest=EaXmiWriterTest,EaXmiReaderTest,EaXmiConverterTest test` desde `apps/api` con Java 21.
