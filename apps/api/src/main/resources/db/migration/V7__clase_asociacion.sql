ALTER TABLE relacion_uml ADD COLUMN clase_asociacion_id UUID;

ALTER TABLE relacion_uml
  ADD CONSTRAINT fk_relacion_clase_asociacion
  FOREIGN KEY (clase_asociacion_id, diagrama_id)
  REFERENCES clase_uml(id, diagrama_id);

ALTER TABLE relacion_uml
  ADD CONSTRAINT ck_relacion_clase_asociacion
  CHECK (
    clase_asociacion_id IS NULL
    OR (
      tipo = 'association'
      AND clase_asociacion_id <> origen_id
      AND clase_asociacion_id <> destino_id
    )
  );
