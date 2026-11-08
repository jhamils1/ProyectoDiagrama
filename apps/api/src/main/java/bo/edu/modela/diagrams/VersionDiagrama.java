package bo.edu.modela.diagrams;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "version_diagrama")
public class VersionDiagrama {
  @Id public UUID id;
  public UUID diagramaId;
  public long numero;
  public Instant fechaCreacion;
  public UUID autorId;
  public String autorNombre;

  @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.JSON)
  @Column(columnDefinition = "jsonb", nullable = false)
  public String contenido;
}
