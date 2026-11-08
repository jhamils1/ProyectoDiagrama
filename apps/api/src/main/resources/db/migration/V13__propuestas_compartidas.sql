ALTER TABLE mensaje_diagrama DROP CONSTRAINT mensaje_diagrama_tipo_check;
ALTER TABLE mensaje_diagrama DROP CONSTRAINT ck_autor_mensaje;
ALTER TABLE mensaje_diagrama ADD CONSTRAINT mensaje_diagrama_tipo_check
  CHECK (tipo IN ('PERSONA', 'ASISTENTE', 'PROPUESTA'));
ALTER TABLE mensaje_diagrama ADD CONSTRAINT ck_autor_mensaje CHECK
  ((tipo IN ('PERSONA', 'PROPUESTA') AND autor_id IS NOT NULL) OR (tipo = 'ASISTENTE' AND autor_id IS NULL));
