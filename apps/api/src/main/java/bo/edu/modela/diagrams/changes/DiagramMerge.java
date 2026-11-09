package bo.edu.modela.diagrams.changes;

import bo.edu.modela.diagrams.DiagramDocument;
import bo.edu.modela.shared.ApiException;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

@Component
public class DiagramMerge {
  public record Choice(String source, Object value) {}
  public record Difference(String path, String label, Object base, Object local, Object server) {}
  public record Result(DiagramDocument document, List<Difference> conflicts) {}
  private final ObjectMapper json;
  public DiagramMerge(ObjectMapper json) { this.json = json; }

  @SuppressWarnings("unchecked")
  public Result merge(DiagramDocument base, DiagramDocument local, DiagramDocument server,
      Map<String, Choice> choices) {
    List<Difference> conflicts = new ArrayList<>();
    var b = json.convertValue(base, Map.class);
    var l = json.convertValue(local, Map.class);
    var s = json.convertValue(server, Map.class);
    for (String key : List.of("localRevision", "updatedAt")) {
      b.put(key, s.get(key)); l.put(key, s.get(key));
    }
    if (choices.containsKey("/")) {
      Object selected = select(new Difference("/", "Modelo completo", b, l, s), choices.get("/"));
      var doc = json.convertValue(selected, DiagramDocument.class);
      doc.validate();
      return new Result(doc, List.of());
    }
    Object merged = node(b, l, s, "", "Diagrama", choices, conflicts);
    var doc = json.convertValue(merged, DiagramDocument.class);
    try { doc.validate(); }
    catch (ApiException ex) {
      if (!choices.isEmpty()) throw ex;
      // Cross-field invariants need a deliberate whole-model choice, never silent data pruning.
      return new Result(server, List.of(new Difference("/",
          "Modelo completo: " + ex.getMessage(), b, l, s)));
    }
    return new Result(doc, conflicts);
  }

  @SuppressWarnings("unchecked")
  private Object node(Object base, Object local, Object server, String path, String label,
      Map<String, Choice> choices, List<Difference> conflicts) {
    if (Objects.equals(local, server)) return server;
    if (Objects.equals(base, local)) return server;
    if (Objects.equals(base, server)) return local;
    if (base instanceof Map && local instanceof Map && server instanceof Map) {
      Map<String, Object> b = (Map<String, Object>) base, l = (Map<String, Object>) local,
          s = (Map<String, Object>) server, result = new LinkedHashMap<>();
      Set<String> keys = new LinkedHashSet<>(s.keySet()); keys.addAll(l.keySet());
      String named = l.get("name") instanceof String name && !name.isBlank() ? name : label;
      for (String key : keys) {
        Object value = node(b.get(key), l.get(key), s.get(key), path + "/" + key,
            named + " · " + field(key), choices, conflicts);
        if (value != null) result.put(key, value);
      }
      return result;
    }
    if (base instanceof List && local instanceof List && server instanceof List) {
      var b = indexed((List<?>) base); var l = indexed((List<?>) local); var s = indexed((List<?>) server);
      Set<String> keys = new LinkedHashSet<>(s.keySet()); keys.addAll(l.keySet()); keys.addAll(b.keySet());
      List<Object> result = new ArrayList<>();
      for (String key : keys) {
        Object value = node(b.get(key), l.get(key), s.get(key), path + "/" + key,
            label + " · " + entityName(l.getOrDefault(key, s.getOrDefault(key, b.get(key)))), choices, conflicts);
        if (value != null) result.add(value);
      }
      return result;
    }
    var difference = new Difference(path, label, base, local, server);
    if (choices.containsKey(path)) return select(difference, choices.get(path));
    conflicts.add(difference);
    return server;
  }

  private Map<String, Object> indexed(List<?> items) {
    Map<String, Object> result = new LinkedHashMap<>();
    for (Object item : items) result.put(String.valueOf(((Map<?, ?>) item).get("id")), item);
    return result;
  }
  private String entityName(Object item) {
    return item instanceof Map<?, ?> map ? String.valueOf(map.get("name")) : "Elemento";
  }
  private String field(String key) {
    return switch (key) {
      case "name" -> "Nombre"; case "abstract" -> "Abstracta"; case "position" -> "Posición";
      case "attributes" -> "Atributos"; case "methods" -> "Métodos"; case "classes" -> "Clases"; case "relations" -> "Relaciones";
      case "returnType" -> "Tipo de retorno";
      case "dataType" -> "Tipo de dato"; case "visibility" -> "Visibilidad";
      case "identifier" -> "Identificador"; case "required" -> "Obligatorio";
      case "sourceId" -> "Origen"; case "targetId" -> "Destino"; case "type" -> "Tipo";
      case "sourceMultiplicity" -> "Multiplicidad origen";
      case "targetMultiplicity" -> "Multiplicidad destino"; default -> key;
    };
  }
  public Object select(Difference difference, Choice choice) {
    if (choice == null || choice.source() == null) throw invalid();
    return switch (choice.source()) {
      case "local" -> difference.local();
      case "server" -> difference.server();
      case "custom" -> {
        Object sample = difference.local();
        if (sample == null || sample instanceof Map || sample instanceof List
            || choice.value() == null || !simpleCompatible(sample, choice.value())) throw invalid();
        yield choice.value();
      }
      default -> throw invalid();
    };
  }
  private boolean simpleCompatible(Object a, Object b) {
    return a instanceof String && b instanceof String || a instanceof Boolean && b instanceof Boolean
        || a instanceof Number && b instanceof Number;
  }
  public static ApiException invalid() {
    return new ApiException(HttpStatus.BAD_REQUEST, "RESOLUCION_INVALIDA", "Revisa las elecciones y los valores de la resolución.");
  }
}
