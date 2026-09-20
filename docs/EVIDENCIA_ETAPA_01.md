# Evidencia de la primera etapa

Verificación final: 20 de septiembre de 2026, aproximadamente 00:03, America/La_Paz.

## Entorno

Windows, Node.js 22.19.0, npm 10.9.3, dependencias fijadas en `package-lock.json`. Playwright 1.63.0 utiliza Microsoft Edge instalado, en modo headless y con perfil temporal aislado. No se probó Flutter ni el teléfono POCO X7 Pro.

## Resultados ejecutados

| Comando desde la raíz | Resultado |
| --- | --- |
| `npm.cmd test` | 24 pruebas aprobadas en 2 archivos: dominio UML y persistencia mediante API IndexedDB con fake-indexeddb. |
| `npm.cmd run lint` | Sin errores ni advertencias de lint. |
| `npm.cmd run build` | TypeScript y Vite correctos; service worker generado con 7 recursos precacheados. |
| `npm.cmd run test:e2e` | 6 pruebas aprobadas, 0 fallos, 0 omitidas, 0 flaky; 14,8 segundos de ejecución reportada. |

La compilación advierte que el paquete JavaScript principal supera 500 kB sin comprimir (aproximadamente 525 kB; 163 kB gzip). No impidió compilar ni superar las pruebas; queda como mejora de carga dividir el editor antes de integrar runtimes de IA. No se ha realizado un ensayo de rendimiento del producto.

## Escenarios de navegador

1. Crear/renombrar un borrador, crear clases y atributos, conectar una asociación, mover una clase, preparar el service worker, desactivar la red y recargar. Se compara el documento recuperado con el guardado; se agrega otra clase sin conexión y se vuelve a recargar.
2. Intentar un nombre de clase duplicado. El error aparece y el documento almacenado permanece idéntico.
3. Cancelar y después confirmar la eliminación de una clase relacionada; tras recargar permanece la clase restante y no quedan relaciones huérfanas.
4. Abrir dos pestañas con la misma revisión. La segunda escritura desactualizada se rechaza y no reemplaza la primera.
5. Editar en una ventana de 390 × 844 sin desbordamiento horizontal; inspector visible con desplazamiento interno.
6. Mover una clase con flechas de teclado y comprobar que la posición persiste tras recargar.

El escenario principal también verifica ausencia de errores JavaScript de página. Se inspeccionaron las capturas del editor a 1440 × 900 y 390 × 844. Durante el desarrollo se detectó y corrigió la pérdida de medidas de React Flow al actualizar nodos; los casos de relación y movimiento verifican ese recorrido en la versión final.

Informe reproducible generado por Playwright: `apps/web/test-results/results.json`. Capturas y trazas se guardan bajo `apps/web/test-results`; son artefactos locales ignorados por Git y se regeneran al ejecutar las pruebas.

## Alcance de la evidencia

Esta evidencia acredita una parte local web de CU07/CU08 y de RT02. No acredita autenticación, permisos, proyectos centrales, historial, sincronización CU12, IA, interoperabilidad con Enterprise Architect, generación Spring Boot ni ejecución móvil. La prevención de sobrescritura entre pestañas no conserva propuestas como Conflicto ni implementa resolución colaborativa.
