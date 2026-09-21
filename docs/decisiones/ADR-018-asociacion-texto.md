# ADR 018: asociación uno a muchos en CU14

El usuario solicita asociación simple por IA local, incluyendo tres formulaciones naturales concretas. «Un A puede tener/tiene muchos Bs y cada B pertenece a un (solo) A» expresa A=1, B=0..*, según la semántica explícitamente acordada. No es un valor por defecto para una petición incompleta. Admitir también multiplicidades explícitas origen 1 y destino 0..* o 1..*.

Antes de la inferencia se verifica que se indiquen ambos extremos y multiplicidades, y que las clases existan. El singular se toma de la mención «cada B», contrastado con el plural y cualquier cabecera «entre A y B»; no se crean clases ni se adivinan nombres. Frases ambiguas o no reconocidas piden aclaración. No se promete comprensión de cualquier redacción.

Se usa un prompt específico de asociación con el mismo motor local. El modelo genera el JSON; la comprobación de intención compara extremos, tipo y multiplicidades y participa en un reintento. No se sustituye la salida por un JSON construido por reglas. El resto de comandos conserva el prompt anterior. Se reutilizan vista previa, confirmación, applyReviewedEdit, autorización, cola, revisiones y validaciones existentes, sin cambios de API ni tablas.

Verificar los tres ejemplos del usuario con el motor real, además de pruebas de clases ausentes, datos incompletos, inversión de extremos, multiplicidades equivocadas, tipo distinto y operaciones extra. Composición, agregación y generación de sistemas siguen fuera de alcance; CU15 continúa aplazado y CONTINUAR_AQUI.md intacto.
