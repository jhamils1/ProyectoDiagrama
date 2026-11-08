package bo.edu.modela.projects;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class SharedFileControllerTest {
  @Test void disabledUploadsRejectBeforeReadingOrSavingFile() {
    var service = mock(SharedFileService.class);
    var controller = new SharedFileController(service, false);
    var file = new MockMultipartFile("file", "ejemplo.txt", "text/plain", new byte[]{1});
    var error = assertThrows(ResponseStatusException.class,
        () -> controller.upload(UUID.randomUUID(), UUID.randomUUID(), file));
    assertEquals(HttpStatus.FORBIDDEN, error.getStatusCode());
    verifyNoInteractions(service);
  }
}
