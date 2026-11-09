-- Existing open-model answers have no reliable link to their original question.
ALTER TABLE mensaje_diagrama ADD COLUMN alcance_respuesta VARCHAR(20)
  CHECK (alcance_respuesta IN ('DIAGRAMA', 'ACTIVIDAD', 'CONCEPTO', 'DESCONOCIDO'));
ALTER TABLE solicitud_ia_diagrama ADD COLUMN alcance_respuesta VARCHAR(20) NOT NULL DEFAULT 'DESCONOCIDO'
  CHECK (alcance_respuesta IN ('DIAGRAMA', 'ACTIVIDAD', 'CONCEPTO', 'DESCONOCIDO'));
UPDATE mensaje_diagrama SET alcance_respuesta = CASE autor_nombre
  WHEN 'Asistente · datos del diagrama' THEN 'DIAGRAMA'
  WHEN 'Asistente · actividad registrada' THEN 'ACTIVIDAD'
  WHEN 'Asistente · conceptos UML' THEN 'CONCEPTO'
  ELSE 'DESCONOCIDO' END
WHERE tipo = 'ASISTENTE';
