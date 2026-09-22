# Diagrama de clases del sistema Modela

Este documento describe el diagrama de clases del sistema Modela. Representa las clases principales que realmente usa el software.

También está disponible el archivo importable [modela-diagrama-clases-ea.xmi](modela-diagrama-clases-ea.xmi), compatible con Enterprise Architect.

## Importarlo en Enterprise Architect

1. En Enterprise Architect, abre **Publish > Import/Export > Import Package from XMI**.
2. Selecciona `docs/modela-diagrama-clases-ea.xmi`.
3. Deja seleccionada la opción **Import Diagrams** y pulsa **Import**.
4. El diagrama se crea con clases, atributos, relaciones, multiplicidades y composiciones. Solo acomódalo visualmente y guárdalo con **Ctrl + S**.

## DistribuciÃ³n sugerida

```text
Usuario â”€â”€ Participacion â”€â”€ Proyecto â”€â”€ Diagrama â”€â”€ VersionDiagrama
   â”‚                             â”‚            â”‚
   â”‚                             â”‚            â”œâ”€â”€ ClaseUML â”€â”€ AtributoUML
   â”‚                             â”‚            â”œâ”€â”€ RelacionUML
   â”‚                             â”‚            â””â”€â”€ Cambio â”€â”€ Conflicto
   â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜

                                      Diagrama â”€ â”€ â”€> GeneradorBackend
```

Pon **Usuario** arriba a la izquierda, **Proyecto** en el centro superior, **Diagrama** al centro, las clases UML a la derecha y las clases de historial debajo. `GeneradorBackend` puede ir a la derecha de `Diagrama`.

## Clases y atributos

### Usuario

```text
Usuario
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
- id: UUID
- nombre: String
- correo: String
- rol: RolUsuario
- passwordHash: String
- googleId: String
- activo: boolean
- creadoEn: DateTime
- revision: Long
```

### RolUsuario Â«enumerationÂ»

```text
ADMINISTRADOR
COLABORADOR
```

### Proyecto

```text
Proyecto
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
- id: UUID
- nombre: String
- descripcion: String
- fechaCreacion: DateTime
- eliminadoEn: DateTime
- revision: Long
```

### Participacion

Esta clase representa la asignaciÃ³n de un usuario a un proyecto.

```text
Participacion
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
- id: UUID
- permiso: Permiso
- fechaIngreso: DateTime
- revision: Long
```

### Permiso Â«enumerationÂ»

```text
CONSULTA
EDICION
```

### Diagrama

```text
Diagrama
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
- id: UUID
- nombre: String
- versionActual: Long
- fechaActualizacion: DateTime
- eliminadoEn: DateTime
- revision: Long
```

### VersionDiagrama

```text
VersionDiagrama
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
- id: UUID
- numero: Long
- fechaCreacion: DateTime
- contenido: JSON
```

### ClaseUML

```text
ClaseUML
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
- id: UUID
- nombre: String
- abstracta: boolean
- posicionX: Double
- posicionY: Double
- orden: Integer
```

### AtributoUML

```text
AtributoUML
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
- id: UUID
- nombre: String
- tipoDato: String
- visibilidad: String
- identificador: boolean
- obligatorio: boolean
- orden: Integer
```

### RelacionUML

```text
RelacionUML
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
- id: UUID
- tipo: String
- nombre: String
- multiplicidadOrigen: String
- multiplicidadDestino: String
- orden: Integer
```

### Cambio

```text
Cambio
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
- id: UUID
- revisionBase: Long
- revisionComparada: Long
- tipoElemento: String
- operacion: String
- estado: String
- propiedad: String
- valorAnterior: JSON
- valorPropuesto: JSON
- fechaCreacion: DateTime
- fechaResolucion: DateTime
```

### Conflicto

```text
Conflicto
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
- id: UUID
- ruta: String
- descripcion: String
- estado: String
- valorLocal: JSON
- valorServidor: JSON
- valorResuelto: JSON
- fechaResolucion: DateTime
```

### GeneradorBackend

Es una clase de servicio: genera el ZIP de Spring Boot desde un diagrama.

```text
GeneradorBackend
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
+ generar(diagrama): ZIP
```

## Relaciones para Enterprise Architect

| Origen | RelaciÃ³n | Destino | Multiplicidad | Nombre sugerido |
|---|---|---|---|---|
| Usuario | AsociaciÃ³n | Proyecto | Usuario `1` â€” Proyecto `0..*` | crea |
| Usuario | AsociaciÃ³n | Participacion | Usuario `1` â€” Participacion `0..*` | participa |
| Proyecto | AsociaciÃ³n | Participacion | Proyecto `1` â€” Participacion `0..*` | tiene |
| Proyecto | ComposiciÃ³n | Diagrama | Proyecto `1` â€” Diagrama `0..*` | contiene |
| Diagrama | ComposiciÃ³n | VersionDiagrama | Diagrama `1` â€” VersionDiagrama `1..*` | versiona |
| Diagrama | ComposiciÃ³n | ClaseUML | Diagrama `1` â€” ClaseUML `0..*` | contiene |
| ClaseUML | ComposiciÃ³n | AtributoUML | ClaseUML `1` â€” AtributoUML `0..*` | define |
| Diagrama | ComposiciÃ³n | RelacionUML | Diagrama `1` â€” RelacionUML `0..*` | contiene |
| RelacionUML | AsociaciÃ³n | ClaseUML | RelacionUML `0..*` â€” ClaseUML `1` | origen |
| RelacionUML | AsociaciÃ³n | ClaseUML | RelacionUML `0..*` â€” ClaseUML `1` | destino |
| Diagrama | ComposiciÃ³n | Cambio | Diagrama `1` â€” Cambio `0..*` | registra |
| Usuario | AsociaciÃ³n | Cambio | Usuario `1` â€” Cambio `0..*` | realiza |
| Cambio | ComposiciÃ³n | Conflicto | Cambio `1` â€” Conflicto `0..*` | puede generar |
| Usuario | AsociaciÃ³n | Conflicto | Usuario `0..1` â€” Conflicto `0..*` | resuelve |
| GeneradorBackend | Dependencia | Diagrama | â€” | genera desde |

## Nota para la presentaciÃ³n

`Participacion` resuelve la relaciÃ³n muchos a muchos entre `Usuario` y `Proyecto`, porque ademÃ¡s guarda el permiso de cada integrante. `VersionDiagrama`, `Cambio` y `Conflicto` permiten conservar historial y resolver ediciones simultÃ¡neas.



