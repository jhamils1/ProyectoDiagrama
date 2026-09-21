package bo.edu.modela.interoperability;

import bo.edu.modela.diagrams.DiagramDocument;
import bo.edu.modela.diagrams.DiagramDocument.*;
import bo.edu.modela.shared.ApiException;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class EaXmiWriterTest {
  private ClassData clazz(String name, boolean abstractClass, List<AttributeData> attrs) {
    return new ClassData(UUID.randomUUID(), name, abstractClass, new Position(10d, 20d), attrs);
  }
  private AttributeData attr(String name, String type, String visibility, boolean id, boolean required) {
    return new AttributeData(UUID.randomUUID(), name, type, visibility, id, required);
  }
  private DiagramDocument model(List<ClassData> classes, List<RelationData> relations) {
    return new DiagramDocument(1, UUID.randomUUID(), "Modelo & <prueba> \"ñ\"", 0L, Instant.EPOCH, classes, relations);
  }

  @Test void roundTripPreservesClassesTypesFlagsRelationsAndDoesNotMutate() {
    var base = clazz("Cliente", true, List.of(attr("id", "Long", "private", true, true),
        attr("nombre", "String", "protected", false, false)));
    var child = clazz("ClientePremium", false, List.of());
    var order = clazz("Pedido", false, List.of(attr("total", "Decimal", "public", false, true)));
    var doc = model(List.of(base, child, order), List.of(
        new RelationData(UUID.randomUUID(), "generalization", child.id(), base.id(), "", "1", "1"),
        new RelationData(UUID.randomUUID(), "association", base.id(), order.id(), "tiene", "1", "0..*")));
    var before = doc.toString();
    var xml = EaXmiWriter.write(doc);
    assertThat(EaXmiWriter.write(doc)).isEqualTo(xml);
    var inventory = EaXmiReader.read(xml);
    assertThat(inventory.issues()).isEmpty();
    var result = EaXmiConverter.preview(xml, doc.name());
    assertThat(result.ready()).isTrue();
    for (int i = 0; i < doc.classes().size(); i++) {
      var actual = result.document().classes().get(i);
      var expected = doc.classes().get(i);
      assertThat(actual.name()).isEqualTo(expected.name());
      assertThat(actual.abstractClass()).isEqualTo(expected.abstractClass());
      assertThat(actual.attributes()).usingRecursiveComparison().ignoringFields("id").isEqualTo(expected.attributes());
    }
    var byId = new HashMap<UUID, String>();
    result.document().classes().forEach(c -> byId.put(c.id(), c.name()));
    assertThat(result.document().relations()).anySatisfy(r -> {
      assertThat(r.type()).isEqualTo("generalization");
      assertThat(byId.get(r.sourceId())).isEqualTo("ClientePremium");
      assertThat(byId.get(r.targetId())).isEqualTo("Cliente");
    }).anySatisfy(r -> {
      assertThat(r.name()).isEqualTo("tiene");
      assertThat(byId.get(r.sourceId())).isEqualTo("Cliente");
      assertThat(byId.get(r.targetId())).isEqualTo("Pedido");
      assertThat(r.sourceMultiplicity()).isEqualTo("1");
      assertThat(r.targetMultiplicity()).isEqualTo("0..*");
    });
    assertThat(doc.toString()).isEqualTo(before);
  }

  @Test void exportsEveryEditorTypeIncludingUntypedAttributesAndVisibility() {
    var types = List.of("", "String", "Integer", "Long", "Decimal", "Float", "Double", "Boolean", "Date", "DateTime", "UUID");
    var attrs = new ArrayList<AttributeData>();
    var visibility = List.of("public", "private", "protected", "package");
    for (int i = 0; i < types.size(); i++) attrs.add(attr("campo" + i, types.get(i), visibility.get(i % 4), false, i % 2 == 0));
    var inventory = EaXmiReader.read(EaXmiWriter.write(model(List.of(clazz("Ejemplo", false, attrs)), List.of())));
    assertThat(inventory.issues()).isEmpty();
    assertThat(inventory.classes().getFirst().attributes()).extracting(EaXmiReader.Attribute::mappedType).containsExactlyElementsOf(types);
  }

  @Test void multiplicityStarHasEquivalentZeroToManyMeaning() {
    var a = clazz("Nodo", false, List.of());
    for (var mult : List.of("*", "0..1", "1..*", "2..5", "1")) {
      var relation = new RelationData(UUID.randomUUID(), "association", a.id(), a.id(), "", mult, "1");
      var inventory = EaXmiReader.read(EaXmiWriter.write(model(List.of(a), List.of(relation))));
      assertThat(inventory.issues()).isEmpty();
      assertThat(inventory.relations().getFirst().sourceMultiplicity()).isEqualTo(mult.equals("*") ? "0..*" : mult);
    }
  }

  @Test void rejectsInvalidModelBeforeWriting() {
    var a = clazz("Nodo", false, List.of());
    var relation = new RelationData(UUID.randomUUID(), "association", a.id(), UUID.randomUUID(), "", "1", "0..*");
    assertThatThrownBy(() -> EaXmiWriter.write(model(List.of(a), List.of(relation)))).isInstanceOf(ApiException.class);
  }
}
