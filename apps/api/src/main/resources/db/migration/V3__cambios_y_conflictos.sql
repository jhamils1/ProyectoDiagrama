CREATE TABLE cambio (
 id UUID PRIMARY KEY,
 diagrama_id UUID NOT NULL REFERENCES diagrama(id),
 autor_id UUID NOT NULL REFERENCES usuario(id),
 version_base_id UUID NOT NULL REFERENCES version_diagrama(id),
 revision_base BIGINT NOT NULL CHECK (revision_base >= 0),
 revision_comparada BIGINT NOT NULL CHECK (revision_comparada >= 0),
 elemento_id UUID NOT NULL, tipo_elemento VARCHAR(20) NOT NULL,
 propiedad VARCHAR(100) NOT NULL, operacion VARCHAR(20) NOT NULL,
 valor_anterior JSONB NOT NULL, valor_propuesto JSONB NOT NULL,
 estado VARCHAR(20) NOT NULL CHECK (estado IN ('PENDIENTE','APLICADO','DESCARTADO')),
 fecha_creacion TIMESTAMPTZ NOT NULL,
 fecha_resolucion TIMESTAMPTZ
);
CREATE INDEX ix_cambio_pendiente ON cambio(diagrama_id,autor_id,fecha_creacion) WHERE estado='PENDIENTE';
CREATE TABLE conflicto (
 id UUID PRIMARY KEY, cambio_id UUID NOT NULL REFERENCES cambio(id),
 version_comparada_id UUID NOT NULL REFERENCES version_diagrama(id),
 ruta TEXT NOT NULL, descripcion TEXT NOT NULL,
 valor_local JSONB NOT NULL, valor_servidor JSONB NOT NULL,
 valor_resuelto JSONB,
 estado VARCHAR(20) NOT NULL CHECK (estado IN ('PENDIENTE','RESUELTO','SUPERADO','DESCARTADO')),
 resuelto_por UUID REFERENCES usuario(id), fecha_resolucion TIMESTAMPTZ
);
CREATE UNIQUE INDEX uq_conflicto_pendiente ON conflicto(cambio_id,ruta) WHERE estado='PENDIENTE';
