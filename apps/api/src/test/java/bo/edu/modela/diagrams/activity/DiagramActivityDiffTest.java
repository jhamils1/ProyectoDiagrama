package bo.edu.modela.diagrams.activity;

import static org.assertj.core.api.Assertions.*;
import bo.edu.modela.diagrams.DiagramDocument;
import bo.edu.modela.diagrams.DiagramDocument.*;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.Test;

class DiagramActivityDiffTest {
  private final UUID diagram = UUID.randomUUID(), product = UUID.randomUUID(), sale = UUID.randomUUID();
  private final UUID attr = UUID.randomUUID(), relation = UUID.randomUUID();
  private ClassData product(String name, String type, Position pos) {
    return new ClassData(product, name, false, pos,
        List.of(new AttributeData(attr, "precio", type, "private", false, false)));
  }
  private DiagramDocument doc(ClassData productClass, String multiplicity) {
    return new DiagramDocument(1, diagram, "Modelo", 0L, Instant.EPOCH,
        List.of(productClass, new ClassData(sale, "Venta", false, new Position(0d, 0d), List.of())),
        List.of(new RelationData(relation, "association", sale, product, "incluye", "*", multiplicity)));
  }

  @Test void describesFieldsByIdentityIncludingMultiplicityAndMovement() {
    var before = doc(product("Producto", "Integer", new Position(1d, 2d)), "1");
    var after = doc(product("Articulo", "Decimal", new Position(5d, 2d)), "1..*");
    var changes = DiagramActivityDiff.between(before, after);
    assertThat(changes).hasSize(4);
    assertThat(changes).extracting(DiagramActivityDiff.Change::property)
        .containsExactly("name", "position", "dataType", "targetMultiplicity");
    assertThat(changes.get(2).label()).isEqualTo("Articulo.precio");
    assertThat(changes.get(2).before()).isEqualTo("Integer");
    assertThat(changes.get(3).after()).isEqualTo("1..*");
  }

  @Test void ignoresRevisionTimeAndOrderingButDetectsAdditionsAndDeletions() {
    var original = doc(product("Producto", "Decimal", new Position(0d, 0d)), "1");
    var reversed = new DiagramDocument(1, diagram, "Modelo", 4L, Instant.now(),
        original.classes().reversed(), original.relations());
    assertThat(DiagramActivityDiff.between(original, reversed)).isEmpty();
    var empty = new DiagramDocument(1, diagram, "Modelo", 0L, Instant.EPOCH, List.of(), List.of());
    assertThat(DiagramActivityDiff.between(empty, original)).hasSize(4)
        .allMatch(c -> c.action().equals("created"));
    assertThat(DiagramActivityDiff.between(original, empty)).hasSize(4)
        .allMatch(c -> c.action().equals("deleted"));
    assertThat(DiagramActivityDiff.between(null, original)).hasSize(1);
  }

  @Test void detectsAssociationClassWithoutInventingAnExtraClass() {
    var original = doc(product("Producto", "Decimal", new Position(0d, 0d)), "1..*");
    var r = original.relations().getFirst();
    var after = new DiagramDocument(1, diagram, "Modelo", 1L, Instant.EPOCH, original.classes(),
        List.of(new RelationData(r.id(), r.type(), r.sourceId(), r.targetId(), r.name(),
            r.sourceMultiplicity(), r.targetMultiplicity(), UUID.randomUUID())));
    assertThat(DiagramActivityDiff.between(original, after)).singleElement()
        .satisfies(c -> assertThat(c.property()).isEqualTo("associationClass"));
  }
}
