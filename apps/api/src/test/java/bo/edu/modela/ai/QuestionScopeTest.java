package bo.edu.modela.ai;

import static org.assertj.core.api.Assertions.assertThat;

import bo.edu.modela.diagrams.DiagramDocument;
import java.util.List;
import org.junit.jupiter.api.Test;

class QuestionScopeTest {
  private final DiagramDocument document = new DiagramDocument(null, null, null, null, null,
      List.of(new DiagramDocument.ClassData(null, "Detalle", false, null, List.of())), List.of());

  @Test void identifiesDiagramReferencesAndNamedClasses() {
    assertThat(QuestionScope.classify("¿Para qué sirve este modelo?", document)).isEqualTo("DIAGRAMA");
    assertThat(QuestionScope.classify("¿Para qué sirve la clase Detalle?", document)).isEqualTo("DIAGRAMA");
    assertThat(QuestionScope.classify("¿Qué es una clase en este diagrama?", document)).isEqualTo("DIAGRAMA");
  }

  @Test void keepsConceptsAndAmbiguousFollowupsSeparate() {
    assertThat(QuestionScope.classify("¿Qué es una clase UML?", document)).isEqualTo("CONCEPTO");
    assertThat(QuestionScope.classify("¿Qué es un diagrama de clases?", document)).isEqualTo("CONCEPTO");
    assertThat(QuestionScope.classify("Explica una asociación", document)).isEqualTo("CONCEPTO");
    assertThat(QuestionScope.classify("¿Y eso?", document)).isEqualTo("DESCONOCIDO");
    assertThat(QuestionScope.classify("¿Para qué sirve la clase Detallada?", document)).isEqualTo("DESCONOCIDO");
  }
}
