# Relevo para otra cuenta de Codex

Actualizado: 21/09/2026. Proyecto Modela. Carpeta: `C:/Users/USUARIO/Desktop/PrimerParcialSW1`.

## Punto exacto de continuacion

**CU10: importacion manual en EA comprobada para la muestra Cliente/ClientePremium/Pedido.** La captura del usuario muestra atributos/tipos, asociacion 1..1 a 0..* y herencia hacia Cliente. Clases colocadas manualmente como Link: no se conservan posiciones/estilos. Evidencia y limites en docs/CU10_EXPORTACION.md. El usuario solicito solo registrar evidencia; hara el commit manualmente. Proxima ampliacion propuesta: abstractas en CU11, pendiente autorizacion para implementarla.

El usuario tiene pocos tokens: responder en espanol breve y trabajar por incrementos pequenos completos. Pidio este relevo para continuar con otra cuenta. No necesita rehacer el proyecto ni depender del chat anterior.

## Leer primero

1. Este archivo y el bloque vigente al inicio de CONTEXTO_PROYECTO.md.
2. docs/CU10_EXPORTACION.md para la tarea inmediata.
3. Segun la tarea: docs/INTEROPERABILIDAD_01.md, docs/CU11_GENERADOR.md, docs/PRUEBA_PRESENTACION_IA.md y docs/TRAZABILIDAD.md.
4. README.md para ejecucion. Primer Parcial Documentacion.docx conserva los requisitos academicos; no modificarlo durante tareas ajenas.

Los documentos de etapas antiguas describen historia. NO retomar el antiguo fallo de carga de Qwen3-1.7B ni asumir que importacion, generacion o IA siguen pendientes por leer parrafos anteriores.

## Estado implementado

- Editor UML: clases, atributos, abstraccion, asociaciones y generalizacion. Inspector aplica por Enter/blur, Suprimir elimina con confirmacion, nuevas clases centradas, mejoras de lienzo y paneles. Metodos UML no implementados.
- Herramienta web: usuarios, administrador, proyectos, permisos CONSULTA/EDICION, diagramas/versiones, colaboracion, presencia, propuestas y conflictos. IndexedDB/PWA y sincronizacion offline; conservar migraciones y pendientes. Correcciones de conflictos espurios en docs/CORRECCION_SINCRONIZACION_EDICION.md.
- IA local de texto integrada para edicion UML limitada con validacion y confirmacion. Qwen3-1.7B funciona en el flujo actual. Guia de demostracion: docs/PRUEBA_PRESENTACION_IA.md. No es generador general de sistemas; las metricas antiguas del laboratorio no describen todo el estado actual.
- CU09: importar EA UML 2.5/XMI 2.5.1, previsualizar y confirmar nuevo diagrama. Real->Double y omision de relaciones vacias se proponen automaticamente y se explican; opciones avanzadas permiten cambiarlas. Otras ambiguedades requieren decision. Compatibilidad limitada al subconjunto probado.
- CU11: ZIP Maven Spring Boot/Java21/PostgreSQL, entidades, repositorios, DTOs, servicios y REST CRUD. Asociaciones 1 a 0..*, herencia simple JOINED entre clases concretas, cadenas y varias hijas. ID Long explicito solo en raiz, heredado. No abstractas, metodos ni logica de negocio; otras multiplicidades pendientes.
- CU10: XML semantico descargable con clases, abstraccion, tipos, visibilidad, isID, obligatoriedad, asociaciones y herencia. Importacion real de la muestra comprobada; no implica compatibilidad universal.

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

- Ultima suite backend: 109 pruebas sin fallos, Maven BUILD SUCCESS, .qa/cu10-api-tests.log.
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
2. CU11: abstractas, mas multiplicidades/tipos segun prioridad.
3. Voz local, asistencia contextual CU16, Flutter diagramador y Flutter consumidor del backend (son alcances distintos).
4. Google con cuenta real, despliegue AWS HTTPS/WSS, manual/tutoriales y Word con evidencias.
5. CU15 imagen: AL FINAL, solo tras consultar y obtener autorizacion explicita.

No sustituir IA local por remota sin acuerdo. No reset/clean, no borrar datos ni reemplazar carpeta por clon antiguo. Word no se modifico en estas etapas. Este relevo se actualizo ahora por solicitud explicita; antes se habia pedido no tocarlo sin indicacion.

## Git y cambio de cuenta

Ultimo commit observado: 7a4e82f feat: importar diagramas EA y generar backend CRUD con herencia JPA. CU10 y este relevo tienen cambios locales SIN COMMIT al escribir este documento. Revisar git status. No hubo commit/push por el asistente. Remoto conocido https://github.com/jhamils1/ProyectoDiagrama.git; verificar antes de publicar.

Misma PC: abrir esta MISMA carpeta con nueva cuenta; no hace falta clonar. Git no traslada .local, .tools, .qa, base de datos ni IndexedDB. Cambiar de PC requiere respaldos privados adicionales: publicar codigo no basta.

Mensaje para pegar en nueva cuenta:

> Continua Modela en esta carpeta. Lee CONTINUAR_AQUI.md y el estado vigente de CONTEXTO_PROYECTO.md; despues docs/CU10_EXPORTACION.md. CU09 y CU11 con herencia ya funcionan. CU10 tiene generador, descarga y prueba manual en EA para la muestra; lee la evidencia y acuerda el siguiente incremento. No rehagas lo terminado ni implementes CU15. Tengo pocos tokens: trabaja por incrementos pequenos y completos. Conserva datos, secretos y cambios locales.

La nueva cuenta sigue sus propias instrucciones/permisos; este archivo aporta contexto, no credenciales ni acceso automatico.
