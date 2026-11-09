package bo.edu.modela.ai;

import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

/** Server-only provider adapter. No credentials or provider response bodies are logged. */
@Component
public class GeminiClient {
  private final String key, model;
  private final ObjectMapper json;
  private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

  public GeminiClient(@Value("${modela.ai.gemini-api-key:}") String key,
      @Value("${modela.ai.gemini-model:gemini-3.5-flash-lite}") String model, ObjectMapper json) {
    this.key = key.strip(); this.model = model.strip(); this.json = json;
  }
  public boolean configured() { return !key.isBlank() && model.matches("[a-zA-Z0-9._-]{1,100}"); }
  public String generate(List<SharedAssistantService.PromptMessage> messages) {
    if (!configured()) throw new IllegalStateException("Proveedor no configurado");
    try {
      var body = requestBody(messages);
      var request = HttpRequest.newBuilder(URI.create("https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent"))
          .timeout(Duration.ofSeconds(60)).header("Content-Type", "application/json").header("x-goog-api-key", key)
          .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body))).build();
      var response = http.send(request, HttpResponse.BodyHandlers.ofString());
      if (response.statusCode() != 200 || response.body().length() > 100000) throw new IllegalStateException("Proveedor no disponible");
      return extractText(response.body());
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt(); throw new IllegalStateException("Consulta interrumpida");
    } catch (Exception e) { throw new IllegalStateException("No se pudo consultar el proveedor"); }
  }

  static Map<String, Object> requestBody(List<SharedAssistantService.PromptMessage> messages) {
    return Map.of("system_instruction", Map.of("parts", List.of(Map.of("text", messages.get(0).content()))),
        "contents", List.of(Map.of("role", "user", "parts", List.of(Map.of("text", messages.get(1).content())))),
        "generationConfig", Map.of("maxOutputTokens", 1024));
  }

  String extractText(String body) {
      var parts = json.readTree(body).path("candidates").path(0).path("content").path("parts");
      StringBuilder result = new StringBuilder();
      for (var part : parts) if (!part.path("thought").asBoolean(false)) result.append(part.path("text").asString(""));
      String text = result.toString().strip();
      if (text.isEmpty() || text.length() > 4000) throw new IllegalStateException("Respuesta no disponible");
      return text;
  }
}
