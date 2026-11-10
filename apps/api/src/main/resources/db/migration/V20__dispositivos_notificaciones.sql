CREATE TABLE dispositivo_notificacion (
  token VARCHAR(1024) PRIMARY KEY,
  usuario_id UUID NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_dispositivo_notificacion_usuario ON dispositivo_notificacion(usuario_id);
