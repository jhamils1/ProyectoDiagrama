# Aplicación móvil Flutter

`apps/flutter_consumer` evolucionó de consumidor CRUD a aplicación móvil de Modela. Conserva la pestaña **CRUD** para probar un backend generado y añade la pestaña **Diagramas** para editar modelos UML desde Android.

## Editor UML local

- Crear, renombrar y eliminar clases.
- Marcar clases abstractas.
- Crear, editar y eliminar atributos con tipo, visibilidad, identificador y obligatoriedad.
- Crear asociaciones y herencias con multiplicidades.
- Crear asociaciones muchos a muchos con una clase intermedia: permite elegir una clase existente o crea/reutiliza `Detalle`, que se sincroniza como `associationClassId` y se muestra punteada en la web y en Enterprise Architect al exportar.
- Validar nombres, identificadores y extremos de relaciones antes de sincronizar.
- Guardar cada cambio inmediatamente en el almacenamiento local del teléfono mediante `SharedPreferences`.

El editor abre desde el almacenamiento local, por lo que sigue disponible sin red. Los cambios que aún no llegaron al servidor se muestran como pendientes.

## Sincronización

1. Al abrir la aplicación, iniciar sesión con una cuenta administradora y la URL de Modela, por ejemplo `http://IP_DE_LA_PC:8080` en un teléfono físico.
2. Abrir **Diagramas** y tocar el icono de sincronización.
3. Elegir un proyecto y crear el diagrama local en ese proyecto, o descargar uno existente.

Después de iniciar sesión, las ediciones se guardan primero en el teléfono y se intenta sincronizarlas automáticamente durante esa sesión. Si vuelve la red, la aplicación abierta reintenta los cambios pendientes cada 15 segundos; el botón de sincronización también permite hacerlo manualmente sin volver a pedir correo ni contraseña. La contraseña nunca se guarda: solo la sesión del servidor se conserva protegida en Android para reutilizarla al volver a abrir la app. Si el servidor se reinicia, vence la sesión o la rechaza, la aplicación pedirá iniciar sesión otra vez. Un conflicto de revisión se mantiene pendiente y debe resolverse desde el editor web; la aplicación no sobrescribe cambios remotos.

## Asistencia y voz locales

El panel **Asistente local** observa los cambios del diagrama en el propio teléfono y actualiza sus sugerencias sobre clases, atributos, identificadores y relaciones, sin enviar el diagrama a un servicio externo ni crear telemetría. El botón de micrófono activa el reconocedor de Android con preferencia offline. Reconoce estos comandos locales:

- `Crea la clase de Factura`
- `Agrega marca a Vehiculo` — usa `String` si no se indica un tipo.
- `Agrega nombre de tipo String en la clase Persona`
- `Elimina la clase Vehiculo` — también elimina sus relaciones.
- `Relaciona Cliente con Pedido`
- `Elimina el atributo precio de Producto`
- `Renombra Vehiculo a Automovil`
- `Automovil hereda de Vehiculo`
- `Crear una asociación entre Cliente y Pedido, donde un Cliente puede tener muchos Pedidos y cada Pedido pertenece a un solo Cliente` — crea `Cliente 1 — 0..* Pedido`.

Los nombres de clases y atributos deben ser una sola palabra válida de UML. Los tipos admitidos son `String`, `Integer`, `Long`, `Decimal`, `Float`, `Double`, `Boolean`, `Date`, `DateTime` y `UUID`; se aceptan variantes como `texto`, `entero`, `booleano` y `fecha`.

Android debe tener instalado el reconocimiento de voz en español sin conexión. En Android 12 o posterior la aplicación solicita explícitamente el reconocedor local del sistema; si el fabricante no lo expone, informa esa condición sin perder el diagrama. La primera vez solicitará permiso de micrófono. El reconocedor usa la variante exacta de español configurada en el teléfono, por ejemplo `es-BO` para Español (Bolivia).

La asistencia actual es determinista y local: ofrece orientación contextual y ejecuta los dos comandos documentados. No incorpora un modelo generativo ni manda voz o diagramas a una API de IA.

## Prueba manual en un teléfono

1. Conecta el teléfono y la PC a la misma red Wi-Fi. Arranca Modela en la PC en el puerto `8080` y usa su IP local en la aplicación, por ejemplo `http://192.168.0.20:8080`; no uses `127.0.0.1` en el teléfono.
2. Instala el APK, abre **Diagramas**, crea una clase y un atributo identificador. Debe aparecer el aviso de cambios pendientes.
3. Toca sincronizar, inicia sesión, elige un proyecto y pulsa **Crear en el proyecto**. La marca pendiente debe desaparecer.
4. Desactiva Wi-Fi y datos móviles. Agrega otra clase o relación, cierra completamente la aplicación y ábrela de nuevo. El cambio debe seguir visible y marcarse como pendiente.
5. Reactiva la red. Con la sesión vigente, espera hasta 15 segundos o toca sincronizar: no pedirá acceso nuevamente, incluso si cerraste y abriste la app. Si el servidor pide acceso, inicia sesión otra vez. Abre el mismo proyecto en el editor web y comprueba que el cambio llegó al diagrama.
6. Opcionalmente, concede el permiso de micrófono y dicta `crear clase Producto`. Si Android no tiene español offline instalado, la aplicación debe mostrar el error sin perder el diagrama.

Registrar una captura del teléfono para los pasos 3 y 5 constituye la evidencia manual. No se debe registrar ni copiar la contraseña en las capturas.

## Evidencia manual ejecutada

El 21/09/2026 se validó el flujo en un teléfono Android conectado a la misma red local que la PC: se creó y sincronizó el diagrama **Diagrama móvil**, se agregó `pedido` con identificador `id : Long`, se editó desde el teléfono y el editor web recibió el aviso de una revisión más reciente. Tras pulsar **Recargar diagrama**, la web mostró el cambio enviado desde el celular. Esto comprueba persistencia local, envío posterior y actualización del diagrama central.

En el mismo teléfono se descargó Español (Bolivia) para reconocimiento sin conexión y se validó el comando de voz `crear clase Factura`: el editor creó la clase localmente. Esto comprueba la interacción por voz sin depender de una API remota.

## Pruebas

```powershell
cd apps/flutter_consumer
& "C:\Users\USUARIO\develop\flutter\bin\flutter.bat" analyze
& "C:\Users\USUARIO\develop\flutter\bin\flutter.bat" test --no-pub --reporter expanded
& "C:\Users\USUARIO\develop\flutter\bin\flutter.bat" build apk --debug
```

En esta PC también se puede ejecutar desde la raíz `PrimerParcialSW1` con comandos cortos:

```powershell
.\flutter-mobile.cmd          # instalar y abrir en el teléfono
.\flutter-mobile.cmd analyze  # analizar
.\flutter-mobile.cmd test     # pruebas
.\flutter-mobile.cmd apk      # generar APK debug
```

El APK queda en `apps/flutter_consumer/build/app/outputs/flutter-apk/app-debug.apk`.

La suite cubre el contrato CRUD generado, el modelo UML local y el flujo de sesión/CSRF/sincronización frente a un servidor HTTP simulado. La compilación Android verifica además el canal nativo del micrófono.
