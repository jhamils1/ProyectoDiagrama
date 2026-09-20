package bo.edu.modela.users;

import java.util.UUID;

public record UsuarioDto(
    UUID id,
    String nombre,
    String correo,
    Usuario.Rol rol,
    boolean activo,
    boolean googleVinculado,
    long revision) {
  public static UsuarioDto of(Usuario u) {
    return new UsuarioDto(
        u.id, u.nombre, u.correo, u.rol, u.activo, u.googleId != null, u.revision);
  }
}
