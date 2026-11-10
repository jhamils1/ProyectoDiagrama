package bo.edu.modela.ai;

import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.Test;

class AssistantAnswerQualityTest {
  @Test void evaluatesAnswerBeforeContextNotice() {
    String notice = "\n\nSe omitió parte del contexto anterior.";
    assertThat(AssistantAnswerQuality.usableAnswer("¿Qué moneda se propuso?", "¿Qué moneda se propuso?" + notice)).isEqualTo(AssistantAnswerQuality.FALLBACK);
    assertThat(AssistantAnswerQuality.usableAnswer("¿Qué moneda se propuso?", "¿Qué moneda se propuso para Factura?\n\nSe omitió el historial anterior para esta respuesta.")).isEqualTo(AssistantAnswerQuality.FALLBACK);
    assertThat(AssistantAnswerQuality.usableAnswer("¿Qué moneda se propuso?", "Se propuso bolivianos." + notice)).isEqualTo("Se propuso bolivianos." + notice);
    assertThat(AssistantAnswerQuality.usableAnswer("¿Qué moneda se propuso?", notice)).isEqualTo(AssistantAnswerQuality.FALLBACK);
  }
  @Test void classifiesNonAnswersWithoutExposingTheirContent() {
    assertThat(AssistantAnswerQuality.assess("¿Qué es UML?", " ").outcome()).isEqualTo(AssistantAnswerQuality.Outcome.EMPTY);
    assertThat(AssistantAnswerQuality.assess("¿Qué es UML?", AssistantAnswerQuality.FALLBACK).outcome()).isEqualTo(AssistantAnswerQuality.Outcome.FALLBACK);
    assertThat(AssistantAnswerQuality.assess("¿Qué es UML?", "Hola").outcome()).isEqualTo(AssistantAnswerQuality.Outcome.GREETING);
    assertThat(AssistantAnswerQuality.assess("¿Qué es UML?", "Que es UML?").outcome()).isEqualTo(AssistantAnswerQuality.Outcome.REPEATED_QUESTION);
    assertThat(AssistantAnswerQuality.assess("¿Qué es UML?", "¿Qué es una clase?").outcome()).isEqualTo(AssistantAnswerQuality.Outcome.QUESTION_ONLY);
    assertThat(AssistantAnswerQuality.assess("¿Qué es UML?", "Un lenguaje de modelado.").outcome()).isEqualTo(AssistantAnswerQuality.Outcome.ACCEPTED);
  }
  @Test void rejectsObviousNonAnswersWithoutDiscardingGreetingsOrValidText() {
    assertThat(AssistantAnswerQuality.usableAnswer("¿Qué es UML?", "Hola.")).isEqualTo(AssistantAnswerQuality.FALLBACK);
    assertThat(AssistantAnswerQuality.usableAnswer("¿Qué es UML?", "  ")).isEqualTo(AssistantAnswerQuality.FALLBACK);
    assertThat(AssistantAnswerQuality.usableAnswer("¿Qué es UML?", "Que es UML?")).isEqualTo(AssistantAnswerQuality.FALLBACK);
    assertThat(AssistantAnswerQuality.usableAnswer("Hola", "¡Hola!")).isEqualTo("¡Hola!");
    assertThat(AssistantAnswerQuality.usableAnswer("¿Qué es UML?", "UML es un lenguaje de modelado.")).isEqualTo("UML es un lenguaje de modelado.");
    assertThat(AssistantAnswerQuality.usableAnswer("¿Qué es UML?", "Actualmente no lo sé.")).isEqualTo("Actualmente no lo sé.");
  }
  @Test void rejectsSingleRestatedQuestionsButAllowsExplicitClarification() {
    assertThat(AssistantAnswerQuality.usableAnswer("¿Qué puedes realizar?", "¿Qué cambios se realizaron en la clase lámpara?"))
        .isEqualTo(AssistantAnswerQuality.FALLBACK);
    assertThat(AssistantAnswerQuality.usableAnswer("¿Qué atributos coloco?", "¿Qué atributos colocar en la clase computadora?"))
        .isEqualTo(AssistantAnswerQuality.FALLBACK);
    assertThat(AssistantAnswerQuality.usableAnswer("¿Cómo modelo esto?", "¿Puedes aclarar para qué se usará?"))
        .isEqualTo("¿Puedes aclarar para qué se usará?");
    assertThat(AssistantAnswerQuality.usableAnswer("¿Qué sugieres?", "Podrías añadir un nombre. ¿Cuál es su propósito?"))
        .isEqualTo("Podrías añadir un nombre. ¿Cuál es su propósito?");
  }
}
