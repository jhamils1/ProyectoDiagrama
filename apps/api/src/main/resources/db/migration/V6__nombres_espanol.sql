ALTER TABLE clase_uml DROP CONSTRAINT clase_uml_nombre_check;
ALTER TABLE clase_uml ADD CONSTRAINT clase_uml_nombre_check
 CHECK (nombre ~ '^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ_][A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9_]*$');
ALTER TABLE atributo_uml DROP CONSTRAINT atributo_uml_nombre_check;
ALTER TABLE atributo_uml ADD CONSTRAINT atributo_uml_nombre_check
 CHECK (nombre ~ '^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ_][A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9_]*$');
