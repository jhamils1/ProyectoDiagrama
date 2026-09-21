package bo.edu.modela.generation;

import bo.edu.modela.diagrams.DiagramDocument;
import bo.edu.modela.diagrams.DiagramDocument.*;
import java.util.*;

/** Resolves inherited state without changing the UML or enabling source generation. */
public final class InheritancePlan {
  private InheritancePlan() {}

  public record ClassPlan(ClassData declaration, ClassData parent, ClassData root,
      List<AttributeData> attributes, AttributeData identifier) {
    public ClassPlan { attributes = List.copyOf(attributes); }
  }

  public record Result(Map<UUID, ClassPlan> classes, List<GenerationValidator.Issue> issues) {
    public Result {
      classes = Map.copyOf(classes);
      issues = List.copyOf(issues);
    }
    public boolean valid() { return issues.isEmpty(); }
  }

  public static Result analyze(DiagramDocument model) {
    Objects.requireNonNull(model, "model").validate();
    var declarations = new HashMap<UUID, ClassData>();
    model.classes().forEach(c -> declarations.put(c.id(), c));
    var parents = new HashMap<UUID, UUID>();
    model.relations().stream().filter(r -> r.type().equals("generalization"))
        .forEach(r -> parents.put(r.sourceId(), r.targetId()));
    var plans = new HashMap<UUID, ClassPlan>();
    var issues = new ArrayList<GenerationValidator.Issue>();
    for (var c : model.classes()) resolve(c, declarations, parents, plans, issues);
    return new Result(plans, issues);
  }

  private static ClassPlan resolve(ClassData c, Map<UUID, ClassData> declarations,
      Map<UUID, UUID> parents, Map<UUID, ClassPlan> plans,
      List<GenerationValidator.Issue> issues) {
    if (plans.containsKey(c.id())) return plans.get(c.id());
    var parent = parents.containsKey(c.id())
        ? resolve(declarations.get(parents.get(c.id())), declarations, parents, plans, issues) : null;
    var attributes = new ArrayList<AttributeData>();
    if (parent != null) attributes.addAll(parent.attributes());
    var names = new HashSet<String>();
    attributes.forEach(a -> names.add(a.name().toLowerCase(Locale.ROOT)));
    AttributeData identifier = parent == null ? null : parent.identifier();
    for (var a : c.attributes()) {
      if (!names.add(a.name().toLowerCase(Locale.ROOT))) {
        issues.add(new GenerationValidator.Issue("INHERITED_ATTRIBUTE_COLLISION", a.id(),
            c.name() + "." + a.name() + " repite un atributo heredado."));
      }
      if (a.identifier()) {
        if (parent != null) {
          issues.add(new GenerationValidator.Issue("INHERITED_IDENTIFIER_REDECLARED", a.id(),
              c.name() + " debe usar el identificador de la clase raiz, sin declarar otro."));
        } else {
          identifier = a;
          if (!a.dataType().equals("Long")) issues.add(new GenerationValidator.Issue(
              "IDENTIFIER_TYPE_UNSUPPORTED", a.id(), "El identificador de " + c.name() + " debe ser Long."));
        }
      }
      attributes.add(a);
    }
    if (parent == null && identifier == null) issues.add(new GenerationValidator.Issue(
        "IDENTIFIER_REQUIRED", c.id(), "Marca un atributo Long como identificador de " + c.name() + "."));
    var plan = new ClassPlan(c, parent == null ? null : parent.declaration(),
        parent == null ? c : parent.root(), attributes, identifier);
    plans.put(c.id(), plan);
    return plan;
  }
}
