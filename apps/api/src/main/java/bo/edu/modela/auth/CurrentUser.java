package bo.edu.modela.auth;

import bo.edu.modela.shared.ApiException;
import bo.edu.modela.users.*;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

@Service
public class CurrentUser {
  private final UsuarioRepository users;

  public CurrentUser(UsuarioRepository users) {
    this.users = users;
  }

  public Usuario get() {
    var authentication = SecurityContextHolder.getContext().getAuthentication();
    if (authentication == null
        || !(authentication.getPrincipal() instanceof SessionPrincipal principal))
      throw ApiException.unauthorized();
    return users
        .findById(principal.id())
        .filter(u -> u.activo)
        .orElseThrow(ApiException::unauthorized);
  }

  public Usuario admin() {
    var user = get();
    if (user.rol != Usuario.Rol.ADMINISTRADOR) throw ApiException.forbidden();
    return user;
  }
}
