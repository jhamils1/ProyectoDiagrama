package bo.edu.modela.notifications;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import bo.edu.modela.auth.CurrentUser;
import bo.edu.modela.users.Usuario;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

class DeviceControllerTest {
  @Test void registersAndRemovesOnlyForAuthenticatedUser() {
    var jdbc = mock(JdbcTemplate.class);
    var current = mock(CurrentUser.class);
    var user = new Usuario("Prueba", "test@example.com", Usuario.Rol.ADMINISTRADOR, "hash");
    when(current.get()).thenReturn(user);
    var controller = new DeviceController(jdbc, current);
    var device = new DeviceController.Device("test-token");
    controller.register(device);
    controller.remove(device);
    verify(jdbc).update(contains("INSERT INTO dispositivo_notificacion"), eq("test-token"), eq(user.id));
    verify(jdbc).update(contains("WHERE token = ? AND usuario_id = ?"), eq("test-token"), eq(user.id));
  }
}
