package bo.edu.modela.auth;

import bo.edu.modela.shared.ApiException;
import bo.edu.modela.users.*;
import jakarta.servlet.http.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class AuthController {
  record AdminLogin(
      @NotBlank @Email @Size(max = 254) String correo, @NotBlank @Size(max = 72) String password) {
    @Override
    public String toString() {
      return "AdminLogin[credentials=REDACTED]";
    }
  }

  record GoogleLogin(
      @NotBlank @Size(max = 16000) String credential, @NotNull AuthService.Intent intent) {
    @Override
    public String toString() {
      return "GoogleLogin[credential=REDACTED, intent=" + intent + "]";
    }
  }

  private final AuthService auth;
  private final GoogleTokenVerifier google;
  private final CurrentUser current;
  private final SecurityContextRepository contexts;
  private final CsrfTokenRepository csrf;
  private final LoginRateLimit rateLimit;
  private final String clientId;
  private final String cookieSameSite;

  public AuthController(
      AuthService auth,
      GoogleTokenVerifier google,
      CurrentUser current,
      SecurityContextRepository contexts,
      CsrfTokenRepository csrf,
      LoginRateLimit rateLimit,
      @Value("${modela.google-client-id}") String clientId,
      @Value("${server.servlet.session.cookie.same-site:lax}") String cookieSameSite) {
    this.auth = auth;
    this.google = google;
    this.current = current;
    this.contexts = contexts;
    this.csrf = csrf;
    this.rateLimit = rateLimit;
    this.clientId = clientId;
    this.cookieSameSite = cookieSameSite;
  }

  @GetMapping("/health")
  Map<String, String> health() {
    return Map.of("status", "ok");
  }

  @GetMapping("/auth/config")
  Map<String, Object> config() {
    return Map.of("googleEnabled", !clientId.isBlank(), "googleClientId", clientId);
  }

  @GetMapping("/auth/csrf")
  Map<String, String> csrf(CsrfToken token) {
    return Map.of("headerName", token.getHeaderName(), "token", token.getToken());
  }

  @GetMapping("/auth/me")
  UsuarioDto me() {
    return UsuarioDto.of(current.get());
  }

  @GetMapping("/auth/google/challenge")
  Map<String, String> challenge(HttpSession session) {
    String nonce = UUID.randomUUID().toString();
    session.setAttribute("googleNonce", nonce);
    session.setAttribute("googleNonceAt", Instant.now());
    return Map.of("nonce", nonce);
  }

  @PostMapping("/auth/admin")
  UsuarioDto admin(
      @Valid @RequestBody AdminLogin body,
      HttpServletRequest request,
      HttpServletResponse response) {
    rateLimit.check(request.getRemoteAddr());
    return establish(auth.admin(body.correo(), body.password()), request, response);
  }

  @PostMapping("/auth/google")
  UsuarioDto google(
      @Valid @RequestBody GoogleLogin body,
      HttpServletRequest request,
      HttpServletResponse response) {
    rateLimit.check(request.getRemoteAddr());
    var session = request.getSession(false);
    if (session == null) throw ApiException.unauthorized();
    String nonce;
    Instant created;
    synchronized (session) {
      nonce = (String) session.getAttribute("googleNonce");
      created = (Instant) session.getAttribute("googleNonceAt");
      session.removeAttribute("googleNonce");
      session.removeAttribute("googleNonceAt");
    }
    if (nonce == null || created == null || created.isBefore(Instant.now().minusSeconds(300)))
      throw ApiException.unauthorized();
    return establish(
        auth.google(google.verify(body.credential(), nonce), body.intent()), request, response);
  }

  private UsuarioDto establish(
      Usuario user, HttpServletRequest request, HttpServletResponse response) {
    request.getSession();
    request.changeSessionId();
    var context = SecurityContextHolder.createEmptyContext();
    context.setAuthentication(
        new UsernamePasswordAuthenticationToken(
            new SessionPrincipal(user.id, user.rol),
            null,
            List.of(new SimpleGrantedAuthority("ROLE_" + user.rol.name()))));
    SecurityContextHolder.setContext(context);
    contexts.saveContext(context, request, response);
    csrf.saveToken(null, request, response);
    return UsuarioDto.of(user);
  }

  @PostMapping("/auth/logout")
  @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
  void logout(HttpServletRequest request, HttpServletResponse response) {
    var session = request.getSession(false);
    if (session != null) session.invalidate();
    SecurityContextHolder.clearContext();
    csrf.saveToken(null, request, response);
    var cookie = new Cookie("MODELA_SESSION", "");
    cookie.setMaxAge(0);
    cookie.setPath("/");
    cookie.setHttpOnly(true);
    cookie.setSecure(request.isSecure());
    cookie.setAttribute("SameSite", cookieSameSite);
    response.addCookie(cookie);
  }
}
