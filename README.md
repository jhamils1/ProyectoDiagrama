# Modela · Primer parcial de Software 1

Primera entrega: editor web de diagramas de clases con borradores locales. Permite editar clases, atributos, asociaciones y herencia, mover elementos y conservarlos en este navegador.

## Ejecutar

Requisito: Node.js 22.12 o superior compatible con Vite. Verificado con Node 22.19.0 y npm 10.9.3 en Windows. Ejecutar desde la raíz:

```powershell
npm.cmd ci
npm.cmd run dev
```

Abrir la dirección indicada por Vite, normalmente `http://127.0.0.1:5173`.

Para comprobar la aplicación compilada y su apertura offline:

```powershell
npm.cmd run build
npm.cmd run preview
```

Abrir `http://127.0.0.1:4173`, crear un diagrama y esperar la preparación del service worker. Después recargar una vez y desconectar la red. En desarrollo no se registra el service worker. Los datos están ligados al navegador, perfil y origen (incluido puerto); 5173 y 4173 conservan borradores diferentes.

## Usar el editor

1. Crear un diagrama; se puede cambiar su nombre con el lápiz del título.
2. Pulsar **Nueva clase**. Seleccionarla para cambiar nombre, abstracción y atributos.
3. Pulsar **Relación** o conectar los puntos laterales del lienzo. Elegir asociación o generalización; para herencia, el origen es la subclase.
4. Hacer clic en una relación para editarla/eliminarla. Mover las clases arrastrando o con las flechas al enfocar un nodo.
5. Los cambios confirmados se guardan automáticamente. Los borradores aparecen en la barra lateral y se recuperan al volver a abrir.

Eliminar una clase solicita confirmación e incluye atributos y relaciones. Si otra pestaña guardó primero, se rechaza la operación y se pide recargar; no hay resolución colaborativa todavía.

## Comprobar

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
npm.cmd run test:e2e
```

Las pruebas de navegador utilizan Microsoft Edge instalado, con un perfil temporal aislado. Puede elegirse Chrome mediante `$env:PW_CHANNEL = 'chrome'`. No se usan los perfiles personales. Compilar antes de probar: Playwright sirve `dist` en el puerto 4173. Evidencias y resultados se generan en `apps/web/test-results`.

## Estado y decisiones

- [Trazabilidad de CU y pruebas](docs/TRAZABILIDAD.md).
- [Evidencia de la primera etapa: 24 pruebas de dominio/persistencia y 6 de navegador](docs/EVIDENCIA_ETAPA_01.md).
- [Motores de IA local elegidos y evaluación pendiente](docs/decisiones/ADR-001-ia-local.md).
- [Diseño y límites de esta primera entrega](docs/decisiones/ADR-002-editor-local.md).
- [Revisión inicial de documentación](docs/REVISION_INICIAL.md).
- [Contexto vigente](CONTEXTO_PROYECTO.md).

CU07/CU08 tienen cobertura parcial local. Spring Boot/PostgreSQL, autenticación, proyectos compartidos, Flutter, sincronización, inferencia de IA, Enterprise Architect y generación del backend quedan para incrementos siguientes. La aplicación lo identifica como espacio local; no simula usuarios ni colaboración.

Los borradores no tienen respaldo fuera del navegador. Borrar sus datos puede eliminarlos. La revisión local no equivale al versionado central pendiente de CU12.
