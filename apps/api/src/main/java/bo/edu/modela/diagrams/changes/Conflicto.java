package bo.edu.modela.diagrams.changes;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "conflicto")
public class Conflicto {
  @Id public UUID id;
  public UUID cambioId, versionComparadaId, resueltoPor;
  @Column(columnDefinition = "text") public String ruta, descripcion;
  @Column(length = 20) public String estado;
  @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition = "jsonb") public String valorLocal;
  @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition = "jsonb") public String valorServidor;
  @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition = "jsonb") public String valorResuelto;
  public Instant fechaResolucion;
}
