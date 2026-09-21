# Inspector de clases UML

Se revisaron `Inspector.tsx`, los comandos del modelo y los controladores local, central y de copia offline. Se reutiliza Inspector y los comandos `updateClass`, `upsertAttribute` y `deleteAttribute`; no cambian el modelo de datos, la API ni las migraciones.

La interfaz separa CLASE y ATRIBUTOS. La casilla Abstracta conserva el dato UML. Los atributos se presentan como nombre : tipo; (+) abre una fila compacta y editar reemplaza la fila del atributo seleccionado. Visibilidad, identificador y obligatoriedad están en Opciones UML. Sin tipo continúa disponible.

Decisión actualizada por el usuario: sin botones de guardar. Enter o salir del grupo de propiedades/fila confirma los cambios. Cambiar de nombre a tipo dentro de la fila no guarda parcialmente. Escape cancela; una fila nueva vacía se descarta al salir. Las entradas inválidas permanecen para corregirlas. Un clic fuera con cambios pendientes se utiliza para confirmar, sin cambiar la selección ni navegar antes de resolver el guardado. Se previenen envíos duplicados entre blur y Enter. Se mantienen la validación, los permisos y la coordinación con IA y sincronización.

La lista presenta columnas Nombre y Tipo. La prueba nueva «inspector guarda al salir de la fila» verifica el clic en el lienzo, ausencia de guardados intermedios, persistencia, entrada inválida y Escape. Los tests y el script de demostración usan Enter en lugar de los botones retirados.

Las secciones y el editor de fila permiten ampliar el inspector posteriormente con métodos, relaciones o propuestas, sin incorporar controles ficticios ni declarar esas funciones implementadas. La vista previa de IA permanece en el asistente existente.

Verificación: compilación y lint correctos; 16 E2E aprobadas (12 existentes de editor/IA, una nueva de inspector y tres con API real). La nueva prueba convierte una clase en abstracta y concreta, agrega y edita atributos con opciones UML, comprueba persistencia tras recargar y elimina el atributo. Las pruebas con API real comprueban persistencia central y guardado durante sincronización demorada. Revisión visual a 1440 px y 390 px, sin desbordamiento horizontal. El primer ensayo nuevo usaba coincidencia exacta para una etiqueta de select que incluye opciones; se ajustó el localizador y pasó, sin cambiar la validación del producto.

Actualizar la aplicación después de guardar o copiar campos pendientes para recibir esta interfaz. CONTINUAR_AQUI.md sin modificaciones.

Verificación posterior del guardado sin botones: 14 E2E de editor/IA y dos E2E con API real y sincronización demorada aprobadas, compilación y lint correctos. Un primer ensayo detectó que el clic del lienzo podía quitar la selección después de pointerdown; se consume ese clic de confirmación para conservar la edición. Hubo una colisión de artefactos al ejecutar dos procesos Playwright sobre el mismo directorio; las suites finales se ejecutaron secuencialmente y pasaron.
