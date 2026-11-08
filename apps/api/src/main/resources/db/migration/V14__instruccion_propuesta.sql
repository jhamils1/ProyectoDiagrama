-- Proposals created before this migration keep a NULL instruction; their free text
-- is not parsed into an actionable command.
ALTER TABLE mensaje_diagrama ADD COLUMN instruccion_propuesta VARCHAR(1500);
ALTER TABLE mensaje_diagrama ADD CONSTRAINT ck_instruccion_propuesta
  CHECK (instruccion_propuesta IS NULL OR (tipo = 'PROPUESTA' AND length(trim(instruccion_propuesta)) > 0));
