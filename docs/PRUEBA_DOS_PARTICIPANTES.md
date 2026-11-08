# Prueba del asistente con dos participantes

Esta guía queda preparada para realizarla con dos personas y dos cuentas autorizadas. **Todavía no se ha realizado la prueba con dos personas reales.** Usa un proyecto de prueba, sin datos importantes.

## Antes de empezar

1. Los cambios de conversación y revisión deben estar desplegados en el frontend y en el backend que van a probar. Al 6 de noviembre de 2026, los cambios recientes están solo en el proyecto local; la dirección de AWS puede mostrar una versión anterior.
2. Para probar desde dos lugares distintos, ambos necesitan acceder a la misma instancia publicada de Modela y al mismo proyecto. `127.0.0.1` o `localhost` en la laptop de tu compañero apunta a su propia computadora, no a la tuya. Publicar en AWS es un paso separado de esta guía.
3. Cada persona inicia sesión con su propia cuenta; ambas deben pertenecer al mismo proyecto de prueba y tener permiso de **edición**. No compartan contraseñas.
4. Para la parte que usa Qwen, al menos un navegador debe poder ejecutarlo y tener preparados sus recursos, aproximadamente 1,46 GB. Para probar que el segundo navegador toma el relevo, también necesita tenerlos preparados y poder ejecutar el modelo. La preparación puede requerir descarga y generar consumo de datos. Una respuesta identificada como «Asistente · datos del diagrama», «conceptos UML» o «actividad registrada» no demuestra inferencia de Qwen.

## 1. Preguntas, respuestas y cambios compartidos

### Preparar Qwen desde la computadora que responderá

En la primera consulta que requiera Qwen, selecciona **Usar archivos de mi PC** y elige la carpeta `apps/web/public/ai` del proyecto. El navegador comprueba los archivos y los guarda para esa dirección web; no los sube al servidor. La preparación y la carga pueden tardar y requieren espacio y memoria disponibles. Mantén abierto el navegador de esa computadora para atender las preguntas del equipo. La otra persona necesita acceso al proyecto, pero no necesita los archivos mientras esta computadora atienda sus consultas. Si se cierra o se desconecta, deberá esperar a que vuelva o utilizar otro equipo preparado. La selección de carpeta y la inferencia en la dirección publicada deben comprobarse en la prueba real.

La opción de descarga del servidor queda disponible para un despliegue futuro que publique el modelo; no implica que esos archivos estén publicados actualmente.

1. Ambos abren el mismo diagrama y el panel **Asistente IA compartido**. Comprueben sus nombres en la lista de participantes cuando la conexión esté activa.
2. La primera persona pide `crea clase Factura`. Comprueben que Factura aparece para ambas personas y que el historial muestra la instrucción y el resultado. Si ya existe, usen un nombre nuevo.
3. La segunda persona pregunta `¿Cuáles son las clases del diagrama?`. Comprueben que las dos personas ven la pregunta y la misma respuesta, incluida la clase recién guardada.
4. Pidan `Revisa el diagrama`. Comprueben que los resultados se basan en lo que figura en el diagrama y se presentan como sugerencias. Esta revisión es básica y no modifica el diagrama.
5. Pregunten `¿Qué hizo [nombre del compañero]?` usando un nombre que identifique claramente al participante. Comparen la respuesta con **Actividad del diagrama**. Si no hay información o hay nombres ambiguos, el asistente debe indicarlo en vez de inventar una autoría.

## 2. Trabajo al mismo tiempo y continuidad

1. Desde las dos cuentas, hagan cambios diferentes casi al mismo tiempo en el proyecto de prueba. Esperen a que terminen de guardarse y observen si ambos los reciben.
2. Si aparece un conflicto, revísenlo y resuélvanlo con la interfaz: no supongan que ambos cambios se guardaron hasta comprobar el resultado. Las pruebas automáticas confirman que dos escrituras sobre la misma revisión no se sobrescriben silenciosamente.
3. Ambos recargan la página o cierran sesión y vuelven a entrar. Verifiquen que el diagrama y la conversación muestran lo que realmente quedó guardado.

## 3. Desconexión de quien ejecuta Qwen

Esta prueba requiere Qwen preparado y compatible en **ambos** navegadores. Si el segundo no lo tiene preparado, no puede tomar el relevo hasta prepararlo o hasta que otro participante con Qwen disponible lo atienda.

1. Con ambos participantes conectados, hagan una pregunta abierta que requiera Qwen, por ejemplo: `Explícame brevemente para qué podría servir este modelo`. Comprueben los estados del asistente para identificar qué navegador está procesando. Las respuestas verificadas del servidor no sirven para esta prueba.
2. Mientras aparezca que se está procesando, desconecten o cierren el navegador que está ejecutando la IA. Puede que la pregunta termine antes de que logren desconectarlo; si ocurre, repitan con otra pregunta.
3. Esperen en el otro navegador. La aplicación intenta liberar la consulta al detenerse; ante una desconexión inesperada, la reserva vence aproximadamente **tres minutos** después de que se reclamó. La detección y la generación añaden tiempo; entonces el otro navegador preparado puede reclamarla y generar la respuesta.
4. Confirmen que aparece **una sola respuesta** y que, al volver a entrar desde la primera cuenta, se ven la pregunta y la respuesta. Si no se recupera, anoten la hora, el estado mostrado y el texto del error, sin compartir credenciales.

## Resultado a registrar

Anoten fecha, entorno y versión desplegada; resultado de cada paso; nombres de los navegadores y dispositivos; tiempo de recuperación; y cualquier problema observado. Si desean capturas, eviten mostrar datos personales o contraseñas. Una ejecución exitosa confirma este recorrido concreto, no que Qwen responda correctamente todas las preguntas.
