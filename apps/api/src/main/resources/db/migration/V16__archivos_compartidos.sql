CREATE TABLE archivo_compartido (
  id UUID PRIMARY KEY,
  proyecto_id UUID NOT NULL REFERENCES proyecto(id),
  autor_id UUID NOT NULL REFERENCES usuario(id),
  autor_nombre VARCHAR(100) NOT NULL,
  nombre VARCHAR(180) NOT NULL,
  contenido BYTEA NOT NULL,
  tamano BIGINT NOT NULL CHECK (tamano > 0 AND tamano <= 5242880),
  fecha_creacion TIMESTAMPTZ NOT NULL,
  CHECK (octet_length(contenido) = tamano)
);
CREATE INDEX archivo_compartido_proyecto_fecha ON archivo_compartido(proyecto_id, fecha_creacion DESC, id DESC);
