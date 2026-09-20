package bo.edu.modela.auth;

import bo.edu.modela.users.Usuario;
import java.io.Serializable;
import java.util.UUID;

public record SessionPrincipal(UUID id, Usuario.Rol rol) implements Serializable {}
