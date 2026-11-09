package bo.edu.modela.ai;

import bo.edu.modela.diagrams.activity.DiagramActivityDiff.Change;
import bo.edu.modela.diagrams.activity.DiagramActivityService.Entry;
import bo.edu.modela.diagrams.activity.DiagramActivityService.Page;
import java.util.List;
import java.util.Map;
import java.util.Locale;
import java.util.UUID;
import java.text.Normalizer;
import java.util.regex.Pattern;
import bo.edu.modela.shared.ApiException;
import org.springframework.http.HttpStatus;

/** Bounded summary of committed versions, preserving missing authors and omitted changes. */
final class ActivityContext {
  private static final int MAX_CHARS = 900, MAX_CHANGES = 4;
  private static final Map<String,String> KINDS = Map.of("diagram", "diagrama", "class", "clase", "attribute", "atributo", "method", "método", "relation", "relación");
  private static final Map<String,String> FIELDS = Map.ofEntries(
      Map.entry("name", "nombre"), Map.entry("abstract", "abstracción"), Map.entry("position", "posición"),
      Map.entry("dataType", "tipo"), Map.entry("visibility", "visibilidad"), Map.entry("identifier", "identificador"),
      Map.entry("required", "obligatoriedad"), Map.entry("type", "tipo"), Map.entry("source", "origen"),
      Map.entry("target", "destino"), Map.entry("sourceMultiplicity", "multiplicidad de origen"),
      Map.entry("targetMultiplicity", "multiplicidad de destino"), Map.entry("class", "clase"), Map.entry("returnType", "tipo de retorno"),
      Map.entry("associationClass", "clase de asociación"));
  private static final List<String> VALUE_FIELDS = List.of("name", "abstract", "dataType", "visibility", "identifier", "required", "type", "sourceMultiplicity", "targetMultiplicity");
  private static final Pattern ACTIVITY_QUESTION = Pattern.compile(
      "^\\s*¿?(?:que (?:hizo|hicieron|ha hecho|han hecho|cambio|cambiaron|agrego|agregaron|cambios (?:hizo|hicieron|realizo|realizaron))|quien(?:es)? (?:hizo|hicieron|creo|crearon|agrego|agregaron|anadio|anadieron|cambio|cambiaron|elimino|eliminaron|modifico|modificaron))\\b[\\p{L}\\p{N}_ .,]{0,140}\\??\\s*$");
  private static final Pattern ADDITIONAL_ACTION = Pattern.compile("\\b(?:y|ademas)\\s+(?:crea|agrega|anade|elimina|modifica|cambia)\\b");
  private static final Pattern PERSON_QUESTION = Pattern.compile(
      "^\\s*¿?que (?:hizo|cambio|agrego|cambios hizo|cambios realizo)\\s+([\\p{L}][\\p{L} .'-]{0,89}?)\\s*\\??\\s*$");
  private static final Pattern BEFORE_VERSION = Pattern.compile("^(.*?)\\s+antes de la versi[oó]n\\s+([+-]?\\d+)\\s*\\??\\s*$", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
  private static final Pattern ACTIVITY_LIST = Pattern.compile("^\\s*¿?(?:(?:muestra|ver)\\s+)?(?:la\\s+)?actividad\\s*\\??\\s*$");
  private static final Pattern DIAGRAM_CREATOR = Pattern.compile("^\\s*¿?quien creo (?:el|este) diagrama\\s*\\??\\s*$");
  record Query(String question, Long beforeVersion) {}
  record Answer(String text, String nextQuestion) {}
  private record Rendered(String text, Long nextBeforeVersion) {}
  private ActivityContext() {}

  static boolean isActivityQuestion(String question) {
    return parse(question) != null;
  }

  static Query parse(String question) {
    String normalized = normalize(question).strip();
    var cursor = BEFORE_VERSION.matcher(normalized);
    Long before = null;
    String base = normalized;
    if (cursor.matches()) {
      base = cursor.group(1).strip();
      if (!ACTIVITY_QUESTION.matcher(base).matches() && !ACTIVITY_LIST.matcher(base).matches()) return null;
      try { before = Long.parseLong(cursor.group(2)); }
      catch (NumberFormatException ex) { throw invalidCursor(); }
      if (before < 1) throw invalidCursor();
    }
    if (ADDITIONAL_ACTION.matcher(base).find()) return null;
    if (!ACTIVITY_QUESTION.matcher(base).matches() && !ACTIVITY_LIST.matcher(base).matches()) return null;
    return new Query(base, before);
  }

  private static ApiException invalidCursor() {
    return new ApiException(HttpStatus.BAD_REQUEST, "CURSOR_INVALIDO", "La versión debe ser un número positivo válido.");
  }

  /** Exact full names or first names are used only if they identify one recorded author. */
  static String answer(Page page, String question) {
    return answerWithContinuation(page, question).text();
  }

  static Answer answerWithContinuation(Page page, String question) {
    Query parsed = parse(question);
    String base = parsed == null ? normalize(question) : parsed.question();
    if (DIAGRAM_CREATOR.matcher(base).matches()) {
      var creation = page.items().stream().filter(entry -> entry.changes().stream()
          .anyMatch(change -> change.kind().equals("diagram") && change.action().equals("created"))).findFirst();
      if (creation.isEmpty()) return new Answer("No encontré la creación del diagrama en las versiones consultadas. "
          + "Puede estar en versiones anteriores. " + nextHint(page.nextBeforeVersion(), null), nextQuestion(page.nextBeforeVersion(), null));
      var entry = creation.get();
      if (entry.authorId() == null || entry.authorName() == null || entry.authorName().isBlank())
        return new Answer("La versión " + entry.version() + " registra la creación del diagrama, pero su autor no registrado impide identificar quién lo creó.", null);
      return new Answer("Según la actividad registrada, " + clean(entry.authorName(), 90) + " creó el diagrama en la versión " + entry.version() + ".", null);
    }
    var match = PERSON_QUESTION.matcher(base);
    if (!match.matches()) return withNext(render(page), null);
    String person = match.group(1).strip().replaceFirst("\\s+en (?:el|este) diagrama$", "").strip();
    if (person.equals("mi compañero") || person.equals("mi companero") || person.equals("mi companera")
        || person.equals("el equipo") || person.equals("mi colega") || person.equals("el compañero") || person.equals("el companero")
        || person.contains(" y "))
      return withNext(render(page), null);
    var candidates = page.items().stream().filter(e -> e.authorId() != null && e.authorName() != null && !e.authorName().isBlank())
        .filter(e -> { String name = normalize(e.authorName()); return name.equals(person) || name.startsWith(person + " "); })
        .map(Entry::authorId).distinct().toList();
    String scope = parsed != null && parsed.beforeVersion() != null
        ? "Se consultaron hasta 20 versiones anteriores al límite indicado; puede haber cambios anteriores o autores no registrados. El nombre se verifica solo en este tramo."
        : "Se consultaron hasta 20 versiones recientes; puede haber cambios anteriores o autores no registrados. El nombre se verifica solo en este tramo.";
    if (candidates.isEmpty()) return new Answer("No encontré cambios atribuidos a «" + clean(person, 90)
        + "» en las versiones consultadas. " + scope + nextHint(page.nextBeforeVersion(), person), nextQuestion(page.nextBeforeVersion(), person));
    if (candidates.size() > 1) return new Answer("Hay varias personas con ese nombre en las versiones consultadas y no puedo distinguirlas con seguridad. " + scope, null);
    UUID authorId = candidates.getFirst();
    List<Entry> matching = page.items().stream().filter(e -> authorId.equals(e.authorId())).toList();
    var partial = withNext(render(new Page(matching, page.nextBeforeVersion())), person);
    return new Answer("Cambios registrados para esa persona:\n" + partial.text() + scope, partial.nextQuestion());
  }

  static String format(Page page) {
    return render(page).text();
  }

  private static Answer withNext(Rendered rendered, String person) {
    return new Answer(rendered.text() + "Este resumen no necesariamente contiene toda la actividad del diagrama. "
        + nextHint(rendered.nextBeforeVersion(), person), nextQuestion(rendered.nextBeforeVersion(), person));
  }

  private static String nextHint(Long before, String person) {
    String question = nextQuestion(before, person);
    return question == null ? "" : "Para continuar, pregunta: «" + question + "». ";
  }

  private static String nextQuestion(Long before, String person) {
    if (before == null) return null;
    return (person == null ? "Actividad" : "Qué hizo " + clean(person, 90)) + " antes de la versión " + before;
  }

  private static Rendered render(Page page) {
    StringBuilder result = new StringBuilder("Actividad confirmada reciente (puede estar incompleta):\n");
    if (page.items().isEmpty()) return new Rendered(result.append("No hay versiones en el tramo consultado.\n").toString(), page.nextBeforeVersion());
    boolean truncated = page.nextBeforeVersion() != null;
    boolean omittedDetails = false;
    Long lastDisplayed = null;
    Long nextBefore = page.nextBeforeVersion();
    for (Entry entry : page.items()) {
      String author = entry.authorId() == null || entry.authorName() == null || entry.authorName().isBlank()
          ? "autor no registrado" : clean(entry.authorName(), 90);
      StringBuilder line = new StringBuilder("Versión ").append(entry.version()).append("; fecha ")
          .append(entry.createdAt()).append("; ").append(author).append(": ");
      int count = Math.min(MAX_CHANGES, entry.changes().size());
      if (count == 0) line.append("sin cambios de contenido detectados");
      for (int i=0; i<count; i++) {
        if (i>0) line.append("; ");
        line.append(describe(entry.changes().get(i)));
      }
      if (entry.totalChanges() > count) line.append("; otros cambios omitidos");
      line.append(".\n");
      if (result.length() + line.length() + 130 > MAX_CHARS && lastDisplayed != null) {
        truncated = true; nextBefore = lastDisplayed; break;
      }
      result.append(line);
      if (entry.totalChanges() > count) omittedDetails = true;
      lastDisplayed = entry.version();
    }
    if (truncated) result.append("Hay versiones o cambios anteriores omitidos.\n");
    if (omittedDetails) result.append("Para ver todos los cambios, abre Actividad del diagrama.\n");
    return new Rendered(result.toString(), nextBefore);
  }

  private static String describe(Change change) {
    String kind = KINDS.getOrDefault(change.kind(), "elemento");
    String label = clean(change.label(), 70);
    return switch (change.action()) {
      case "created" -> "creó " + kind + " " + label;
      case "deleted" -> "eliminó " + kind + " " + label;
      case "unavailable" -> "no se puede comparar: falta la versión anterior";
      case "updated" -> {
        String field = FIELDS.getOrDefault(change.property(), "propiedad");
        String details = VALUE_FIELDS.contains(change.property())
            ? " (de " + clean(change.before(), 35) + " a " + clean(change.after(), 35) + ")" : "";
        yield "cambió " + field + " de " + kind + " " + label + details;
      }
      default -> "cambió " + kind + " " + label;
    };
  }

  private static String clean(String value, int max) {
    if (value == null || value.isBlank()) return "sin valor";
    String compact = value.replaceAll("[\\p{Cntrl}\\s]+", " ").strip();
    return compact.length() <= max ? compact : compact.substring(0, max - 1) + "…";
  }

  private static String normalize(String value) {
    return Normalizer.normalize(value, Normalizer.Form.NFD).replaceAll("\\p{M}+", "").toLowerCase(Locale.ROOT);
  }
}
