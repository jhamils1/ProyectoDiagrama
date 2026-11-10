package bo.edu.modela.ai;

import java.text.Normalizer;
import java.util.Locale;
import java.util.Set;

/** Rejects a few obvious non-answers; this does not establish factual correctness. */
final class AssistantAnswerQuality {
  static final String FALLBACK = "Actualmente no tengo una respuesta adecuada para esa pregunta. ¿Puedes reformularla o darme más detalles?";
  private static final Set<String> GREETINGS = Set.of("hola", "hola hola", "buenas", "buenos dias", "buenas tardes", "buenas noches", "saludos");
  enum Outcome { EMPTY, FALLBACK, GREETING, REPEATED_QUESTION, QUESTION_ONLY, ACCEPTED }
  record Result(String text, Outcome outcome) {}
  private AssistantAnswerQuality() {}

  static String usableAnswer(String question, String answer) {
    return assess(question, answer).text();
  }

  static Result assess(String question, String answer) {
    String original = answer == null ? "" : answer.strip();
    String assessed = original.replaceFirst("(?s)(?:^|\\n\\s*\\n)(?:Se omitió el historial anterior para esta respuesta\\.|Se omitió parte del contexto anterior\\.)\\s*$", "").strip();
    String normalizedAnswer = normalize(assessed);
    if (normalizedAnswer.isEmpty()) return new Result(FALLBACK, Outcome.EMPTY);
    if (FALLBACK.equals(assessed) || assessed.equals("Actualmente no tengo una respuesta adecuada para esa pregunta.")) return new Result(FALLBACK, Outcome.FALLBACK);
    String normalizedQuestion = normalize(question);
    if (!GREETINGS.contains(normalizedQuestion) && GREETINGS.contains(normalizedAnswer)) return new Result(FALLBACK, Outcome.GREETING);
    if (!normalizedQuestion.isEmpty() && !GREETINGS.contains(normalizedQuestion) && normalizedAnswer.equals(normalizedQuestion))
      return new Result(FALLBACK, Outcome.REPEATED_QUESTION);
    // A lone restated or unrelated question is not an answer. Preserve explicit clarification requests.
    String trimmed = assessed;
    if (trimmed.endsWith("?") && !trimmed.matches("(?s).*[.!][\\s\\S]+")
        && !normalizedAnswer.matches("^(puedes|podrias|necesito que|para poder|que tipo|cual es el objetivo|a que clase|de que clase|sobre que clase)\\b.*")) return new Result(FALLBACK, Outcome.QUESTION_ONLY);
    return new Result(original, Outcome.ACCEPTED);
  }

  private static String normalize(String text) {
    if (text == null) return "";
    return Normalizer.normalize(text, Normalizer.Form.NFD)
        .replaceAll("\\p{M}+", "").toLowerCase(Locale.ROOT)
        .replaceAll("[^\\p{L}\\p{N}]+", " ").strip().replaceAll("\\s+", " ");
  }
}
