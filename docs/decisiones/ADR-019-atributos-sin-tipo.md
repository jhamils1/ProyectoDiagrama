# ADR 019: tipo de atributo opcional

El usuario confirma que agregar atributos no debe exigir tipo de dato. Representar «sin tipo» con cadena vacía en dataType/tipo_dato, conservando la forma del documento y los tipos existentes. En API, campo omitido/null se normaliza a cadena vacía. No asignar String ni otro tipo por defecto. El estado no afecta required (obligatoriedad del valor) ni visibility/identifier.

Editor: opción Sin tipo predeterminada y posibilidad de asignar/quitar un tipo después. IA: admitir Agrega modelo a Vehiculo, Agrega modelo sin tipo a Vehiculo y crear clase con atributo sin tipo; comparar intención y no aceptar un tipo inventado. Reutilizar revisión y confirmación.

Migración aditiva V4 amplía la restricción de PostgreSQL, sin alterar atributos, instantáneas o UUID existentes. Clientes nuevos requieren backend actualizado; versiones antiguas del cliente no comprenden el estado vacío y deben actualizarse. Futura generación de código deberá solicitar completar tipos donde sean necesarios; no inventarlos. Verificar dominio, IndexedDB, API/PostgreSQL y UI. CU15 y CONTINUAR_AQUI.md conservan sus restricciones.

Ampliación de redacción: aceptar «Agrega el atributo modelo en la clase vehiculo» y «a la clase». El modelo produjo dos veces JSON con una comilla sobrante; no se reparó ni aplicó. Para operaciones sin tipo se adopta generación restringida por el esquema JSON existente, manteniendo comparación exacta de intención. La frase real pasó tras este cambio. Los comandos con tipo y asociaciones conservan greedy. La incidencia histórica de generación estructurada de 6D no desaparece: no se adopta universalmente ni se promete precisión general. Un fallo del motor se informa sin cambios; se comprueba regresión de las formas sin tipo anteriores.
