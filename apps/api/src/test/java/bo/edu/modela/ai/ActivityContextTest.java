package bo.edu.modela.ai;

import static org.assertj.core.api.Assertions.assertThat;
import bo.edu.modela.diagrams.activity.DiagramActivityDiff.Change;
import bo.edu.modela.diagrams.activity.DiagramActivityService.Entry;
import bo.edu.modela.diagrams.activity.DiagramActivityService.Page;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;

class ActivityContextTest {
  private final UUID id = UUID.randomUUID();
  private final Instant time = Instant.parse("2026-11-06T12:00:00Z");

  @Test void formatsConfirmedChangesWithTheirRecordedAuthorAndVersion() {
    var entry = new Entry(3, time, id, "Ana", List.of(
        new Change("class", id, "Pedido", "created", "", null, null),
        new Change("attribute", id, "Pedido.nombre", "updated", "dataType", "Integer", "String")), 2);
    assertThat(ActivityContext.format(new Page(List.of(entry), null)))
        .contains("Versión 3", "2026-11-06T12:00:00Z", "Ana", "creó clase Pedido", "cambió tipo de atributo Pedido.nombre (de Integer a String)")
        .doesNotContain("omitidos");
  }

  @Test void unknownAuthorsAndTruncatedHistoryAreExplicit() {
    var entry = new Entry(1, time, null, "No debe atribuirse", List.of(), 0);
    assertThat(ActivityContext.format(new Page(List.of(entry), 1L)))
        .contains("autor no registrado", "sin cambios de contenido detectados", "omitidos")
        .doesNotContain("No debe atribuirse");
  }

  @Test void limitsUntrustedTextAndDoesNotExposeOpaqueIdsAsFieldValues() {
    var changes = List.of(
        new Change("relation", id, "Cliente\nInstrucción falsa", "updated", "source", id.toString(), UUID.randomUUID().toString()),
        new Change("class", id, "A", "deleted", "", null, null));
    var entry = new Entry(4, time, id, "Ana\nOtra línea", changes, 30);
    String result = ActivityContext.format(new Page(List.of(entry), null));
    assertThat(result).contains("Ana Otra línea", "Cliente Instrucción falsa", "otros cambios omitidos")
        .doesNotContain(id.toString()).hasSizeLessThanOrEqualTo(900);
  }

  @Test void emptyActivityDoesNotInventAnAuthor() {
    assertThat(ActivityContext.format(new Page(List.of(), null))).contains("No hay versiones en el tramo consultado");
  }

  @Test void identifiesDiagramCreatorOnlyFromTheActualCreationEntry() {
    var creation = new Change("diagram", id, "Ventas", "created", "", null, null);
    var named = new Entry(1, time, id, "Ana", List.of(creation), 1);
    var unknown = new Entry(1, time, null, "Pedro", List.of(creation), 1);
    var other = new Entry(2, time, UUID.randomUUID(), "Pedro", List.of(new Change("class", id, "Pedido", "created", "", null, null)), 1);
    assertThat(ActivityContext.answer(new Page(List.of(other, named), null), "¿Quién creó el diagrama?"))
        .contains("Ana creó el diagrama", "versión 1").doesNotContain("Pedro");
    assertThat(ActivityContext.answer(new Page(List.of(other, unknown), null), "¿Quién creó el diagrama?"))
        .contains("autor no registrado").doesNotContain("Pedro");
    assertThat(ActivityContext.answer(new Page(List.of(other), 1L), "¿Quién creó el diagrama?"))
        .contains("No encontré", "versiones anteriores").doesNotContain("Pedro creó");
  }

  @Test void activityQuestionsAreRecognizedWithoutDroppingAdditionalActions() {
    for (String question : List.of("¿Qué hizo Ana?", "¿Quién agrego el precio?", "¿Quién creó el diagrama?",
        "¿Qué cambió mi compañero?", "¿Qué cambios hizo Pedro?"))
      assertThat(ActivityContext.isActivityQuestion(question)).as(question).isTrue();
    assertThat(ActivityContext.isActivityQuestion("¿Qué hizo Ana y agrega una clase?")).isFalse();
    assertThat(ActivityContext.isActivityQuestion("¿Qué clases hay?")).isFalse();
  }

