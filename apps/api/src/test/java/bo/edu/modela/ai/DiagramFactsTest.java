package bo.edu.modela.ai;

import static org.assertj.core.api.Assertions.assertThat;

import bo.edu.modela.diagrams.DiagramDocument;
import bo.edu.modela.diagrams.DiagramDocument.ClassData;
import bo.edu.modela.diagrams.DiagramDocument.RelationData;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class DiagramFactsTest {
  private final UUID cliente = UUID.randomUUID(), pedido = UUID.randomUUID(), detalle = UUID.randomUUID();
  private ClassData type(UUID id, String name) {
    return new ClassData(id, name, false, new DiagramDocument.Position(0.0, 0.0), List.of());
  }
  private String facts(RelationData... relations) {
    return DiagramFacts.format(new DiagramDocument(1, UUID.randomUUID(), "Ventas", 0L, Instant.now(),
        List.of(type(cliente, "Cliente"), type(pedido, "Pedido"), type(detalle, "Detalle")), List.of(relations)), 7);
  }
  private RelationData association(String source, String target) {
    return new RelationData(UUID.randomUUID(), "association", cliente, pedido, "compra", source, target);
  }

  @Test void reviewReportsOnlyObservableIssuesAndKeepsAssociationClassesConnected() {
    var untyped = new DiagramDocument.AttributeData(UUID.randomUUID(), "numero", "", "private", false, false);
    var client = new ClassData(cliente, "Cliente", false, new DiagramDocument.Position(0.0, 0.0), List.of(untyped));
    var link = new RelationData(UUID.randomUUID(), "association", cliente, pedido, "compra", "1", "0..*", detalle);
    var doc = new DiagramDocument(1, UUID.randomUUID(), "Ventas", 0L, Instant.now(),
        List.of(client, type(pedido, "Pedido"), type(detalle, "Detalle")), List.of(link));
    for (String question : List.of("Revisa el diagrama", "Analiza este diagrama de clases", "revisa el diagrama y dime una mejora posible"))
      assertThat(DiagramFacts.answerQuestion(doc, question)).contains("Cliente.numero no tiene tipo definido", "Pedido no tiene atributos propios", "sugerencias", "ni modifica")
          .doesNotContain("Detalle no tiene relaciones", "Cliente no tiene relaciones", "Pedido no tiene relaciones");
    assertThat(DiagramFacts.answerQuestion(doc, "revisa el diagrama y crea Factura")).isNull();
    assertThat(DiagramFacts.answerQuestion(doc, "¿Cuáles son las clases del diagrama?"))
        .isEqualTo("Clases del diagrama: Cliente, Pedido, Detalle.");
    var empty = new DiagramDocument(1, UUID.randomUUID(), "Vacío", 0L, Instant.now(), List.of(), List.of());
    assertThat(DiagramFacts.answerQuestion(empty, "Revisa mi diagrama")).contains("no contiene clases");
  }

  @Test void associationEndsAreReadFromTheOppositeClass() {
    assertThat(facts(association("1", "0..*")))
        .contains("por cada Cliente, cantidad de Pedido: 0..* (mínimo 0, máximo sin límite)")
        .contains("por cada Pedido, cantidad de Cliente: 1 (exactamente 1)");
    assertThat(facts(association("2..4", "1..*")))
        .contains("por cada Cliente, cantidad de Pedido: 1..* (mínimo 1, máximo sin límite)")
        .contains("por cada Pedido, cantidad de Cliente: 2..4 (mínimo 2, máximo 4)");
  }

  @Test void optionalAndUnboundedMultiplicitiesAndAssociationClassArePreserved() {
    var relation = new RelationData(UUID.randomUUID(), "association", cliente, pedido, "", "*", "0..1", detalle);
    assertThat(facts(relation)).contains("Pedido: 0..1 (mínimo 0, máximo 1)")
        .contains("Cliente: * (mínimo 0, sin máximo)").contains("Clase de asociación: Detalle");
  }

  @Test void inheritanceIsNotInterpretedAsAnAssociation() {
    var relation = new RelationData(UUID.randomUUID(), "generalization", pedido, cliente, "", "1", "1");
    assertThat(facts(relation)).contains("Herencia: Pedido es subclase de Cliente.")
        .doesNotContain("cantidad de Cliente");
  }

  @Test void selfAssociationDoesNotInventUnnamedRoles() {
    var relation = new RelationData(UUID.randomUUID(), "association", cliente, cliente, "", "1", "0..*");
    assertThat(facts(relation)).contains("Asociación reflexiva", "extremo origen 1", "extremo destino 0..*", "roles no están definidos")
        .doesNotContain("por cada Cliente");
  }

  @Test void directCountsUseTheDiagramInBothDirections() {
    var doc = new DiagramDocument(1, UUID.randomUUID(), "Ventas", 0L, Instant.now(),
        List.of(type(cliente, "Cliente"), type(pedido, "Pedido")), List.of(association("1", "0..*")));
    assertThat(DiagramFacts.answerCount(doc, "¿Cuántos pedidos puede tener un cliente según este diagrama? Responde brevemente."))
        .contains("por cada Cliente", "Pedido", "0..* (mínimo 0, máximo sin límite)");
    assertThat(DiagramFacts.answerCount(doc, "¿Cuántos clientes puede tener un pedido?"))
        .contains("por cada Pedido", "Cliente", "1 (exactamente 1)");
    assertThat(DiagramFacts.answerCount(doc, "¿Qué clases hay?")).isNull();
    assertThat(DiagramFacts.answerCount(doc, "¿Cuántos libros puede tener un cliente?"))
        .contains("No puedo identificar ambas clases");
  }

  @Test void directCountsDoNotGuessWhenMultipleRelationsExist() {
    var doc = new DiagramDocument(1, UUID.randomUUID(), "Ventas", 0L, Instant.now(),
        List.of(type(cliente, "Cliente"), type(pedido, "Pedido")), List.of(association("1", "0..*"), association("1", "1")));
    assertThat(DiagramFacts.answerCount(doc, "¿Cuántos pedidos puede tener un cliente?"))
        .contains("varias asociaciones");
  }

  @Test void directCountsPreserveBoundedOptionalAndOneOrMoreValues() {
    var doc = new DiagramDocument(1, UUID.randomUUID(), "Ventas", 0L, Instant.now(),
        List.of(type(cliente, "Cliente"), type(pedido, "Pedido")), List.of(association("0..1", "2..4")));
    assertThat(DiagramFacts.answerCount(doc, "¿Cuántos pedidos puede tener un cliente?"))
        .contains("2..4 (mínimo 2, máximo 4)");
    assertThat(DiagramFacts.answerCount(doc, "¿Cuántos clientes puede tener un pedido?"))
        .contains("0..1 (mínimo 0, máximo 1)");
    var oneOrMore = new DiagramDocument(1, UUID.randomUUID(), "Ventas", 0L, Instant.now(),
        List.of(type(cliente, "Cliente"), type(pedido, "Pedido")), List.of(association("1", "1..*")));
    assertThat(DiagramFacts.answerCount(oneOrMore, "¿Cuántos pedidos puede tener un cliente?"))
        .contains("1..* (mínimo 1, máximo sin límite)");
  }

  @Test void directCountsAvoidGuessingForNoAssociationAndReflexiveQuestions() {
    var doc = new DiagramDocument(1, UUID.randomUUID(), "Ventas", 0L, Instant.now(),
        List.of(type(cliente, "Cliente"), type(pedido, "Pedido")), List.of());
    assertThat(DiagramFacts.answerCount(doc, "¿Cuántos pedidos puede tener un cliente?"))
        .contains("No hay una asociación directa");
    assertThat(DiagramFacts.answerCount(doc, "¿Cuántos clientes puede tener un cliente?"))
        .contains("No hay una asociación reflexiva");
    var relation = new RelationData(UUID.randomUUID(), "association", cliente, cliente, "", "1", "0..*");
    var reflexive = new DiagramDocument(1, UUID.randomUUID(), "Ventas", 0L, Instant.now(),
        List.of(type(cliente, "Cliente")), List.of(relation));
    assertThat(DiagramFacts.answerCount(reflexive, "¿Cuántos clientes puede tener un cliente?"))
        .contains("No puedo distinguir los extremos");
  }

  @Test void commonQuestionsAreAnsweredFromValidatedFacts() {
    var attr = new DiagramDocument.AttributeData(UUID.randomUUID(), "nombre", "String", "private", false, true);
    var c = new ClassData(cliente, "Cliente", false, new DiagramDocument.Position(0.0, 0.0), List.of(attr));
    var doc = new DiagramDocument(1, UUID.randomUUID(), "Ventas", 0L, Instant.now(),
        List.of(c, type(pedido, "Pedido")), List.of(association("1", "0..*")));
    assertThat(DiagramFacts.answerQuestion(doc, "¿Qué clases hay en el diagrama?"))
        .isEqualTo("Clases del diagrama: Cliente, Pedido.");
    assertThat(DiagramFacts.answerQuestion(doc, "¿Qué atributos tiene la clase Cliente?"))
        .isEqualTo("Atributos propios de Cliente: nombre: String.");
    assertThat(DiagramFacts.answerQuestion(doc, "¿Qué atributos tiene Pedido?"))
        .contains("no tiene atributos propios registrados");
    assertThat(DiagramFacts.answerQuestion(doc, "¿Qué atributos tiene Factura?"))
        .contains("No puedo identificar esa clase");
    assertThat(DiagramFacts.answerQuestion(doc, "¿Cuántos pedidos tiene un cliente?"))
        .contains("0..* (mínimo 0, máximo sin límite)");
    assertThat(DiagramFacts.answerQuestion(doc, "¿Cuál es la multiplicidad entre Pedido y Cliente?"))
        .contains("por cada Pedido, cantidad de Cliente: 1 (exactamente 1)")
        .contains("por cada Cliente, cantidad de Pedido: 0..* (mínimo 0, máximo sin límite)");
    assertThat(DiagramFacts.answerQuestion(doc, "¿Qué es una clase UML?")).isNull();
    assertThat(DiagramFacts.answerQuestion(doc, "¿Cuál es el teléfono del cliente?")).isNull();
  }

  @Test void broadQuestionsDoNotInventAnEmptyDiagramOrAmbiguousRelations() {
    var doc = new DiagramDocument(1, UUID.randomUUID(), "Vacío", 0L, Instant.now(), List.of(), List.of());
    assertThat(DiagramFacts.answerQuestion(doc, "¿Qué clases hay en el diagrama?"))
        .isEqualTo("El diagrama no contiene clases.");
    var ambiguous = new DiagramDocument(1, UUID.randomUUID(), "Ventas", 0L, Instant.now(),
        List.of(type(cliente, "Cliente"), type(pedido, "Pedido")), List.of(association("1", "0..*"), association("1", "1")));
    assertThat(DiagramFacts.answerQuestion(ambiguous, "¿Cuál es la multiplicidad entre Cliente y Pedido?"))
        .contains("varias asociaciones");
  }

  @Test void alternativeWordingPreservesDirectionAndExplainsPermittedRatherThanActualCounts() {
    var doc = new DiagramDocument(1, UUID.randomUUID(), "Ventas", 0L, Instant.now(),
        List.of(type(cliente, "Cliente"), type(pedido, "Pedido")), List.of(association("1", "0..*")));
    for (String question : List.of("¿Un cliente puede tener cuántos pedidos?", "¿Cuántos pedidos pueden estar asociados a un cliente?"))
      assertThat(DiagramFacts.answerQuestion(doc, question))
          .contains("por cada Cliente", "Pedido", "0..* (mínimo 0, máximo sin límite)", "no indica cuántos registros existen");
    assertThat(DiagramFacts.answerQuestion(doc, "¿Un pedido puede tener cuántos clientes?"))
        .contains("por cada Pedido", "Cliente", "1 (exactamente 1)");
    assertThat(DiagramFacts.answerQuestion(doc, "¿Cuántos pedidos tiene un cliente y cuántos ya pagó?"))
        .isNull();
  }

  @Test void attributeQuestionsDoNotInventAbsentOrInheritedAttributes() {
    var attr = new DiagramDocument.AttributeData(UUID.randomUUID(), "nombre", "String", "private", false, true);
    var c = new ClassData(cliente, "Cliente", false, new DiagramDocument.Position(0.0, 0.0), List.of(attr));
    var doc = new DiagramDocument(1, UUID.randomUUID(), "Ventas", 0L, Instant.now(), List.of(c), List.of());
    assertThat(DiagramFacts.answerQuestion(doc, "¿Cuáles son los atributos de Cliente?"))
        .isEqualTo("Atributos propios de Cliente: nombre: String.");
    assertThat(DiagramFacts.answerQuestion(doc, "¿Cuál es el tipo del atributo nombre de la clase Cliente?"))
        .isEqualTo("El tipo del atributo nombre de Cliente es String.");
    assertThat(DiagramFacts.answerQuestion(doc, "¿Cuál es el tipo del atributo telefono de Cliente?"))
        .contains("No encuentro ese atributo entre los atributos propios");
    assertThat(DiagramFacts.answerQuestion(doc, "¿Qué atributos tiene Cliente? Agrega uno nuevo."))
        .isNull();
  }

  @Test void naturalRelationQuestionsDistinguishInheritanceAndAssociationClass() {
    var types = List.of(type(cliente, "Cliente"), type(pedido, "Pedido"), type(detalle, "Detalle"));
    var association = new RelationData(UUID.randomUUID(), "association", cliente, pedido, "", "1", "0..*", detalle);
    var doc = new DiagramDocument(1, UUID.randomUUID(), "Ventas", 0L, Instant.now(), types, List.of(association));
    assertThat(DiagramFacts.answerQuestion(doc, "¿Cómo se relacionan Cliente y Pedido?"))
        .contains("por cada Cliente, cantidad de Pedido: 0..*", "clase de asociación es Detalle");
    var generalization = new RelationData(UUID.randomUUID(), "generalization", pedido, cliente, "", "1", "1");
    var inherited = new DiagramDocument(1, UUID.randomUUID(), "Ventas", 0L, Instant.now(), types, List.of(generalization));
    assertThat(DiagramFacts.answerQuestion(inherited, "¿Qué relación existe entre Cliente y Pedido?"))
        .isEqualTo("Según el diagrama, Pedido es subclase de Cliente.");
    var both = new DiagramDocument(1, UUID.randomUUID(), "Ventas", 0L, Instant.now(), types, List.of(association, generalization));
    assertThat(DiagramFacts.answerQuestion(both, "¿Qué relación hay entre Cliente y Pedido?"))
        .contains("varias relaciones");
  }

  @Test void aNamedRelationCanBeIdentifiedAfterAnAmbiguousQuestion() {
    var types = List.of(type(cliente, "Cliente"), type(pedido, "Pedido"), type(detalle, "Detalle"));
    var purchase = new RelationData(UUID.randomUUID(), "association", cliente, pedido, "compra", "1", "0..*", detalle);
    var refund = new RelationData(UUID.randomUUID(), "association", pedido, cliente, "devolución", "0..1", "1");
    var doc = new DiagramDocument(1, UUID.randomUUID(), "Ventas", 0L, Instant.now(), types, List.of(purchase, refund));
    assertThat(DiagramFacts.answerQuestion(doc, "¿Cuál es la multiplicidad entre Cliente y Pedido?"))
        .contains("varias asociaciones");
    assertThat(DiagramFacts.answerQuestion(doc, "¿Cuál es la multiplicidad de la relación COMPRA?"))
        .contains("Asociación compra", "por cada Cliente, cantidad de Pedido: 0..*", "clase de asociación es Detalle");
    assertThat(DiagramFacts.answerQuestion(doc, "la relación devolución"))
        .contains("por cada Pedido, cantidad de Cliente: 1", "por cada Cliente, cantidad de Pedido: 0..1");
    assertThat(DiagramFacts.answerQuestion(doc, "la relacion devolucion"))
        .contains("por cada Pedido, cantidad de Cliente: 1");
    assertThat(DiagramFacts.answerQuestion(doc, "Explica la relación inexistente"))
        .contains("No encuentro una relación");
    assertThat(DiagramFacts.answerQuestion(doc, "Explica la relación compra y agrega un atributo"))
        .isNull();
  }

  @Test void removingAccentsCannotSilentlyChooseAnAmbiguousName() {
    var types = List.of(type(cliente, "Cliente"), type(pedido, "Pedido"));
    var a = new RelationData(UUID.randomUUID(), "association", cliente, pedido, "credito", "1", "0..*");
    var b = new RelationData(UUID.randomUUID(), "association", pedido, cliente, "crédito", "1", "1");
    var doc = new DiagramDocument(1, UUID.randomUUID(), "Ventas", 0L, Instant.now(), types, List.of(a, b));
    assertThat(DiagramFacts.answerQuestion(doc, "la relación credito")).contains("varias relaciones con ese nombre");
    var same = new DiagramDocument(1, UUID.randomUUID(), "Ventas", 0L, Instant.now(),
        List.of(type(cliente, "Categoria"), type(pedido, "Categoría")), List.of());
    assertThat(DiagramFacts.answerQuestion(same, "¿Qué atributos tiene Categoria?"))
        .contains("No puedo identificar esa clase de forma inequívoca");
  }

  @Test void namedRelationsWithSameNameOrInheritanceAreNeverGuessed() {
    var types = List.of(type(cliente, "Cliente"), type(pedido, "Pedido"));
    var purchase = new RelationData(UUID.randomUUID(), "association", cliente, pedido, "vinculo", "1", "0..*");
    var reverse = new RelationData(UUID.randomUUID(), "association", pedido, cliente, "vinculo", "1", "1");
    var inherit = new RelationData(UUID.randomUUID(), "generalization", pedido, cliente, "especializa", "1", "1");
    var doc = new DiagramDocument(1, UUID.randomUUID(), "Ventas", 0L, Instant.now(), types, List.of(purchase, reverse, inherit));
    assertThat(DiagramFacts.answerQuestion(doc, "la relación vinculo")).contains("varias relaciones con ese nombre");
    assertThat(DiagramFacts.answerQuestion(doc, "la relación especializa"))
        .contains("Pedido es subclase de Cliente", "multiplicidad no se aplica");
  }
}
