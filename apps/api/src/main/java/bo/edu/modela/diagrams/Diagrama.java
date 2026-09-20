package bo.edu.modela.diagrams;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "diagrama")
public class Diagrama {
  @Id public UUID id;

  @Column(nullable = false)
  public UUID proyectoId;

  @Column(nullable = false, length = 100)
  public String nombre;

  public long versionActual;
  public Instant fechaActualizacion;
  public Instant eliminadoEn;
  @Version public long revision;
}
