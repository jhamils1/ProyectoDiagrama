package bo.edu.modela.ai;

import static org.assertj.core.api.Assertions.*;
import java.util.List;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

class GeminiClientTest {
  private final GeminiClient client = new GeminiClient("clave-prueba", "gemini-3.5-flash-lite", new ObjectMapper());
  @Test void formatsInstructionsAndReadsTextWithoutIncludingThoughts() {
    var request = GeminiClient.requestBody(List.of(new SharedAssistantService.PromptMessage("system", "Reglas"),
        new SharedAssistantService.PromptMessage("user", "Contexto y pregunta")));
    assertThat(request.toString()).contains("Reglas", "Contexto y pregunta", "maxOutputTokens");
    assertThat(client.extractText("{\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"privado\",\"thought\":true},{\"text\":\"Respuesta\"}]}}]}"))
        .isEqualTo("Respuesta");
    assertThatThrownBy(() -> client.extractText("{\"candidates\":[]}")) .isInstanceOf(IllegalStateException.class);
    assertThat(new GeminiClient("", "gemini-3.5-flash-lite", new ObjectMapper()).configured()).isFalse();
    assertThat(new GeminiClient("clave", "../../no", new ObjectMapper()).configured()).isFalse();
  }
}
