package bo.edu.modela.ai;

import static org.assertj.core.api.Assertions.assertThat;
import bo.edu.modela.diagrams.DiagramDocument;
import bo.edu.modela.diagrams.DiagramDocument.*;
import bo.edu.modela.diagrams.activity.DiagramActivityDiff.Change;
import bo.edu.modela.diagrams.activity.DiagramActivityService.*;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.Test;

class ParticipantReviewTest {
  UUID ana = UUID.randomUUID(), pedro = UUID.randomUUID(), classId = UUID.randomUUID(), other = UUID.randomUUID();
  Instant now = Instant.parse("2026-11-08T12:00:00Z");
  Entry entry(UUID author, String name, UUID element, String label) {
    return new Entry(2, now, author, name, List.of(new Change("class", element, label, "created", "", null, null)), 1);
  }
  DiagramDocument doc() {
    return new DiagramDocument(1, UUID.randomUUID(), "Prueba", 2L, now, List.of(
        new ClassData(classId, "Factura", false, new Position(0d, 0d), List.of(), List.of()),
        new ClassData(other, "Producto", false, new Position(0d, 0d), List.of(), List.of())), List.of());
  }
  @Test void recognizesSpecificReviewWithoutAcceptingExtraInstructions() {
    assertThat(ParticipantReview.matches("¿Puedes revisar mi trabajo?")).isTrue();
    assertThat(ParticipantReview.matches("Analiza los cambios de Ana Pérez")).isTrue();
    assertThat(ParticipantReview.matches("Revisa lo que hizo Ana Pérez")).isTrue();
    assertThat(ParticipantReview.matches("¿Puedes evaluar lo que modificó Ana?")).isTrue();
    assertThat(ParticipantReview.matches("Revisa mi trabajo y crea Factura")).isFalse();
  }
  @Test void reviewsOnlyTheIdentifiedAuthorsElementsAndMakesLimitsExplicit() {
    var page = new Page(List.of(entry(ana, "Ana Pérez", classId, "Factura"), entry(pedro, "Pedro", other, "Producto")), 1L);
    String result = ParticipantReview.answer(page, doc(), "Revisa el trabajo de Ana", pedro);
    assertThat(result).contains("Cambios encontrados:", "creó la clase Factura", "Sugerencias para revisar:", "no tiene atributos ni métodos", "otras personas pudieron modificar", "parte de la actividad")
        .doesNotContain("Producto", "Pedro");
    assertThat(ParticipantReview.answer(page, doc(), "Revisa mis cambios", pedro)).contains("Producto").doesNotContain("Factura");
    assertThat(ParticipantReview.answer(page, doc(), "Revisa lo que hizo Ana", pedro)).contains("Factura").doesNotContain("Producto");
    assertThat(ParticipantReview.answer(page, doc(), "Evalúa lo que modificó Ana", pedro)).contains("Factura").doesNotContain("Producto");
  }
  @Test void unknownAndAmbiguousNamesDoNotAssignChanges() {
    var page = new Page(List.of(entry(ana, "Ana Pérez", classId, "Factura"), entry(pedro, "Ana Ruiz", other, "Producto")), null);
    assertThat(ParticipantReview.answer(page, doc(), "Revisa el trabajo de Ana", ana)).contains("varias personas").doesNotContain("Factura");
    assertThat(ParticipantReview.answer(page, doc(), "Revisa el trabajo de Luis", ana)).contains("No encontré").doesNotContain("Factura");
    assertThat(ParticipantReview.answer(page, doc(), "Revisa mi trabajo", ana)).contains("Factura").doesNotContain("Producto");
  }
  @Test void deletedOrMissingComparisonsAreNotInventedAsCurrentFindings() {
    var missing = new Entry(4, now, ana, "Ana", List.of(new Change("diagram", null, "", "unavailable", "", null, null)), 1);
    String result = ParticipantReview.answer(new Page(List.of(missing), null), doc(), "Revisa mi trabajo", ana);
    assertThat(result).contains("falta la versión anterior", "No pude revisar esos cambios").doesNotContain("creó diagrama");
  }
}
