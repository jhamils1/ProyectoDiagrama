package bo.edu.modela.projects;

import bo.edu.modela.users.Usuario;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "participacion")
public class Participacion {
  public enum Permiso {
    CONSULTA,
    EDICION
  }

  @Id public UUID id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "usuario_id")
  public Usuario usuario;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "proyecto_id")
  public Proyecto proyecto;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 20)
  public Permiso permiso;

  @Column(name = "fecha_ingreso", nullable = false)
  public Instant fechaIngreso;

  @Version public long revision;

  protected Participacion() {}

  public Participacion(Usuario user, Proyecto project, Permiso permission) {
    id = UUID.randomUUID();
    usuario = user;
    proyecto = project;
    permiso = permission;
    fechaIngreso = Instant.now();
  }
}
