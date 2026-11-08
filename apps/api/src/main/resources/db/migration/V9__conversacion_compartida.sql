-- A committed per-diagram counter prevents readers from skipping a message whose
-- database sequence was allocated before a slower transaction committed.
CREATE TABLE conversacion_diagrama (
  diagrama_id UUID PRIMARY KEY REFERENCES diagrama(id) ON DELETE CASCADE,
  ultima_secuencia BIGINT NOT NULL DEFAULT 0 CHECK (ultima_secuencia >= 0)
);
CREATE TABLE mensaje_diagrama (
  id UUID PRIMARY KEY,
  diagrama_id UUID NOT NULL REFERENCES conversacion_diagrama(diagrama_id) ON DELETE CASCADE,
  secuencia BIGINT NOT NULL CHECK (secuencia > 0),
  autor_id UUID NOT NULL REFERENCES usuario(id),
  autor_nombre VARCHAR(100) NOT NULL,
  contenido TEXT NOT NULL CHECK (length(trim(contenido)) BETWEEN 1 AND 4000),
  fecha_creacion TIMESTAMPTZ NOT NULL,
  revision_diagrama BIGINT NOT NULL CHECK (revision_diagrama >= 0),
  UNIQUE (diagrama_id, secuencia)
);
