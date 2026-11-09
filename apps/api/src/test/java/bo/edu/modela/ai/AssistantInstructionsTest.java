package bo.edu.modela.ai;

import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.Test;

class AssistantInstructionsTest {
  @Test void providerIndependentInstructionsRemainSharedAndQwenControlIsLocalOnly() {
    assertThat(AssistantInstructions.COMMON).contains("Responde", "No inventes cambios", "preguntas teóricas")
        .doesNotContain("/no_think");
    assertThat(AssistantInstructions.localQwen()).isEqualTo(AssistantInstructions.COMMON + " /no_think");
  }
}
