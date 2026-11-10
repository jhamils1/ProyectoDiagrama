package bo.edu.modela.notifications;

import bo.edu.modela.auth.CurrentUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/notification-devices")
public class DeviceController {
  public record Device(@NotBlank @Size(max = 1024) String token) {}
  private final JdbcTemplate jdbc;
  private final CurrentUser current;
  public DeviceController(JdbcTemplate jdbc, CurrentUser current) {
    this.jdbc = jdbc;
    this.current = current;
  }
  @PostMapping
  public void register(@Valid @RequestBody Device device) {
    jdbc.update("INSERT INTO dispositivo_notificacion(token, usuario_id) VALUES (?, ?) " +
        "ON CONFLICT (token) DO UPDATE SET usuario_id = EXCLUDED.usuario_id, actualizado_en = now()",
        device.token(), current.get().id);
  }
  @PostMapping("/remove")
  public void remove(@Valid @RequestBody Device device) {
    jdbc.update("DELETE FROM dispositivo_notificacion WHERE token = ? AND usuario_id = ?",
        device.token(), current.get().id);
  }
}
