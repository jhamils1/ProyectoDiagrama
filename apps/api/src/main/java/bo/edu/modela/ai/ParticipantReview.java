package bo.edu.modela.ai;

import bo.edu.modela.diagrams.DiagramDocument;
import bo.edu.modela.diagrams.activity.DiagramActivityService.Page;
import java.text.Normalizer;
import java.util.*;
import java.util.regex.Pattern;

/** Reviews current elements touched by one identified author in the bounded activity page. */
final class ParticipantReview {
  private static final Pattern REVIEW = Pattern.compile(
      "^\\s*¿?(?:(?:puedes|podrias)\\s+)?(?:revisa|revisar|analiza|analizar|evalua|evaluar)\\s+(?:(mi trabajo|mis cambios)|(?:el trabajo|los cambios) de ([\\p{L}][\\p{L} .'-]{0,89})|lo que (?:hizo|cambio|modifico) ([\\p{L}][\\p{L} .'-]{0,89}))\\s*[?.!]*\\s*$");
  private ParticipantReview() {}

  static boolean matches(String text) { return REVIEW.matcher(normalize(text)).matches(); }

  static String answer(Page page, DiagramDocument doc, String question, UUID requester) {
    var match = REVIEW.matcher(normalize(question));
    if (!match.matches()) return "No pude identificar la solicitud de revisión.";
    boolean own = match.group(1) != null;
    String person = own ? "" : (match.group(2) != null ? match.group(2) : match.group(3)).strip();
    var candidates = page.items().stream().filter(e -> e.authorId() != null && e.authorName() != null)
        .filter(e -> own ? e.authorId().equals(requester) : normalize(e.authorName()).equals(person) || normalize(e.authorName()).startsWith(person + " "))
        .map(e -> e.authorId()).distinct().toList();
    if (candidates.isEmpty()) return own
        ? "No encontré cambios tuyos en las versiones recientes. Puedes consultar la actividad anterior del diagrama."
        : "No encontré cambios de esa persona en las versiones recientes. Comprueba su nombre o consulta la actividad anterior.";
    if (candidates.size() > 1) return "Encontré varias personas con ese nombre. Escribe su nombre completo para saber a quién revisar.";
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
    var result = new StringBuilder("Revisé los cambios recientes de ").append(entries.getFirst().authorName()).append(".\n\nCambios encontrados:");
    int shown = 0;
    for (var entry : entries) {
      for (var change : entry.changes()) {
        if (shown == 6) break;
        result.append("\n- ").append(ActivityContext.describe(change)).append(" (versión ").append(entry.version()).append(").");
        shown++;
      }
      if (shown == 6) break;
    }
    long recorded = entries.stream().mapToLong(e -> e.changes().size()).sum();
    if (shown == 0) result.append("\n- No encontré detalles de cambios para mostrar.");
    if (recorded > shown) result.append("\n- Hay más cambios; puedes verlos en Actividad del diagrama.");
    if (visible == 0) result.append("\n\nNo pude revisar esos cambios porque falta la versión anterior para compararlos.");
    else if (!currentElement[0]) result.append("\n\nNo pude revisar clases, atributos ni métodos actuales de estos cambios. Es posible que se hayan eliminado o que los cambios sean de otro tipo.");
    else if (findings.isEmpty()) result.append("\n\nNo encontré problemas con las comprobaciones básicas que hice.");
    else {
      result.append("\n\nSugerencias para revisar:");
      findings.stream().limit(5).forEach(f -> result.append("\n- ").append(f));
      if (findings.size() > 5) result.append("\nHay más observaciones; revisa los elementos en el diagrama.");
    }
    if (incomplete) result.append("\n\nSolo pude consultar parte de la actividad; puede haber cambios anteriores u otras personas con un nombre parecido.");
    result.append("\n\nRevisé el diagrama actual, que otras personas pudieron modificar después. No comprobé todas las reglas del proyecto.");
    return result.toString();
  }

  private static String normalize(String text) {
    return Normalizer.normalize(text, Normalizer.Form.NFD).replaceAll("\\p{M}+", "").toLowerCase(Locale.ROOT);
  }
}
