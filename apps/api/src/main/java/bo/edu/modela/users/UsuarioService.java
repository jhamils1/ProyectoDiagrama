package bo.edu.modela.users;

import bo.edu.modela.auth.CurrentUser;
import bo.edu.modela.shared.*;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UsuarioService {
  private final UsuarioRepository users;
  private final CurrentUser current;

  public UsuarioService(UsuarioRepository users, CurrentUser current) {
    this.users = users;
    this.current = current;
  }

  @Transactional(readOnly = true)
  public PageResult<UsuarioDto> list(int page, int size) {
    current.admin();
    return PageResult.of(users.findAll(PageResult.request(page, size)).map(UsuarioDto::of));
  }

  @Transactional
  public UsuarioDto create(String name, String email) {
    current.admin();
    return UsuarioDto.of(
        users.saveAndFlush(new Usuario(name, email, Usuario.Rol.COLABORADOR, null)));
  }

  @Transactional
  public UsuarioDto update(UUID id, String name, boolean active, long revision) {
    current.admin();
    var u = users.findById(id).orElseThrow(ApiException::notFound);
    if (u.rol != Usuario.Rol.COLABORADOR) throw ApiException.forbidden();
    if (u.revision != revision)
      throw ApiException.conflict("La cuenta cambió. Recarga antes de guardar.");
    u.nombre = name.trim();
    u.activo = active;
    return UsuarioDto.of(users.saveAndFlush(u));
  }
}
