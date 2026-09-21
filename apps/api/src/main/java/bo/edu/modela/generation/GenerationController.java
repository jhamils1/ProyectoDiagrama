package bo.edu.modela.generation;

import bo.edu.modela.diagrams.DiagramService;
import bo.edu.modela.shared.ApiException;
import java.util.List;
import java.util.UUID;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/projects/{project}/diagrams/{id}/backend")
public class GenerationController {
  private final DiagramService diagrams;
  public GenerationController(DiagramService diagrams) { this.diagrams = diagrams; }

  @GetMapping
  public ResponseEntity<byte[]> download(@PathVariable UUID project, @PathVariable UUID id,
      @RequestParam long revision) {
    // Read the authorized, coherent persisted snapshot, never a document supplied by the client.
    var snapshot = diagrams.get(project, id);
    if (!List.of("ADMINISTRACION", "EDICION").contains(snapshot.permiso())) throw ApiException.forbidden();
    if (revision != snapshot.revision()) throw ApiException.conflict("El diagrama cambió. Actualiza antes de generar el backend.");
    return ResponseEntity.ok()
        .contentType(MediaType.parseMediaType("application/zip"))
        .cacheControl(CacheControl.noStore())
        .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"backend-" + id + "-r" + revision + ".zip\"")
        .body(BackendGenerator.zip(snapshot.document()));
  }

  public record ValidationError(String code, String message, List<GenerationValidator.Issue> issues) {}
  @ExceptionHandler(BackendGenerator.InvalidModel.class)
  public ResponseEntity<ValidationError> invalid(BackendGenerator.InvalidModel error) {
    return ResponseEntity.unprocessableContent().cacheControl(CacheControl.noStore()).body(
        new ValidationError("GENERACION_INVALIDA", error.getMessage(), error.issues()));
  }
}
