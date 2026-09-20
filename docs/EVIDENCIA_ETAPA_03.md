# Evidencia de la tercera etapa

Fecha: 20/09/2026. Alcance autorizado: diagramas dentro de proyectos con persistencia central, permisos y copia de borradores locales. Decisiones previas en [ADR 004](decisiones/ADR-004-diagramas-centrales.md); contrato en [API etapa 3](API_ETAPA_03.md).

## Resultados

- **38 pruebas backend aprobadas:** 27 de la etapa anterior y 11 nuevas en `DiagramIntegrationTest`. PostgreSQL 17.6 real en `modela_test`; peticiones nuevas con transacciones independientes y commits reales.
- **25 pruebas frontend aprobadas:** 24 anteriores y una que comprueba la copia de identidades, remapeo de extremos y conservación del original.
- **11 pruebas de navegador aprobadas:** 6 del editor local, 2 de acceso/proyectos y 3 nuevas de diagramas con API real. Se repitió la suite de diagramas tras el ajuste final de lectura/controles.
- Compilación TypeScript/PWA y lint correctos. Persiste el aviso no bloqueante del bundle principal mayor de 500 kB.
- V2 aplicada en `modela_test` y `modela`; validación JPA correcta. Reinicio del backend con datos conservados y sin reconstruir V1.

## Escenarios nuevos comprobados

| Prueba | Evidencia |
| --- | --- |
| Crear, guardar y recuperar modelo | Clases, atributos, relación y posiciones recuperadas mediante API; apertura en un contexto de navegador sin IndexedDB, usando la cookie autenticada |
| Instantáneas | Versión inicial preservada tras renombrar/guardar, número de versiones correcto y estado actual en tablas explícitas |
| CONSULTA y EDICION | Lector puede listar/abrir pero recibe 403 al crear, editar o eliminar; editor autorizado puede guardar; revocación inmediata probada |
| Alcance de proyecto | Diagrama bajo otro ID de proyecto rechazado; proyectos eliminados no permiten consulta/escritura |
| Concurrencia | Dos peticiones concurrentes para una revisión producen exactamente un 200 y un 409; prueba de dos pestañas conserva el cambio primero |
| Fallo de red | La propuesta permanece en el formulario; el servidor conserva el valor previo; reintento online correcto |
| Idempotencia de creación | Mismo ID/contenido inicial no crea otra fila; contenido diferente responde conflicto |
| Validación y rollback | Extremos inválidos, esquema incorrecto, nombres duplicados, posición fuera de límites, identificador no obligatorio y ciclos de herencia rechazados; no generan instantáneas |
| Aislamiento de identidades | Intentar reutilizar una clase de otro diagrama produce conflicto y revierte toda la creación |
| Eliminación lógica | Desaparece del listado y devuelve 404; historial preservado |
| Copia desde local | UUID diferentes, extremos remapeados, mismo contenido y borrador original aún disponible |

Las pruebas de permisos del backend inyectan una identidad autenticada controlada mediante Spring Security Test; las reglas de autorización, servicios, transacciones y PostgreSQL son reales. Las E2E nuevas acceden como Administrador con las credenciales locales; no acreditan Google real.

Se corrigió una diferencia entre el nombre de las columnas de posiciones esperado por Hibernate y la migración. También se bloquearon campos durante el guardado para evitar escribir en el formulario anterior mientras llegaba una clase recién creada. El modelo del servidor y la revisión se leen en una única instantánea de base de datos.

## Reproducir

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/backend.ps1 test
npm.cmd test
npm.cmd run lint
npm.cmd run build
# Con backend iniciado en otra terminal:
$env:MODELA_E2E_REAL = '1'
npm.cmd run test:e2e
Remove-Item Env:MODELA_E2E_REAL
```

Informes: `apps/api/target/surefire-reports`, `apps/web/test-results/results.json`. Copias locales en `.qa/etapa-03`; capturas del editor de proyecto y listado. Los registros E2E usan nombres únicos y cierran lógicamente el proyecto en `afterEach`, también si falla el escenario. Herramientas, credenciales y evidencias generadas no se versionan.

## Límites

Este incremento conecta **frontend web y backend**. No implementa Flutter, WebSocket, sincronización offline de proyectos, Cambio/Conflicto, IA, EA, generación ni despliegue AWS. Las instantáneas aún no tienen pantalla de consulta/restauración. No se midió rendimiento con carga; el bloqueo por proyecto es deliberadamente simple. Las pruebas en ventana estrecha no sustituyen pruebas en POCO.

Los borradores locales siguen siendo anónimos y separados. Copiar crea un modelo independiente, no una sincronización entre copias. El documento Word se conservó y queda pendiente incorporar decisiones/evidencia en la entrega académica.
