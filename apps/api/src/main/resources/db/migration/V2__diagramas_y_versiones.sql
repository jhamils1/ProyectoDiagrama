CREATE TABLE diagrama (
 id UUID PRIMARY KEY, proyecto_id UUID NOT NULL REFERENCES proyecto(id),
 nombre VARCHAR(100) NOT NULL CHECK (length(trim(nombre)) > 0),
 version_actual BIGINT NOT NULL CHECK (version_actual >= 1),
 fecha_actualizacion TIMESTAMPTZ NOT NULL, eliminado_en TIMESTAMPTZ,
 revision BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX ix_diagrama_proyecto ON diagrama(proyecto_id);
CREATE TABLE clase_uml (
 id UUID PRIMARY KEY, diagrama_id UUID NOT NULL REFERENCES diagrama(id),
 nombre VARCHAR(80) NOT NULL CHECK (nombre ~ '^[A-Za-z_][A-Za-z0-9_]*$'),
 abstracta BOOLEAN NOT NULL, posicion_x DOUBLE PRECISION NOT NULL CHECK (posicion_x BETWEEN -100000 AND 100000),
 posicion_y DOUBLE PRECISION NOT NULL CHECK (posicion_y BETWEEN -100000 AND 100000), orden INTEGER NOT NULL,
 UNIQUE(id, diagrama_id)
);
CREATE UNIQUE INDEX uq_clase_nombre ON clase_uml(diagrama_id,lower(nombre));
CREATE TABLE atributo_uml (
 id UUID PRIMARY KEY, clase_id UUID NOT NULL REFERENCES clase_uml(id), nombre VARCHAR(80) NOT NULL CHECK (nombre ~ '^[A-Za-z_][A-Za-z0-9_]*$'),
 tipo_dato VARCHAR(20) NOT NULL CHECK (tipo_dato IN ('String','Integer','Long','Decimal','Boolean','Date','DateTime','UUID')),
 visibilidad VARCHAR(20) NOT NULL CHECK (visibilidad IN ('private','public','protected','package')),
 identificador BOOLEAN NOT NULL, obligatorio BOOLEAN NOT NULL, orden INTEGER NOT NULL,
 CHECK (NOT identificador OR obligatorio)
);
CREATE UNIQUE INDEX uq_atributo_nombre ON atributo_uml(clase_id,lower(nombre));
CREATE UNIQUE INDEX uq_atributo_identificador ON atributo_uml(clase_id) WHERE identificador;
CREATE TABLE relacion_uml (
 id UUID PRIMARY KEY, diagrama_id UUID NOT NULL REFERENCES diagrama(id),
 origen_id UUID NOT NULL, destino_id UUID NOT NULL,
 tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('association','generalization')),
 nombre VARCHAR(80) NOT NULL,
 multiplicidad_origen VARCHAR(80) NOT NULL, multiplicidad_destino VARCHAR(80) NOT NULL,
 orden INTEGER NOT NULL,
 FOREIGN KEY (origen_id,diagrama_id) REFERENCES clase_uml(id,diagrama_id),
 FOREIGN KEY (destino_id,diagrama_id) REFERENCES clase_uml(id,diagrama_id),
 CHECK (tipo <> 'generalization' OR origen_id <> destino_id)
);
CREATE INDEX ix_relacion_diagrama ON relacion_uml(diagrama_id);
CREATE UNIQUE INDEX uq_relacion ON relacion_uml(diagrama_id,tipo,origen_id,destino_id,lower(nombre));
CREATE UNIQUE INDEX uq_superclase ON relacion_uml(diagrama_id,origen_id) WHERE tipo='generalization';
CREATE TABLE version_diagrama (
 id UUID PRIMARY KEY, diagrama_id UUID NOT NULL REFERENCES diagrama(id),
 numero BIGINT NOT NULL CHECK (numero >= 1), fecha_creacion TIMESTAMPTZ NOT NULL,
 contenido JSONB NOT NULL, UNIQUE(diagrama_id,numero)
);
