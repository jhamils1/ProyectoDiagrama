package bo.edu.modela.ai;

import java.text.Normalizer;
import java.util.Locale;
import java.util.Set;

/** Rejects a few obvious non-answers; this does not establish factual correctness. */
final class AssistantAnswerQuality {
  static final String FALLBACK = "Actualmente no tengo una respuesta adecuada para esa pregunta. ¿Puedes reformularla o darme más detalles?";
  private static final Set<String> GREETINGS = Set.of("hola", "hola hola", "buenas", "buenos dias", "buenas tardes", "buenas noches", "saludos");
  private AssistantAnswerQuality() {}

  static String usableAnswer(String question, String answer) {
    String normalizedAnswer = normalize(answer);
    if (normalizedAnswer.isEmpty()) return FALLBACK;
    String normalizedQuestion = normalize(question);
    if (!GREETINGS.contains(normalizedQuestion) && (GREETINGS.contains(normalizedAnswer)
        || (!normalizedQuestion.isEmpty() && normalizedAnswer.equals(normalizedQuestion)))) return FALLBACK;
    // A lone restated or unrelated question is not an answer. Preserve explicit clarification requests.
    String trimmed = answer.strip();
    if (trimmed.endsWith("?") && !trimmed.matches("(?s).*[.!][\\s\\S]+")
        && !normalizedAnswer.matches("^(puedes|podrias|necesito que|para poder|que tipo|cual es el objetivo|a que clase|de que clase|sobre que clase)\\b.*")) return FALLBACK;
    return answer.strip();
  }

  private static String normalize(String text) {
    if (text == null) return "";
    return Normalizer.normalize(text, Normalizer.Form.NFD)
        .replaceAll("\\p{M}+", "").toLowerCase(Locale.ROOT)
        .replaceAll("[^\\p{L}\\p{N}]+", " ").strip().replaceAll("\\s+", " ");
  }
}
