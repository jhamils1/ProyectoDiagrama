package bo.edu.modela.generation;

import bo.edu.modela.diagrams.DiagramDocument;
import bo.edu.modela.diagrams.DiagramDocument.*;
import bo.edu.modela.shared.ApiException;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class InheritancePlanTest {
  private AttributeData attr(String name, String type, boolean id) {
    return new AttributeData(UUID.randomUUID(), name, type, "private", id, true);
  }
  private ClassData clazz(String name, AttributeData... attrs) {
    return new ClassData(UUID.randomUUID(), name, false, new Position(0d, 0d), List.of(attrs));
  }
  private RelationData inherits(ClassData child, ClassData parent) {
    return new RelationData(UUID.randomUUID(), "generalization", child.id(), parent.id(), "", "1", "1");
  }
  private DiagramDocument model(List<ClassData> classes, RelationData... relations) {
    return new DiagramDocument(1, UUID.randomUUID(), "Herencia", 0L, Instant.EPOCH, classes, List.of(relations));
  }

  @Test void resolvesMultipleLevelsRegardlessOfClassOrderWithoutMutatingModel() {
    var id = attr("codigo", "Long", true);
    var name = attr("nombre", "String", false);
    var base = clazz("Cliente", id, name);
    var points = attr("puntos", "Integer", false);
    var child = clazz("Premium", points);
    var leaf = clazz("Especial");
    var doc = model(List.of(leaf, child, base), inherits(child, base), inherits(leaf, child));
    var before = doc.toString();
    var result = InheritancePlan.analyze(doc);
    assertThat(result.valid()).isTrue();
    var plan = result.classes().get(leaf.id());
    assertThat(plan.parent()).isEqualTo(child);
    assertThat(plan.root()).isEqualTo(base);
    assertThat(plan.identifier()).isEqualTo(id);
    assertThat(plan.attributes()).containsExactly(id, name, points);
    assertThat(doc.toString()).isEqualTo(before);
  }

  @Test void rejectsOwnIdentifierAndShadowedInheritedAttribute() {
    var base = clazz("Cliente", attr("id", "Long", true), attr("nombre", "String", false));
    var child = clazz("Premium", attr("otroId", "Long", true), attr("Nombre", "String", false));
    assertThat(InheritancePlan.analyze(model(List.of(base, child), inherits(child, base))).issues())
        .extracting(GenerationValidator.Issue::code)
        .containsExactly("INHERITED_IDENTIFIER_REDECLARED", "INHERITED_ATTRIBUTE_COLLISION");
  }

  @Test void doesNotInferOrInventRootIdentifier() {
    var base = clazz("Cliente", attr("id", "Long", false));
    var child = clazz("Premium");
    var result = InheritancePlan.analyze(model(List.of(base, child), inherits(child, base)));
    assertThat(result.issues()).extracting(GenerationValidator.Issue::code).containsExactly("IDENTIFIER_REQUIRED");
    assertThat(result.classes().get(child.id()).identifier()).isNull();
  }

  @Test void validatesRootIdentifierType() {
    assertThat(InheritancePlan.analyze(model(List.of(clazz("Cliente", attr("id", "Integer", true))))).issues())
        .extracting(GenerationValidator.Issue::code).containsExactly("IDENTIFIER_TYPE_UNSUPPORTED");
  }

  @Test void reusesUmlValidationForCyclesAndMultipleParents() {
    var a = clazz("A", attr("id", "Long", true));
    var b = clazz("B");
    var c = clazz("C", attr("id", "Long", true));
    assertThatThrownBy(() -> InheritancePlan.analyze(model(List.of(a, b), inherits(a, b), inherits(b, a))))
        .isInstanceOf(ApiException.class);
    assertThatThrownBy(() -> InheritancePlan.analyze(model(List.of(a, b, c), inherits(b, a), inherits(b, c))))
        .isInstanceOf(ApiException.class);
  }

  @Test void associationDoesNotCreateInheritance() {
    var a = clazz("Cliente", attr("id", "Long", true));
    var b = clazz("Pedido", attr("id", "Long", true));
    var relation = new RelationData(UUID.randomUUID(), "association", a.id(), b.id(), "", "1", "0..*");
    var result = InheritancePlan.analyze(model(List.of(a, b), relation));
    assertThat(result.valid()).isTrue();
    assertThat(result.classes().get(b.id()).parent()).isNull();
    assertThat(result.classes().get(b.id()).attributes()).containsExactlyElementsOf(b.attributes());
  }
}
