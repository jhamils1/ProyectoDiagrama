package bo.edu.modela.diagrams;

import jakarta.persistence.*;
import java.util.UUID;

@Entity
@Table(name = "clase_uml")
public class ClaseUML {
  @Id public UUID id;
  public UUID diagramaId;

  @Column(length = 80)
  public String nombre;

  public boolean abstracta;

  @Column(name = "posicion_x")
  public double posicionX;

  @Column(name = "posicion_y")
  public double posicionY;

  public int orden;
}
