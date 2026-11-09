package bo.edu.modela.ai;

import bo.edu.modela.diagrams.DiagramDocument;
import bo.edu.modela.diagrams.activity.DiagramActivityService.Page;
import java.text.Normalizer;
import java.util.*;
import java.util.regex.Pattern;

/** Reviews current elements touched by one identified author in the bounded activity page. */
final class ParticipantReview {
  private static final Pattern REVIEW = Pattern.compile(
      "^\\s*¿?(?:(?:puedes|podrias)\\s+)?(?:revisa|revisar|analiza|analizar)\\s+(?:mi trabajo|mis cambios|(?:el trabajo|los cambios|lo que hizo) de [\\p{L}][\\p{L} .'-]{0,89})\\s*[?.!]*\\s*$");
  private ParticipantReview() {}

  static boolean matches(String text) { return REVIEW.matcher(normalize(text)).matches(); }

  static String answer(Page page, DiagramDocument doc, String question, UUID requester) {
    String q = normalize(question).strip().replaceAll("[?.!]+$", "").strip();
    boolean own = q.endsWith("mi trabajo") || q.endsWith("mis cambios");
    String person = own ? "" : q.substring(q.lastIndexOf(" de ") + 4).strip();
    var candidates = page.items().stream().filter(e -> e.authorId() != null && e.authorName() != null)
        .filter(e -> own ? e.authorId().equals(requester) : normalize(e.authorName()).equals(person) || normalize(e.authorName()).startsWith(person + " "))
        .map(e -> e.authorId()).distinct().toList();
    if (candidates.isEmpty()) return "No encontré cambios de esa persona en las versiones consultadas. Revisa la actividad anterior o indica su nombre completo.";
    if (candidates.size() > 1) return "Hay varias personas con ese nombre en las versiones consultadas. Indica su nombre completo para distinguirlas.";
    UUID author = candidates.getFirst();
    var entries = page.items().stream().filter(e -> author.equals(e.authorId())).toList();
    var ids = new HashSet<UUID>();
    boolean incomplete = page.nextBeforeVersion() != null;
    for (var entry : entries) {
      if (entry.totalChanges() > entry.changes().size()) incomplete = true;
      for (var change : entry.changes()) {
        if (change.action().equals("unavailable")) incomplete = true;
        if (change.elementId() != null && !change.action().equals("deleted")) ids.add(change.elementId());
      }
    }
    var findings = new ArrayList<String>();
    boolean[] currentElement = {false};
    for (var c : doc.classes()) {
      if (ids.contains(c.id()) || c.attributes().stream().anyMatch(a -> ids.contains(a.id()))
          || c.methods().stream().anyMatch(m -> ids.contains(m.id()))) currentElement[0] = true;
      if (ids.contains(c.id()) && c.attributes().isEmpty() && c.methods().isEmpty())
        findings.add("La clase " + c.name() + " no tiene atributos ni métodos; comprueba si necesita alguno.");
      for (var a : c.attributes()) if ((ids.contains(c.id()) || ids.contains(a.id())) && a.dataType().isBlank())
        findings.add("El atributo " + c.name() + "." + a.name() + " no tiene tipo definido.");
      for (var m : c.methods()) if ((ids.contains(c.id()) || ids.contains(m.id())) && m.returnType().isBlank())
        findings.add("El método " + c.name() + "." + m.name() + "() no tiene tipo de retorno; usa void si no devuelve valor.");
    }
    long visible = entries.stream().flatMap(e -> e.changes().stream()).filter(c -> !c.action().equals("unavailable")).count();
    var result = new StringBuilder("Revisión básica de cambios registrados de ").append(entries.getFirst().authorName()).append(":\n");
    result.append(ActivityContext.answer(new Page(entries, page.nextBeforeVersion()), "Qué hizo " + entries.getFirst().authorName()));
    if (visible == 0) result.append("\nNo hay cambios comparables para revisar en este tramo.");
    else if (!currentElement[0]) result.append("\nNo hay clases, atributos o métodos actuales identificados para estas comprobaciones; los cambios pueden ser de otro tipo o los elementos ya no existir.");
    else if (findings.isEmpty()) result.append("\nNo encontré observaciones con estas comprobaciones básicas en los elementos actuales identificados.");
    else {
      result.append("\nObservaciones sobre el estado actual (son sugerencias):");
      findings.stream().limit(5).forEach(f -> result.append("\n- ").append(f));
      if (findings.size() > 5) result.append("\nHay más observaciones; revisa los elementos en el diagrama.");
    }
    if (incomplete) result.append("\nLa actividad consultada es parcial o tiene versiones sin comparación.");
    result.append("\nLa revisión usa el diagrama actual, que otras personas pudieron modificar después; no determina si el trabajo está correcto ni revisa reglas de negocio.");
    return result.toString();
  }

  private static String normalize(String text) {
    return Normalizer.normalize(text, Normalizer.Form.NFD).replaceAll("\\p{M}+", "").toLowerCase(Locale.ROOT);
  }
}
