package bo.edu.modela.users;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.Locale;
import java.util.UUID;

@Entity
@Table(name = "usuario")
public class Usuario {
  public enum Rol {
    ADMINISTRADOR,
    COLABORADOR
  }

  @Id public UUID id;

  @Column(nullable = false, length = 100)
  public String nombre;

  @Column(nullable = false, length = 254)
  public String correo;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 20)
  public Rol rol;

  @Column(name = "password_hash", length = 100)
  public String passwordHash;

  @Column(name = "google_id", length = 255)
  public String googleId;

  @Column(nullable = false)
  public boolean activo;

  @Column(name = "creado_en", nullable = false)
  public Instant creadoEn;

  @Version public long revision;

  protected Usuario() {}

  public Usuario(String nombre, String correo, Rol rol, String hash) {
    this.id = UUID.randomUUID();
    this.nombre = nombre.trim();
    this.correo = normalizeEmail(correo);
    this.rol = rol;
    this.passwordHash = hash;
    this.activo = true;
    this.creadoEn = Instant.now();
  }

  public static String normalizeEmail(String value) {
    return value.trim().toLowerCase(Locale.ROOT);
  }
}
