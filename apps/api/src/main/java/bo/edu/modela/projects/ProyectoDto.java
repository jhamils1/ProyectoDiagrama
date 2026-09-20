package bo.edu.modela.projects;

import java.time.Instant;
import java.util.UUID;

public record ProyectoDto(
    UUID id,
    String nombre,
    String descripcion,
    Instant fechaCreacion,
    String permiso,
    long revision) {
  public static ProyectoDto of(Proyecto p, String permission) {
    return new ProyectoDto(p.id, p.nombre, p.descripcion, p.fechaCreacion, permission, p.revision);
  }
}
