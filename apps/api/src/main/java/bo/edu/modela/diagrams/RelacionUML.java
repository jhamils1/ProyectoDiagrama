package bo.edu.modela.diagrams;

import jakarta.persistence.*;
import java.util.UUID;

@Entity
@Table(name = "relacion_uml")
public class RelacionUML {
  @Id public UUID id;
  public UUID diagramaId;
  public UUID origenId;
  public UUID destinoId;

  @Column(length = 20)
  public String tipo;

  @Column(length = 80)
  public String nombre;

  @Column(length = 80)
  public String multiplicidadOrigen;

  @Column(length = 80)
  public String multiplicidadDestino;

  public int orden;
}
