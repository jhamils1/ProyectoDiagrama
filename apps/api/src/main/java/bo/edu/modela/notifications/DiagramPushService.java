package bo.edu.modela.notifications;

import bo.edu.modela.diagrams.DiagramService;
import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.Message;
import com.google.firebase.messaging.Notification;
import jakarta.annotation.PreDestroy;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.Executors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.event.TransactionalEventListener;

@Service
public class DiagramPushService {
  private static final Logger log = LoggerFactory.getLogger(DiagramPushService.class);
  private final JdbcTemplate jdbc;
  private final FirebaseMessaging messaging;
  private final java.util.concurrent.ExecutorService executor = Executors.newSingleThreadExecutor();

  public DiagramPushService(JdbcTemplate jdbc,
      @Value("${modela.firebase-service-account:}") String credentials) {
    this.jdbc = jdbc;
    FirebaseMessaging client = null;
    if (!credentials.isBlank()) {
      try {
        var options = FirebaseOptions.builder().setCredentials(GoogleCredentials.fromStream(
            new ByteArrayInputStream(credentials.getBytes(StandardCharsets.UTF_8)))).build();
        client = FirebaseMessaging.getInstance(FirebaseApp.initializeApp(options, "modela-push"));
      } catch (Exception ex) {
        log.error("No se pudo configurar Firebase para notificaciones: {}", ex.getClass().getSimpleName());
      }
    }
    messaging = client;
  }

  @TransactionalEventListener
  public void changed(DiagramService.Changed event) {
    if (messaging == null) return;
    executor.execute(() -> send(event));
  }

  void send(DiagramService.Changed event) {
    try {
      var tokens = jdbc.queryForList("SELECT DISTINCT d.token FROM dispositivo_notificacion d " +
          "JOIN usuario u ON u.id=d.usuario_id " +
          "JOIN proyecto p ON p.id=? AND p.eliminado_en IS NULL " +
          "LEFT JOIN participacion part ON part.proyecto_id=p.id AND part.usuario_id=u.id " +
          "WHERE u.activo AND (u.rol='ADMINISTRADOR' OR part.id IS NOT NULL)",
          String.class, event.project());
      for (String token : tokens) {
        try {
          messaging.send(Message.builder().setToken(token)
              .setNotification(Notification.builder().setTitle("Modela")
                  .setBody("Hay cambios en un diagrama de tu proyecto.").build())
              .build());
        } catch (Exception ex) {
          log.warn("No se pudo entregar una notificación: {}", ex.getClass().getSimpleName());
        }
      }
    } catch (RuntimeException ex) {
      log.warn("No se pudieron consultar dispositivos para la notificación: {}", ex.getClass().getSimpleName());
    }
  }

  @PreDestroy public void close() { executor.shutdownNow(); }
}
