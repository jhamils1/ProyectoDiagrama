ALTER TABLE mensaje_diagrama ALTER COLUMN autor_id DROP NOT NULL;
ALTER TABLE mensaje_diagrama ADD COLUMN tipo VARCHAR(20) NOT NULL DEFAULT 'PERSONA'
  CHECK (tipo IN ('PERSONA', 'ASISTENTE'));
ALTER TABLE mensaje_diagrama ADD CONSTRAINT ck_autor_mensaje CHECK
  ((tipo = 'PERSONA' AND autor_id IS NOT NULL) OR (tipo = 'ASISTENTE' AND autor_id IS NULL));

CREATE TABLE solicitud_ia_diagrama (
  id UUID PRIMARY KEY REFERENCES mensaje_diagrama(id),
  proyecto_id UUID NOT NULL REFERENCES proyecto(id),
  diagrama_id UUID NOT NULL REFERENCES diagrama(id),
  solicitante_id UUID NOT NULL REFERENCES usuario(id),
  contexto TEXT NOT NULL,
  revision_diagrama BIGINT NOT NULL,
  estado VARCHAR(20) NOT NULL CHECK (estado IN ('PENDIENTE','PROCESANDO','COMPLETADA','FALLIDA')),
  error VARCHAR(300),
  token UUID,
  vencimiento TIMESTAMPTZ,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_solicitud_ia_activa ON solicitud_ia_diagrama(diagrama_id)
  WHERE estado IN ('PENDIENTE','PROCESANDO');
CREATE INDEX ix_solicitud_ia_trabajo ON solicitud_ia_diagrama(estado, creado_en);
