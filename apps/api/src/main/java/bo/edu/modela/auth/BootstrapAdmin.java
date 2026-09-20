package bo.edu.modela.auth;

import bo.edu.modela.users.*;
import java.nio.charset.StandardCharsets;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class BootstrapAdmin implements ApplicationRunner {
  private final UsuarioRepository users;
  private final PasswordEncoder encoder;
  private final String email, password;

  public BootstrapAdmin(
      UsuarioRepository users,
      PasswordEncoder encoder,
      @Value("${modela.bootstrap.email}") String email,
      @Value("${modela.bootstrap.password}") String password) {
    this.users = users;
    this.encoder = encoder;
    this.email = email;
    this.password = password;
  }

  @Override
  @Transactional
  public void run(ApplicationArguments args) {
    if (users.existsByRol(Usuario.Rol.ADMINISTRADOR)) return;
    if (email.isBlank()
        || password.length() < 12
        || password.getBytes(StandardCharsets.UTF_8).length > 72)
      throw new IllegalStateException(
          "Configura BOOTSTRAP_ADMIN_EMAIL y una contraseña de 12 a 72 bytes antes del primer"
              + " arranque.");
    users.save(
        new Usuario("Administrador", email, Usuario.Rol.ADMINISTRADOR, encoder.encode(password)));
  }
}
