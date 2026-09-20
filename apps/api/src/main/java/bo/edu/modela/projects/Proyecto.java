package bo.edu.modela.projects;

import bo.edu.modela.users.Usuario;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "proyecto")
public class Proyecto {
  @Id public UUID id;

  @Column(nullable = false, length = 100)
  public String nombre;

  @Column(nullable = false, length = 2000)
  public String descripcion;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "creador_id")
  public Usuario creador;

  @Column(name = "fecha_creacion", nullable = false)
  public Instant fechaCreacion;

  @Column(name = "eliminado_en")
  public Instant eliminadoEn;

  @Version public long revision;

  protected Proyecto() {}

  public Proyecto(String name, String description, Usuario creator) {
    id = UUID.randomUUID();
    nombre = name.trim();
    descripcion = description.trim();
    creador = creator;
    fechaCreacion = Instant.now();
  }
}
