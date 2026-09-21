package bo.edu.modela.generation;

import bo.edu.modela.diagrams.DiagramDocument;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/** Initial CU11 eligibility rules, independent of persistence and transport. */
public final class GenerationValidator {
  private GenerationValidator() {}

  public static final Map<String, String> JAVA_TYPES = Map.of(
      "String", "String", "Integer", "Integer", "Long", "Long",
      "Boolean", "Boolean", "Decimal", "Double", "Double", "Double",
      "Date", "java.time.LocalDateTime", "DateTime", "java.time.LocalDateTime");

  public record Issue(String code, UUID elementId, String message) {}

  public record Result(List<Issue> issues) {
    public Result { issues = List.copyOf(issues); }
    public boolean eligible() { return issues.isEmpty(); }
  }

  /** Malformed UML retains the existing MODELO_INVALIDO exception contract. */
  public static Result validate(DiagramDocument document) {
    return validate(document, true);
  }

  static Result validate(DiagramDocument document, boolean allowAbstract) {
    Objects.requireNonNull(document, "document").validate();
    var issues = new ArrayList<Issue>();
    issues.addAll(InheritancePlan.analyze(document).issues());
    if (document.classes().isEmpty()) {
      issues.add(new Issue("EMPTY_DIAGRAM", document.id(), "Agrega al menos una clase para generar."));
    }
    for (var c : document.classes()) {
      if (c.abstractClass() && !allowAbstract) {
        issues.add(new Issue("ABSTRACT_CLASS_UNSUPPORTED", c.id(),
            "La clase " + c.name() + " es abstracta; esta primera versión no admite clases abstractas."));
      }
      for (var a : c.attributes()) {
        if (a.dataType().isEmpty()) {
          issues.add(new Issue("ATTRIBUTE_TYPE_REQUIRED", a.id(),
              "Define el tipo de " + c.name() + "." + a.name() + " antes de generar."));
        } else if (!JAVA_TYPES.containsKey(a.dataType())) {
          issues.add(new Issue("ATTRIBUTE_TYPE_UNSUPPORTED", a.id(),
              "El tipo " + a.dataType() + " de " + c.name() + "." + a.name() + " aún no tiene un mapeo aprobado."));
        }

      }
    }
    for (var r : document.relations()) {
      if (r.type().equals("generalization")) continue;
      if (!((r.sourceMultiplicity().equals("1") && r.targetMultiplicity().equals("0..*"))
          || (r.sourceMultiplicity().equals("0..*") && r.targetMultiplicity().equals("1")))) {
        issues.add(new Issue("MULTIPLICITY_UNSUPPORTED", r.id(),
            "La generación inicial admite únicamente asociaciones 1 a 0..*."));
      }
    }
    return new Result(issues);
  }
}
