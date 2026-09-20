package bo.edu.modela.auth;

import bo.edu.modela.shared.ApiException;
import bo.edu.modela.users.*;
import java.nio.charset.StandardCharsets;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {
  public enum Intent {
    REGISTER,
    LOGIN
  }

  private final UsuarioRepository users;
  private final PasswordEncoder encoder;
  private final String dummyHash;

  public AuthService(UsuarioRepository users, PasswordEncoder encoder) {
    this.users = users;
    this.encoder = encoder;
    this.dummyHash = encoder.encode(java.util.UUID.randomUUID().toString());
  }

  @Transactional(readOnly = true)
  public Usuario admin(String email, String password) {
    if (password.getBytes(StandardCharsets.UTF_8).length > 72) throw ApiException.unauthorized();
    Usuario user = users.findByCorreo(Usuario.normalizeEmail(email)).orElse(null);
    String hash = user == null || user.passwordHash == null ? dummyHash : user.passwordHash;
    boolean valid = encoder.matches(password, hash);
    if (!valid || user == null || !user.activo || user.rol != Usuario.Rol.ADMINISTRADOR)
      throw ApiException.unauthorized();
    return user;
  }

  @Transactional
  public Usuario google(GoogleTokenVerifier.Identity identity, Intent intent) {
    var linked = users.findByGoogleId(identity.subject());
    if (linked.isPresent()) {
      if (!linked.get().activo || linked.get().rol != Usuario.Rol.COLABORADOR)
        throw ApiException.unauthorized();
      if (intent == Intent.REGISTER)
        throw ApiException.conflict("La cuenta ya está registrada. Usa la opción de acceso.");
      return linked.get();
    }
    var existing = users.findByCorreo(identity.email());
    if (existing.isPresent()) {
      if (intent == Intent.REGISTER)
        throw ApiException.conflict("El correo ya está registrado. Usa la opción de acceso.");
      Usuario user = existing.get();
      if (!user.activo || user.rol != Usuario.Rol.COLABORADOR || user.googleId != null)
        throw ApiException.unauthorized();
      if (!identity.authoritativeEmail())
        throw ApiException.conflict(
            "La cuenta precreada requiere verificar su vinculación con el Administrador; Google no"
                + " es autoridad de este correo.");
      user.googleId = identity.subject();
      return users.saveAndFlush(user);
    }
    if (intent == Intent.LOGIN) throw ApiException.unauthorized();
    Usuario user = new Usuario(identity.name(), identity.email(), Usuario.Rol.COLABORADOR, null);
    user.googleId = identity.subject();
    return users.saveAndFlush(user);
  }
}
