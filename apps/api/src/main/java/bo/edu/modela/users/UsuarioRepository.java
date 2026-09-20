package bo.edu.modela.users;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UsuarioRepository extends JpaRepository<Usuario, UUID> {
  Optional<Usuario> findByCorreo(String correo);

  Optional<Usuario> findByGoogleId(String googleId);

  boolean existsByRol(Usuario.Rol rol);
}
