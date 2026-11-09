package bo.edu.modela.diagrams;

import jakarta.persistence.*;
import java.util.UUID;

@Entity
@Table(name = "metodo_uml")
public class MetodoUML {
  @Id public UUID id;
  public UUID claseId;
  @Column(length = 80) public String nombre;
  @Column(length = 20) public String tipoRetorno;
  @Column(length = 20) public String visibilidad;
  public int orden;
}
