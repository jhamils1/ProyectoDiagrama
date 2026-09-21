package bo.edu.modela.interoperability;

import bo.edu.modela.diagrams.DiagramService;
import bo.edu.modela.shared.ApiException;
import java.util.List;
import java.util.UUID;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/projects/{project}/diagrams/{id}/xmi")
public class XmiExportController {
  private final DiagramService diagrams;
  public XmiExportController(DiagramService diagrams) { this.diagrams = diagrams; }

  @GetMapping
  public ResponseEntity<byte[]> download(@PathVariable UUID project, @PathVariable UUID id,
      @RequestParam long revision) {
    var snapshot = diagrams.get(project, id);
    if (!List.of("ADMINISTRACION", "EDICION").contains(snapshot.permiso())) throw ApiException.forbidden();
    if (revision != snapshot.revision()) throw ApiException.conflict("El diagrama cambió. Actualiza antes de exportar.");
    return ResponseEntity.ok().contentType(MediaType.APPLICATION_XML).cacheControl(CacheControl.noStore())
        .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"diagrama-" + id + "-r" + revision + ".xml\"")
        .body(EaXmiWriter.write(snapshot.document()));
  }

  @ExceptionHandler(IllegalArgumentException.class)
  public ResponseEntity<java.util.Map<String,String>> invalid(IllegalArgumentException error) {
    return ResponseEntity.unprocessableContent().cacheControl(CacheControl.noStore())
        .body(java.util.Map.of("code", "EXPORTACION_INVALIDA", "message", error.getMessage()));
  }
}
