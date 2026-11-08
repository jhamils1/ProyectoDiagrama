-- Opaque, untrusted client data; receiving clients must validate before use.
ALTER TABLE mensaje_diagrama ADD COLUMN propuesta_datos TEXT;
ALTER TABLE mensaje_diagrama ADD CONSTRAINT ck_propuesta_datos
  CHECK (propuesta_datos IS NULL OR (tipo = 'PROPUESTA' AND length(propuesta_datos) BETWEEN 1 AND 16000));
