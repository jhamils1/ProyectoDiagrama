package bo.edu.modela.diagrams;

import jakarta.persistence.*;
import java.util.UUID;

@Entity
@Table(name = "atributo_uml")
public class AtributoUML {
  @Id public UUID id;
  public UUID claseId;

  @Column(length = 80)
  public String nombre;

  @Column(length = 20)
  public String tipoDato;

  @Column(length = 20)
  public String visibilidad;

  public boolean identificador;
  public boolean obligatorio;
  public int orden;
}
