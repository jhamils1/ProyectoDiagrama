# Relevo para otra cuenta de Codex

Actualizado: 21/09/2026. Proyecto Modela. Carpeta: `C:/Users/USUARIO/Desktop/PrimerParcialSW1`.

## Punto exacto de continuacion

**CU11: herencia, clases abstractas y uno a uno inicial terminados.** La descarga genera entidades JPA JOINED; una raíz abstracta no tiene CRUD propio y su hija concreta sí. Además de `1 — 0..*`, se admite `1 — 0..1`: genera `@OneToOne` único y obligatorio en el extremo `0..1`, con referencia inversa opcional en el extremo `1`. No se admiten todavía `1 — 1`, `0..1 — 0..*` ni muchos a muchos. CU10 conserva la importación manual en EA comprobada para Cliente/ClientePremium/Pedido, sin posiciones/estilos.

Flutter móvil: `apps/flutter_consumer` reúne dos pestañas. **CRUD** consume de forma genérica un backend generado con URL, recurso plural y JSON configurables; lista, busca, crea, actualiza y elimina. **Diagramas** permite crear clases, atributos, asociaciones y herencias; guarda primero en el teléfono, sincroniza con Modela durante una sesión iniciada y mantiene los cambios pendientes sin red. Incluye guía contextual local y comandos de voz para crear, renombrar o eliminar clases, agregar o quitar atributos, asociar clases e indicar herencia mediante el reconocedor offline de Android. No contiene un LLM ni guarda contraseña. Ver `docs/FLUTTER_MOVIL.md`.

Evidencia manual del incremento móvil: en Android se creó y sincronizó **Diagrama móvil**, se agregó `pedido` con `id : Long` y el editor web detectó la revisión nueva; después de **Recargar diagrama**, mostró el cambio enviado por el teléfono. Con Español (Bolivia) sin conexión descargado, el comando de voz `crear clase Factura` creó la clase localmente. El recorrido y el alcance están en `docs/FLUTTER_MOVIL.md`.

Evidencia manual adicional: un teléfono Android consultó `pedidos` desde la aplicación Flutter contra un backend generado que corría en la PC por la IP LAN y puerto 8081; la respuesta `[]` confirmó la conexión real. El ZIP usado tenía `Cliente` y `ClientePremium` abstractas, por lo que solo exponía `/pedidos`.

Prueba posterior uno a uno: un ZIP con `Cliente` y `Pedido` concretos, relación `1 — 0..1`, se ejecutó en PostgreSQL. Desde Android se creó Cliente 1 y Pedido 1 relacionado; la consulta del cliente devolvió la referencia inversa al Pedido 1.

El usuario tiene pocos tokens: responder en espanol breve y trabajar por incrementos pequenos completos. Pidio este relevo para continuar con otra cuenta. No necesita rehacer el proyecto ni depender del chat anterior.

## Leer primero

1. Este archivo y el bloque vigente al inicio de CONTEXTO_PROYECTO.md.
2. docs/CU10_EXPORTACION.md para la tarea inmediata.
3. Segun la tarea: docs/INTEROPERABILIDAD_01.md, docs/CU11_GENERADOR.md, docs/PRUEBA_PRESENTACION_IA.md y docs/TRAZABILIDAD.md.
4. README.md para ejecucion. Primer Parcial Documentacion.docx conserva los requisitos academicos; no modificarlo durante tareas ajenas.

Los documentos de etapas antiguas describen historia. NO retomar el antiguo fallo de carga de Qwen3-1.7B ni asumir que importacion, generacion o IA siguen pendientes por leer parrafos anteriores.

## Estado implementado

