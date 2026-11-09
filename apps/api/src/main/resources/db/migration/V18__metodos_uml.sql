CREATE TABLE metodo_uml (
  id UUID PRIMARY KEY,
  clase_id UUID NOT NULL REFERENCES clase_uml(id) ON DELETE CASCADE,
  nombre VARCHAR(80) NOT NULL,
  tipo_retorno VARCHAR(20) NOT NULL,
  visibilidad VARCHAR(20) NOT NULL,
  orden INTEGER NOT NULL
);
CREATE INDEX metodo_uml_clase_idx ON metodo_uml(clase_id);
