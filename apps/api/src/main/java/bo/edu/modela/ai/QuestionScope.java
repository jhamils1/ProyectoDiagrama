package bo.edu.modela.ai;

import bo.edu.modela.diagrams.DiagramDocument;
import java.text.Normalizer;
import java.util.Locale;
import java.util.regex.Pattern;

/** Conservative classification: never guess a diagram dependency from ambiguous text. */
public final class QuestionScope {
  private QuestionScope() {}

  public static String classify(String question, DiagramDocument document) {
    String text = normalize(question);
    if (ActivityContext.parse(question) != null || ParticipantReview.matches(question)) return "ACTIVIDAD";
    if (Pattern.compile("\\b(este diagrama|mi diagrama|nuestro diagrama|del diagrama|en el diagrama|la pizarra|modelo actual|modelo de este proyecto|este modelo|mi modelo|nuestro modelo|mi proyecto|este proyecto|nuestro proyecto)\\b").matcher(text).find()) return "DIAGRAMA";
    if (document != null && document.classes() != null) {
      for (var item : document.classes()) {
        String name = normalize(item.name());
        if (!name.isBlank() && Pattern.compile("\\bclase\\s+" + Pattern.quote(name) + "\\b").matcher(text).find()) return "DIAGRAMA";
      }
    }
    if (UmlConcepts.answer(question) != null || text.matches("^(que es|que significa|explica|define)\\s+(una?|el|la|los|las)\\s+.+")) return "CONCEPTO";
    if (Pattern.compile("\\b(diagrama|pizarra)\\b").matcher(text).find()) return "DIAGRAMA";
    return "DESCONOCIDO";
  }

  private static String normalize(String text) {
    if (text == null) return "";
    return Normalizer.normalize(text, Normalizer.Form.NFD).replaceAll("\\p{M}+", "")
        .toLowerCase(Locale.ROOT).replaceAll("[^\\p{L}\\p{N}_]+", " ").strip();
  }
}
