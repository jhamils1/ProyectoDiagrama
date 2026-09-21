package bo.edu.modela.generation;

import bo.edu.modela.diagrams.DiagramDocument;
import bo.edu.modela.diagrams.DiagramDocument.*;
import bo.edu.modela.shared.ApiException;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class GenerationValidatorTest {
  private AttributeData attribute(String name, String type, boolean identifier) {
    return new AttributeData(UUID.randomUUID(), name, type, "private", identifier, identifier);
  }

  private ClassData clazz(String name, boolean abstractClass, AttributeData... attributes) {
    return new ClassData(UUID.randomUUID(), name, abstractClass, new Position(0d, 0d), List.of(attributes));
  }

  private DiagramDocument document(List<ClassData> classes, RelationData... relations) {
    return new DiagramDocument(1, UUID.randomUUID(), "Prueba", 0L, Instant.EPOCH, classes, List.of(relations));
  }

  private RelationData relation(ClassData a, ClassData b, String type, String source, String target) {
    return new RelationData(UUID.randomUUID(), type, a.id(), b.id(), "tiene", source, target);
  }

  @Test void acceptsClientePedidoInEitherOrientationWithoutChangingTheModel() {
    var cliente = clazz("Cliente", false, attribute("codigo", "Long", true), attribute("nombre", "String", false));
    var pedido = clazz("Pedido", false, attribute("id", "Long", true));
    var model = document(List.of(cliente, pedido), relation(cliente, pedido, "association", "1", "0..*"));
    var before = model.toString();
    assertThat(GenerationValidator.validate(model).eligible()).isTrue();
    assertThat(model.toString()).isEqualTo(before);
    assertThat(GenerationValidator.validate(document(List.of(cliente, pedido),
        relation(pedido, cliente, "association", "0..*", "1"))).eligible()).isTrue();
  }

  @Test void emptyDiagramIsNotEligible() {
    assertThat(GenerationValidator.validate(document(List.of())).issues())
        .extracting(GenerationValidator.Issue::code).containsExactly("EMPTY_DIAGRAM");
  }

  @Test void doesNotInferIdentifierFromItsNameOrInventMissingTypes() {
    var untyped = attribute("nombre", "", false);
    var c = clazz("Cliente", false, attribute("id", "Long", false), untyped);
    var result = GenerationValidator.validate(document(List.of(c)));
    assertThat(result.issues()).extracting(GenerationValidator.Issue::code)
        .containsExactly("IDENTIFIER_REQUIRED", "ATTRIBUTE_TYPE_REQUIRED");
    assertThat(result.issues()).extracting(GenerationValidator.Issue::elementId).containsExactly(c.id(), untyped.id());
  }

  @Test void rejectsNonLongIdentifierAndUnmappedTypes() {
    var c = clazz("Cliente", false, attribute("id", "Integer", true),
        attribute("valor", "Float", false), attribute("token", "UUID", false));
    assertThat(GenerationValidator.validate(document(List.of(c))).issues())
        .extracting(GenerationValidator.Issue::code)
        .containsExactly("IDENTIFIER_TYPE_UNSUPPORTED", "ATTRIBUTE_TYPE_UNSUPPORTED", "ATTRIBUTE_TYPE_UNSUPPORTED");
  }

  @Test void reportsAbstractClassAndInheritance() {
    var a = clazz("Base", true, attribute("id", "Long", true));
    var b = clazz("Hija", false, attribute("id", "Long", true));
    assertThat(GenerationValidator.validate(document(List.of(a, b), relation(b, a, "generalization", "1", "1"))).issues())
        .extracting(GenerationValidator.Issue::code)
        .containsExactly("ABSTRACT_CLASS_UNSUPPORTED", "RELATION_TYPE_UNSUPPORTED");
  }

  @Test void rejectsOtherMultiplicities() {
    var a = clazz("Cliente", false, attribute("id", "Long", true));
    var b = clazz("Pedido", false, attribute("id", "Long", true));
    for (var multiplicity : List.of("1", "1..*", "*", "0..1")) {
      assertThat(GenerationValidator.validate(document(List.of(a, b),
          relation(a, b, "association", "1", multiplicity))).issues())
          .extracting(GenerationValidator.Issue::code).containsExactly("MULTIPLICITY_UNSUPPORTED");
    }
  }

  @Test void reusesExistingValidationForBrokenReferences() {
    var a = clazz("Cliente", false, attribute("id", "Long", true));
    var absent = clazz("Pedido", false, attribute("id", "Long", true));
    assertThatThrownBy(() -> GenerationValidator.validate(document(List.of(a),
        relation(a, absent, "association", "1", "0..*"))))
        .isInstanceOf(ApiException.class);
  }

  @Test void acceptsAllAgreedTypesAndPreservesRequestedMapping() {
    var attributes = new java.util.ArrayList<AttributeData>();
    attributes.add(attribute("id", "Long", true));
    for (var type : GenerationValidator.JAVA_TYPES.keySet()) {
      attributes.add(attribute("campo" + type, type, false));
    }
    assertThat(GenerationValidator.validate(document(List.of(clazz("Ejemplo", false,
        attributes.toArray(AttributeData[]::new))))).eligible()).isTrue();
    assertThat(GenerationValidator.JAVA_TYPES).containsEntry("Decimal", "Double")
        .containsEntry("Date", "java.time.LocalDateTime").containsEntry("DateTime", "java.time.LocalDateTime");
  }
}
