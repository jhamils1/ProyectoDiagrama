package bo.edu.modela.auth;

import bo.edu.modela.shared.ApiException;
import java.util.Set;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.stereotype.Service;

@Service
public class GoogleTokenVerifier {
  public record Identity(String subject, String email, String name, boolean authoritativeEmail) {}

  private final String clientId;
  private final JwtDecoder decoder;

  @org.springframework.beans.factory.annotation.Autowired
  public GoogleTokenVerifier(@Value("${modela.google-client-id}") String clientId) {
    this(
        clientId,
        NimbusJwtDecoder.withJwkSetUri("https://www.googleapis.com/oauth2/v3/certs").build());
  }

  // Package-visible constructor supports cryptographic tests with a locally generated RSA key.
  GoogleTokenVerifier(String clientId, JwtDecoder decoder) {
    this.clientId = clientId;
    this.decoder = decoder;
  }

  public Identity verify(String token, String nonce) {
    if (clientId.isBlank())
      throw new ApiException(
          HttpStatus.SERVICE_UNAVAILABLE,
          "GOOGLE_NO_CONFIGURADO",
          "El acceso con Google aún no está configurado.");
    try {
      Jwt jwt = decoder.decode(token);
      if (!Set.of("https://accounts.google.com", "accounts.google.com")
              .contains(jwt.getClaimAsString("iss") == null ? "" : jwt.getClaimAsString("iss"))
          || !jwt.getAudience().contains(clientId)
          || jwt.getExpiresAt() == null
          || !jwt.getExpiresAt().isAfter(java.time.Instant.now())
          || !Boolean.TRUE.equals(jwt.getClaim("email_verified"))
          || nonce == null
          || !nonce.equals(jwt.getClaimAsString("nonce"))
          || jwt.getSubject() == null
          || jwt.getSubject().isBlank()) throw ApiException.unauthorized();
      String email = jwt.getClaimAsString("email");
      if (email == null || email.length() > 254 || !email.contains("@"))
        throw ApiException.unauthorized();
      email = bo.edu.modela.users.Usuario.normalizeEmail(email);
      String name = jwt.getClaimAsString("name");
      if (name == null || name.isBlank()) name = email.split("@")[0];
      String domain = jwt.getClaimAsString("hd");
      boolean authoritative = email.endsWith("@gmail.com") || (domain != null && !domain.isBlank());
      return new Identity(
          jwt.getSubject(), email, name.substring(0, Math.min(name.length(), 100)), authoritative);
    } catch (JwtException | IllegalArgumentException ex) {
      throw ApiException.unauthorized();
    }
  }
}
