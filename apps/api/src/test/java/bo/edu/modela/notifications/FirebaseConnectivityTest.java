package bo.edu.modela.notifications;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.FirebaseMessagingException;
import com.google.firebase.messaging.Message;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

/** Opt-in diagnostic: validates credentials without sending to a real device. */
@EnabledIfEnvironmentVariable(named = "MODELA_FIREBASE_DIAGNOSTIC", matches = "true")
class FirebaseConnectivityTest {
  @Test void dryRunWithInvalidToken() throws Exception {
    var credentials = System.getenv("FIREBASE_SERVICE_ACCOUNT");
    var app = FirebaseApp.initializeApp(FirebaseOptions.builder()
        .setCredentials(GoogleCredentials.fromStream(new ByteArrayInputStream(
            credentials.getBytes(StandardCharsets.UTF_8)))).build(), "modela-diagnostic");
    try {
      FirebaseMessaging.getInstance(app).send(Message.builder().setToken("invalid-test-token")
          .putData("test", "diagnostic").build(), true);
      throw new AssertionError("El token de prueba inválido fue aceptado.");
    } catch (FirebaseMessagingException ex) {
      System.out.println("Diagnóstico Firebase: " + ex.getErrorCode() + " / " + ex.getMessagingErrorCode());
      if (ex.getMessagingErrorCode() == null) throw new AssertionError("No se confirmó acceso al servicio.");
    } finally {
      app.delete();
    }
  }
}
