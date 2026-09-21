ALTER TABLE atributo_uml DROP CONSTRAINT atributo_uml_tipo_dato_check;
ALTER TABLE atributo_uml ADD CONSTRAINT atributo_uml_tipo_dato_check
 CHECK (tipo_dato IN ('','String','Integer','Long','Decimal','Float','Double','Boolean','Date','DateTime','UUID'));