- Editor UML: clases, atributos, abstraccion, asociaciones y generalizacion. El diálogo de asociación ofrece los preajustes Uno a muchos (1 — 0..*) y Uno a uno (1 — 0..1); Personalizada conserva la edición UML libre. Inspector aplica por Enter/blur, Suprimir elimina con confirmacion, nuevas clases centradas, mejoras de lienzo y paneles. Metodos UML no implementados.
- Herramienta web: usuarios, administrador, proyectos, permisos CONSULTA/EDICION, diagramas/versiones, colaboracion, presencia, propuestas y conflictos. IndexedDB/PWA y sincronizacion offline; conservar migraciones y pendientes. Correcciones de conflictos espurios en docs/CORRECCION_SINCRONIZACION_EDICION.md.
- IA local de texto integrada para edicion UML limitada con validacion y confirmacion. Qwen3-1.7B funciona en el flujo actual. Guia de demostracion: docs/PRUEBA_PRESENTACION_IA.md. No es generador general de sistemas; las metricas antiguas del laboratorio no describen todo el estado actual.
- CU09: importar EA UML 2.5/XMI 2.5.1, previsualizar y confirmar nuevo diagrama. Real->Double y omision de relaciones vacias se proponen automaticamente y se explican; opciones avanzadas permiten cambiarlas. Otras ambiguedades requieren decision. Compatibilidad limitada al subconjunto probado.
- CU11: ZIP Maven Spring Boot/Java21/PostgreSQL, entidades, repositorios, DTOs, servicios y REST CRUD. Asociaciones 1 a 0..* y 1 a 0..1; la segunda usa OneToOne único, referencia inversa opcional y escritura desde el extremo 0..1. Herencia JOINED, cadenas, varias hijas y raíces abstractas sin endpoint propio. ID Long explícito solo en raíz, heredado. Métodos y lógica de negocio no implementados; las demás multiplicidades quedan pendientes.
- CU10: XML semantico descargable con clases, abstraccion, tipos, visibilidad, isID, obligatoriedad, asociaciones y herencia. Importacion real de la muestra comprobada; no implica compatibilidad universal.

- Flutter móvil: `apps/flutter_consumer` contiene el editor UML local y el consumidor CRUD genérico. El editor persiste en SharedPreferences, permite clases, atributos, asociaciones y herencia, y sincroniza manual o automáticamente durante una sesión con Modela. La asistencia contextual y la voz se ejecutan localmente; la voz depende del reconocimiento offline instalado en Android. No hay LLM local ni resolución móvil de conflictos todavía.

## Codigo y contratos importantes

API: apps/api/src/main/java/bo/edu/modela/.

- interoperability/EaXmiReader, EaXmiConverter, XmiPreviewController: importacion. Maximo 2 MiB, sin DTD/entidades externas. Mantener protecciones. Muestra original pruebaA.xml y fixture apps/api/src/test/resources/interoperability/ea-sample.xml; no alterar el original.
- interoperability/EaXmiWriter, XmiExportController: GET /api/projects/{project}/diagrams/{id}/xmi?revision=N. XML no-store, ADMINISTRACION/EDICION; revision distinta 409. Instantanea persistida autorizada; no crea versiones ni cambia el diagrama.
- generation/GenerationValidator, InheritancePlan, BackendGenerator, GenerationController: GET mismo prefijo terminado en /backend?revision=N. ZIP o 422 con incidencias. Mismos permisos.
- DiagramDocument y DiagramService: reutilizar validacion, permisos, revisiones y persistencia. No inventar atributos ni clases. Persistencia/IA/importacion comparten el modelo.

Frontend: apps/web/src/features/interoperability/ImportXmiDialog.tsx; features/generation/GenerateBackendButton.tsx reutilizado con format="xmi"; App.tsx; shared/api.ts. Descargas bloqueadas con campos abiertos, cambios pendientes, guardados, desconexion o permiso insuficiente.

CU11: ID suministrado por cliente, no autogenerado; campos tecnicos de relaciones basados en UUID. DTOs usan IDs de referencias. Padre consulta descendientes con DTO del padre; PUT del padre conserva campos exclusivos de hija. DELETE no borra asociaciones en cascada. Backend generado puerto 8081; Modela usa 8080.

En diagrama manual del usuario, ClientePremium tenia id duplicado y lo renombro a codigo. Si conserva codigo, debe desmarcar Identificador: ya hereda id de Cliente. Si se llama id, eliminar el atributo propio de hija. No editar su diagrama automaticamente.

## Evidencias y pruebas

- Última suite backend: 112 pruebas sin fallos, Maven BUILD SUCCESS tras añadir uno a uno.
- Build web completo con PWA generado: .qa/cu10-web-build.log. Advertencias de tamano y tiempos de bundle. PowerShell puede mostrar NativeCommandError/exit 1 por stderr de advertencias aunque la herramienta termine bien: inspeccionar resultado real.
- 4 E2E aprobadas en apps/web/e2e/generation.spec.ts: ZIP/XML, conflicto y bloqueos por edicion/permisos. Respuestas controladas; API comprobada aparte.
- 18 pruebas de interoperabilidad (lector/conversor/escritor).
- Backend generado con PostgreSQL: 62 solicitudes con herencia y 29 sin herencia; compila, empaqueta y arranca. Evidencia docs/evidencias/cu11-herencia-postgresql.json y cu11-crud-postgresql.json.
- CU09: prueba real de archivo, persistencia y recuperacion en docs/INTEROPERABILIDAD_01.md. Exportacion real hacia EA comprobada para la muestra, ver docs/CU10_EXPORTACION.md.

