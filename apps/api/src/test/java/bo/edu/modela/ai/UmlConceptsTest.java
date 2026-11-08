package bo.edu.modela.ai;

import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.Test;

class UmlConceptsTest {
  @Test void classConceptAnswersOrdinaryVariantsWithoutMistakingSpecificQuestions() {
    for (String question : new String[]{"que es una clase?", "¿Qué es una clase en UML?", "Explica la clase", "Definición de clase"})
      assertThat(UmlConcepts.answer(question)).contains("objetos", "atributos", "métodos");
    assertThat(UmlConcepts.answer("¿Qué es la clase Cliente?")).isNull();
    assertThat(UmlConcepts.answer("¿Qué clases hay en el diagrama?")).isNull();
  }
  @Test void derivedAttributeExplanationDoesNotClaimItCannotBeStored() {
    assertThat(UmlConcepts.answer("¿Qué es un atributo derivado en UML?"))
        .contains("calcularse", "/total", "no determina por sí solo si se almacena");
    assertThat(UmlConcepts.answer("Explica el atributo derivado")).isNotNull();
    assertThat(UmlConcepts.answer("¿Qué significa la barra antes del nombre de un atributo?"))
        .contains("atributo derivado", "/total");
    assertThat(UmlConcepts.answer("¿Para qué sirve la barra antes de un atributo en UML?"))
        .contains("atributo derivado");
    assertThat(UmlConcepts.answer("¿Qué atributos tiene Cliente?")).isNull();
  }
}
