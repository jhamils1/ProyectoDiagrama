package bo.edu.modela.diagrams;

import bo.edu.modela.shared.ApiException;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Instant;
import java.util.*;
import org.springframework.http.HttpStatus;

public record DiagramDocument(
    Integer schemaVersion,
    UUID id,
    String name,
    Long localRevision,
    Instant updatedAt,
    List<ClassData> classes,
    List<RelationData> relations) {
  public record Position(Double x, Double y) {}

  public record AttributeData(
      UUID id,
      String name,
      String dataType,
      String visibility,
      Boolean identifier,
      Boolean required) {
    public AttributeData {
      if (dataType == null) dataType = "";
    }
  }

  public record ClassData(
      UUID id,
      String name,
      @JsonProperty("abstract") Boolean abstractClass,
      Position position,
      List<AttributeData> attributes) {}

  public record RelationData(
      UUID id,
      String type,
      UUID sourceId,
      UUID targetId,
      String name,
      String sourceMultiplicity,
      String targetMultiplicity) {}

  public DiagramDocument persisted(long revision, Instant time) {
    return new DiagramDocument(1, id, name.trim(), revision, time, classes, relations);
  }

  public boolean sameContent(DiagramDocument other) {
    return id.equals(other.id)
        && name.trim().equals(other.name)
        && classes.equals(other.classes)
        && relations.equals(other.relations);
  }

  private static void require(boolean valid, String message) {
    if (!valid) throw new ApiException(HttpStatus.BAD_REQUEST, "MODELO_INVALIDO", message);
  }

  private static boolean name(String value) {
    return value != null && value.length() <= 80 && value.matches("[A-Za-zÁÉÍÓÚÜÑáéíóúüñ_][A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9_]*");
  }

  private static boolean multiplicity(String value) {
    if (value == null || value.length() > 80 || !value.matches("(\\*|\\d+|\\d+\\.\\.(\\d+|\\*))"))
      return false;
    var parts = value.split("\\.\\.");
    return parts.length == 1
        || parts[1].equals("*")
        || new java.math.BigInteger(parts[0]).compareTo(new java.math.BigInteger(parts[1])) <= 0;
  }

  public void validate() {
    require(
        Integer.valueOf(1).equals(schemaVersion)
            && id != null
            && localRevision != null
            && localRevision >= 0
            && updatedAt != null,
        "Documento incompleto o versión de formato no admitida.");
    require(
        name != null && !name.isBlank() && name.length() <= 100, "Nombre de diagrama inválido.");
    require(
        classes != null && classes.size() <= 200 && relations != null && relations.size() <= 500,
        "Límite: 200 clases y 500 relaciones.");
    Set<UUID> ids = new HashSet<>();
    ids.add(id);
    Set<UUID> classIds = new HashSet<>();
    Set<String> classNames = new HashSet<>();
    var types =
        Set.of("String", "Integer", "Long", "Decimal", "Float", "Double", "Boolean", "Date", "DateTime", "UUID");
    var visibility = Set.of("private", "public", "protected", "package");
    for (var c : classes) {
      require(
          c != null && c.id != null && ids.add(c.id),
          "Identificador de clase duplicado o inválido.");
      require(
          name(c.name) && classNames.add(c.name.toLowerCase(Locale.ROOT)),
          "Nombre de clase inválido o duplicado.");
      classIds.add(c.id);
      require(
          c.abstractClass != null
              && c.position != null
              && c.position.x != null
              && c.position.y != null
              && Double.isFinite(c.position.x)
              && Double.isFinite(c.position.y)
              && Math.abs(c.position.x) <= 100000
              && Math.abs(c.position.y) <= 100000,
          "Posición o abstracción inválida.");
      require(
          c.attributes != null && c.attributes.size() <= 100, "Máximo 100 atributos por clase.");
      Set<String> names = new HashSet<>();
      int identifiers = 0;
      for (var a : c.attributes) {
        require(
            a != null && a.id != null && ids.add(a.id),
            "Identificador de atributo duplicado o inválido.");
        require(
            name(a.name) && names.add(a.name.toLowerCase(Locale.ROOT)),
            "Nombre de atributo inválido o duplicado.");
        require(
            a.dataType != null
                && (a.dataType.isEmpty() || types.contains(a.dataType))
                && a.visibility != null
                && visibility.contains(a.visibility),
            "Tipo o visibilidad inválidos.");
        require(
            a.identifier != null && a.required != null, "Indicadores del atributo obligatorios.");
        if (a.identifier) {
          identifiers++;
          require(a.required, "El identificador debe ser obligatorio.");
        }
      }
      require(identifiers <= 1, "Solo se admite un identificador por clase.");
    }
    Map<UUID, UUID> parents = new HashMap<>();
    Set<List<Object>> keys = new HashSet<>();
    for (var r : relations) {
      require(
          r != null && r.id != null && ids.add(r.id),
          "Identificador de relación duplicado o inválido.");
      require(
          r.type != null && Set.of("association", "generalization").contains(r.type),
          "Tipo de relación inválido.");
      require(
          classIds.contains(r.sourceId) && classIds.contains(r.targetId),
          "Ambos extremos deben pertenecer al diagrama.");
      require(
          r.name != null && r.name.length() <= 80 && r.name.equals(r.name.trim()),
          "Nombre de relación inválido.");
      require(
          multiplicity(r.sourceMultiplicity) && multiplicity(r.targetMultiplicity),
          "Multiplicidad inválida.");
      require(
          keys.add(List.of(r.type, r.sourceId, r.targetId, r.name.toLowerCase(Locale.ROOT))),
          "Relación duplicada.");
      if (r.type.equals("generalization")) {
        require(
            !r.sourceId.equals(r.targetId) && !parents.containsKey(r.sourceId),
            "Herencia propia o múltiple no admitida.");
        parents.put(r.sourceId, r.targetId);
      }
    }
    for (var origin : parents.keySet()) {
      Set<UUID> visited = new HashSet<>();
      UUID next = origin;
      while (next != null) {
        require(visited.add(next), "La herencia no puede formar ciclos.");
        next = parents.get(next);
      }
    }
  }
}
