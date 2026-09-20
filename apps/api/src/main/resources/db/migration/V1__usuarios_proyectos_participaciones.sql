-- ICU keeps case conversion consistent for accented names across host locales.
CREATE COLLATION modela_text (provider = icu, locale = 'und', deterministic = true);
CREATE TABLE usuario (
    id UUID PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL CHECK (length(trim(nombre)) > 0),
    correo VARCHAR(254) COLLATE modela_text NOT NULL CHECK (correo = lower(trim(correo))),
    rol VARCHAR(20) NOT NULL CHECK (rol IN ('ADMINISTRADOR', 'COLABORADOR')),
    password_hash VARCHAR(100),
    google_id VARCHAR(255),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL,
    revision BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT uq_usuario_correo UNIQUE (correo),
    CONSTRAINT uq_usuario_google UNIQUE (google_id),
    CONSTRAINT ck_usuario_identidad CHECK (
      (rol = 'ADMINISTRADOR' AND password_hash IS NOT NULL AND google_id IS NULL)
      OR (rol = 'COLABORADOR' AND password_hash IS NULL)
    )
);
CREATE TABLE proyecto (
    id UUID PRIMARY KEY,
    nombre VARCHAR(100) COLLATE modela_text NOT NULL CHECK (length(trim(nombre)) > 0),
    descripcion VARCHAR(2000) NOT NULL DEFAULT '',
    creador_id UUID NOT NULL REFERENCES usuario(id),
    fecha_creacion TIMESTAMPTZ NOT NULL,
    eliminado_en TIMESTAMPTZ,
    revision BIGINT NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX uq_proyecto_nombre ON proyecto (lower(trim(nombre)));
CREATE TABLE participacion (
    id UUID PRIMARY KEY,
    usuario_id UUID NOT NULL REFERENCES usuario(id),
    proyecto_id UUID NOT NULL REFERENCES proyecto(id),
    permiso VARCHAR(20) NOT NULL CHECK (permiso IN ('CONSULTA', 'EDICION')),
    fecha_ingreso TIMESTAMPTZ NOT NULL,
    revision BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT uq_participacion UNIQUE (usuario_id, proyecto_id)
);
CREATE INDEX ix_participacion_proyecto ON participacion(proyecto_id);
