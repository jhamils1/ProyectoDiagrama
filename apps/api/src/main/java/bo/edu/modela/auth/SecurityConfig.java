package bo.edu.modela.auth;

import bo.edu.modela.users.UsuarioRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.*;
import java.io.IOException;
import org.springframework.context.annotation.*;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.AnonymousAuthenticationFilter;
import org.springframework.security.web.context.*;
import org.springframework.security.web.csrf.*;
import org.springframework.web.filter.OncePerRequestFilter;

@Configuration
public class SecurityConfig {
  @Bean
  org.springframework.security.core.userdetails.UserDetailsService noGeneratedAccounts() {
    return username -> {
      throw new org.springframework.security.core.userdetails.UsernameNotFoundException(
          "Usa el método de acceso correspondiente.");
    };
  }

  @Bean
  PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder(12);
  }

  @Bean
  SecurityContextRepository contextRepository() {
    return new HttpSessionSecurityContextRepository();
  }

  @Bean
  CsrfTokenRepository csrfRepository() {
    return new HttpSessionCsrfTokenRepository();
  }

  @Bean
  SecurityFilterChain security(
      HttpSecurity http,
      SecurityContextRepository contexts,
      CsrfTokenRepository csrf,
      UsuarioRepository users)
      throws Exception {
    http.securityContext(c -> c.securityContextRepository(contexts))
        .csrf(c -> c.csrfTokenRepository(csrf))
        .authorizeHttpRequests(
            a ->
                a.requestMatchers(
                        "/api/auth/csrf",
                        "/api/auth/config",
                        "/api/auth/google/challenge",
                        "/api/auth/admin",
                        "/api/auth/google",
                        "/api/health",
                        "/error")
                    .permitAll()
                    .requestMatchers("/api/**")
                    .authenticated()
                    .anyRequest()
                    .denyAll())
        .exceptionHandling(
            e ->
                e.authenticationEntryPoint(
                        (req, res, ex) ->
                            error(res, 401, "NO_AUTENTICADO", "Debes iniciar sesión."))
                    .accessDeniedHandler(
                        (req, res, ex) ->
                            error(
                                res,
                                403,
                                "SIN_PERMISO",
                                "Permiso insuficiente o protección CSRF inválida. Recarga e intenta"
                                    + " nuevamente.")))
        .formLogin(c -> c.disable())
        .httpBasic(c -> c.disable())
        .logout(c -> c.disable())
        .requestCache(c -> c.disable())
        .addFilterAfter(
            new OncePerRequestFilter() {
              @Override
              protected void doFilterInternal(
                  HttpServletRequest req, HttpServletResponse res, FilterChain chain)
                  throws ServletException, IOException {
                var auth = SecurityContextHolder.getContext().getAuthentication();
                if (auth != null
                    && auth.getPrincipal() instanceof SessionPrincipal principal
                    && users.findById(principal.id()).filter(u -> u.activo).isEmpty()) {
                  var session = req.getSession(false);
                  if (session != null) session.invalidate();
                  SecurityContextHolder.clearContext();
                  error(res, 401, "CUENTA_INACTIVA", "La cuenta ya no está disponible.");
                  return;
                }
                chain.doFilter(req, res);
              }
            },
            AnonymousAuthenticationFilter.class);
    return http.build();
  }

  static void error(HttpServletResponse response, int status, String code, String message)
      throws IOException {
    response.setStatus(status);
    response.setContentType("application/json");
    response.setCharacterEncoding("UTF-8");
    response.getWriter().write("{\"code\":\"" + code + "\",\"message\":\"" + message + "\"}");
  }
}
