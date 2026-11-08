-- Historical snapshots do not all have a provable author. Do not guess from timestamps.
ALTER TABLE version_diagrama
  ADD COLUMN autor_id UUID REFERENCES usuario(id),
  ADD COLUMN autor_nombre VARCHAR(120);
