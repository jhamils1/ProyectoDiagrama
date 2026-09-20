package bo.edu.modela.auth;

import bo.edu.modela.shared.ApiException;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class LoginRateLimit {
  private record Window(Instant since, int attempts) {}

  private final Map<String, Window> attempts = new HashMap<>();

  public synchronized void check(String address) {
    Instant now = Instant.now();
    attempts.entrySet().removeIf(e -> e.getValue().since().isBefore(now.minusSeconds(300)));
    Window current = attempts.get(address);
    if ((current != null && current.attempts() >= 30)
        || (current == null && attempts.size() >= 10_000))
      throw new ApiException(
          HttpStatus.TOO_MANY_REQUESTS,
          "DEMASIADOS_INTENTOS",
          "Demasiados intentos. Espera cinco minutos antes de volver a acceder.");
    attempts.put(
        address,
        current == null ? new Window(now, 1) : new Window(current.since(), current.attempts() + 1));
  }
}
