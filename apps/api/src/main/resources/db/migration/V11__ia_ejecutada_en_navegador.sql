ALTER TABLE solicitud_ia_diagrama ADD COLUMN ejecutor_id UUID REFERENCES usuario(id);
ALTER TABLE solicitud_ia_diagrama ADD COLUMN ejecutor_nombre VARCHAR(100);
ALTER TABLE solicitud_ia_diagrama ADD COLUMN resultado_hash VARCHAR(64);
ALTER TABLE mensaje_diagrama ADD COLUMN ejecutor_id UUID REFERENCES usuario(id);
ALTER TABLE mensaje_diagrama ADD COLUMN ejecutor_nombre VARCHAR(100);
-- Old server jobs have no browser executor. Make unfinished requests recoverable.
UPDATE solicitud_ia_diagrama SET estado='PENDIENTE',token=NULL,vencimiento=NULL
WHERE estado='PROCESANDO';
