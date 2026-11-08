# ADR 020 — Autoría y actividad compartida del diagrama

Fecha: 2026-11-06. Estado: implementado para la etapa 1 del segundo parcial.

## Contexto

La IA futura debe conocer quién realizó cada cambio y todos los participantes deben poder consultar lo avanzado. `cambio` registra autores de propuestas, pero no cubre las creaciones y actualizaciones directas. Inferir la autoría por fechas o por contenido parecido no es fiable.

## Decisión

- Añadir `autor_id` y `autor_nombre` a `version_diagrama` mediante V8. La identidad viene de la sesión autenticada y el nombre se conserva tal como era al guardar, dentro de la misma transacción que el modelo.
- Mantener NULL para instantáneas anteriores: la interfaz informa que no se registró el autor. No atribuirlas al usuario actual ni a una IA.
- Obtener actividad mediante diferencias por UUID entre versiones consecutivas confirmadas. Ignorar revisión/fecha del cliente y orden de listas; distinguir posiciones, atributos y multiplicidades. Las propuestas pendientes o rechazadas no se presentan como trabajo aplicado.
- Exponer un endpoint de lectura con autorización del diagrama y `Cache-Control: no-store`, también para participantes CONSULTA. Sin correos, credenciales ni documentos completos en la respuesta.
- Paginar por número de versión descendente (`beforeVersion`), hasta 20 versiones por petición y 100 diferencias por versión, indicando el total. Una inserción posterior no desplaza las páginas anteriores.
- Abrir actividad desde la franja existente de colaboración, en un diálogo. No añadir otra fila de herramientas ni reducir permanentemente el lienzo.

## Consecuencias

No hace falta una segunda copia del historial ni escribir eventos duplicados. Se necesita desplegar primero el backend con la migración antes de la interfaz. Las diferencias se calculan al consultar y su coste está limitado por la página y los límites existentes del documento; si el historial/modelo crece, medir antes de añadir materialización.

Esta actividad describe versiones confirmadas, no cada pulsación, conversaciones ni intenciones. Un cambio del asistente individual se atribuye al usuario que lo aplica; la distinción solicitante/IA/aprobador se incorporará al módulo de solicitudes compartidas de la etapa siguiente. No hay reversión de versiones ni entrenamiento de modelos en este incremento.
