package bo.edu.modela.diagrams.changes;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "cambio")
public class Cambio {
  @Id public UUID id;
  public UUID diagramaId, autorId, versionBaseId, elementoId;
  public long revisionBase, revisionComparada;
  @Column(length = 20) public String tipoElemento, operacion, estado;
  @Column(length = 100) public String propiedad;
  @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition = "jsonb") public String valorAnterior;
  @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition = "jsonb") public String valorPropuesto;
  public Instant fechaCreacion, fechaResolucion;
}
