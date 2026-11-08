package bo.edu.modela.ai;

import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.Test;

class AssistantAnswerQualityTest {
  @Test void rejectsObviousNonAnswersWithoutDiscardingGreetingsOrValidText() {
    assertThat(AssistantAnswerQuality.usableAnswer("¿Qué es UML?", "Hola.")).isEqualTo(AssistantAnswerQuality.FALLBACK);
    assertThat(AssistantAnswerQuality.usableAnswer("¿Qué es UML?", "  ")).isEqualTo(AssistantAnswerQuality.FALLBACK);
    assertThat(AssistantAnswerQuality.usableAnswer("¿Qué es UML?", "Que es UML?")).isEqualTo(AssistantAnswerQuality.FALLBACK);
    assertThat(AssistantAnswerQuality.usableAnswer("Hola", "¡Hola!")).isEqualTo("¡Hola!");
    assertThat(AssistantAnswerQuality.usableAnswer("¿Qué es UML?", "UML es un lenguaje de modelado.")).isEqualTo("UML es un lenguaje de modelado.");
    assertThat(AssistantAnswerQuality.usableAnswer("¿Qué es UML?", "Actualmente no lo sé.")).isEqualTo("Actualmente no lo sé.");
  }
}