Comandos desde raiz; ejecutar solo lo pertinente, no repetir todo al leer el relevo:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/backend.ps1 test
npm.cmd run build
npm.cmd run test:e2e --workspace web -- generation.spec.ts
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-generated-backend.ps1 -Inheritance -Port 18082
```

El ultimo script usa esquema aleatorio en modela_test y limpia solo su proceso/esquema. Sin -Inheritance prueba Cliente/Pedido. No apuntar pruebas destructivas a datos reales.

## Entorno y arranque

Windows PowerShell; usar npm.cmd. Java21/Maven en .tools. PostgreSQL del proyecto en .local/postgres, puerto 55432; bases modela y modela_test. No tocar PostgreSQL ajeno 5432 ni backend descargado por usuario 8081.

.local/backend.json contiene secretos: nunca copiarlos al chat, documentos, logs ni Git. Cambiar contrasena bootstrap no modifica cuentas ya creadas.

```powershell
# Solo si PostgreSQL local esta apagado; conservar datos:
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup-backend.ps1
# Una terminal:
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/backend.ps1 run
# Otra terminal (compilar primero si cambia frontend):
npm.cmd run preview --workspace web -- --host 127.0.0.1 --port 4173 --strictPort
```

Ultima comprobacion: http://127.0.0.1:4173/api/auth/csrf respondio 200. API8080 y preview4173 iniciados ocultos; logs .qa/backend-cu10-run.log y .qa/web-active-run.log. Comprobar ambos al cambiar de cuenta: la PWA muestra login cacheado aunque preview este apagado y entonces no conecta, incluso con API activa. Reiniciar API invalida sesiones: volver a ingresar. Procesos de fondo Windows: Start-Process -WindowStyle Hidden con logs; verificar propietario antes de detener un puerto.

Sesiones en memoria, cookie HttpOnly y CSRF. No cachear /api. No borrar IndexedDB ni el perfil del navegador: alli hay copias/pendientes privados por cuenta. Colaboracion/presencia pensadas para una instancia; no asumir escalado multiinstancia resuelto.

## Pendientes posteriores

1. CU10: muestra verificada en EA; ampliar cobertura o distribucion visual solo si se solicita.
2. CU11: más multiplicidades/tipos según prioridad; uno a uno inicial y abstractas ya están terminados.
3. Ampliar los comandos de voz y, solo si se solicita, integrar un modelo local real para asistencia generativa. El editor Flutter, su persistencia local y la sincronización básica ya están implementados.
4. Google con cuenta real, despliegue AWS HTTPS/WSS, manual/tutoriales y Word con evidencias.
5. CU15 imagen: AL FINAL, solo tras consultar y obtener autorizacion explicita.

No sustituir IA local por remota sin acuerdo. No reset/clean, no borrar datos ni reemplazar carpeta por clon antiguo. Word no se modifico en estas etapas. Este relevo se actualizo ahora por solicitud explicita; antes se habia pedido no tocarlo sin indicacion.

## Git y cambio de cuenta

Último commit observado antes de este incremento: `07cb521`. La relación uno a uno y esta actualización documental tienen cambios locales sin commit. Revisar `git status`. El usuario realiza commit/push manualmente. Remoto conocido https://github.com/jhamils1/ProyectoDiagrama.git; verificar antes de publicar.

Misma PC: abrir esta MISMA carpeta con nueva cuenta; no hace falta clonar. Git no traslada .local, .tools, .qa, base de datos ni IndexedDB. Cambiar de PC requiere respaldos privados adicionales: publicar codigo no basta.

Mensaje para pegar en nueva cuenta:

> Continúa Modela en esta carpeta. Lee CONTINUAR_AQUI.md y el estado vigente de CONTEXTO_PROYECTO.md; después docs/CU11_GENERADOR.md. CU09/CU10 y CU11 con herencia, abstractas y asociaciones 1 a 0..1 ya funcionan. No rehagas lo terminado ni implementes CU15. Tengo pocos tokens: trabaja por incrementos pequeños y completos. Conserva datos, secretos y cambios locales.

La nueva cuenta sigue sus propias instrucciones/permisos; este archivo aporta contexto, no credenciales ni acceso automatico.