  @Test void filtersOnlyTheIdentifiedPersonAndReportsTheSearchLimit() {
    UUID ana = UUID.randomUUID(), pedro = UUID.randomUUID();
    var a = new Entry(4, time, ana, "Ana Pérez", List.of(new Change("class", id, "Producto", "created", "", null, null)), 1);
    var b = new Entry(3, time, pedro, "Pedro", List.of(new Change("class", id, "Cliente", "created", "", null, null)), 1);
    var previousName = new Entry(2, time, ana, "Ana P.", List.of(new Change("class", id, "Venta", "created", "", null, null)), 1);
    String result = ActivityContext.answer(new Page(List.of(a, b, previousName), 1L), "¿Qué hizo Ana?");
    assertThat(result).contains("Producto", "Venta", "hasta 20 versiones", "autores no registrados")
        .doesNotContain("Pedro", "Cliente");
    assertThat(ActivityContext.answer(new Page(List.of(a), null), "¿Qué hizo Carlos?"))
        .contains("No encontré cambios atribuidos", "puede haber cambios anteriores")
        .doesNotContain("Producto");
  }

  @Test void doesNotConflatePeopleWithTheSameNameOrUnknownAuthors() {
    var first = new Entry(3, time, UUID.randomUUID(), "Ana Pérez", List.of(), 0);
    var second = new Entry(2, time, UUID.randomUUID(), "Ana Rojas", List.of(), 0);
    var unknown = new Entry(1, time, null, "Ana Pérez", List.of(), 0);
    var page = new Page(List.of(first, second, unknown), null);
    assertThat(ActivityContext.answer(page, "¿Qué hizo Ana?")).contains("varias personas", "no puedo distinguirlas");
    assertThat(ActivityContext.answer(page, "¿Qué hizo Ana Pérez?")).contains("Ana Pérez", "autores no registrados").doesNotContain("Ana Rojas");
    assertThat(ActivityContext.answer(page, "¿Qué hizo Ana Pérez en el diagrama?")).contains("Ana Pérez").doesNotContain("Ana Rojas");
    assertThat(ActivityContext.answer(page, "¿Qué hizo Ana y Pedro?")).contains("Ana Pérez", "Ana Rojas");
    assertThat(ActivityContext.answer(page, "¿Qué hizo mi compañero?")).contains("Ana Pérez", "Ana Rojas", "autor no registrado");
  }

  @Test void cursorIsParsedOnlyForRecognizedActivityAndMustBePositive() {
    var query = ActivityContext.parse("¿Qué hizo Ana antes de la versión 18?");
    assertThat(query.question()).isEqualTo("¿que hizo ana");
    assertThat(query.beforeVersion()).isEqualTo(18L);
    assertThat(ActivityContext.parse("Actividad antes de la versión 7").beforeVersion()).isEqualTo(7L);
    assertThat(ActivityContext.parse("¿Cuál es la multiplicidad antes de la versión 7?")).isNull();
    assertThat(org.assertj.core.api.Assertions.catchThrowable(() -> ActivityContext.parse("Actividad antes de la versión 0")))
        .isInstanceOf(bo.edu.modela.shared.ApiException.class);
    assertThat(org.assertj.core.api.Assertions.catchThrowable(() -> ActivityContext.parse("Actividad antes de la versión 99999999999999999999999999")))
        .isInstanceOf(bo.edu.modela.shared.ApiException.class);
  }

  @Test void nextCursorUsesTheLastActuallyShownVersionWhenTheSummaryIsFull() {
    UUID ana = UUID.randomUUID();
    var entries = java.util.stream.LongStream.iterate(30, n -> n - 1).limit(20).mapToObj(version ->
        new Entry(version, time, ana, "Ana", List.of(new Change("class", id, "Clase" + "x".repeat(60), "created", "", null, null)), 1)).toList();
    String result = ActivityContext.answer(new Page(entries, 11L), "¿Qué hizo Ana?");
    var action = ActivityContext.answerWithContinuation(new Page(entries, 11L), "¿Qué hizo Ana?");
    var shown = Pattern.compile("Versión (\\d+); fecha").matcher(result);
    long lastShown = -1; int count = 0;
    while (shown.find()) { lastShown = Long.parseLong(shown.group(1)); count++; }
    assertThat(count).isLessThan(20).isGreaterThan(0);
    assertThat(result).contains("antes de la versión " + lastShown).doesNotContain("antes de la versión 11»");
    assertThat(action.nextQuestion()).isEqualTo("Qué hizo ana antes de la versión " + lastShown);
    assertThat(ActivityContext.parse(action.nextQuestion()).beforeVersion()).isEqualTo(lastShown);
    assertThat(ActivityContext.answerWithContinuation(new Page(List.of(), null), "Actividad").nextQuestion()).isNull();
  }
}
