-- Structured continuation is stored only for server-generated activity replies.
ALTER TABLE mensaje_diagrama ADD COLUMN siguiente_consulta VARCHAR(250);
