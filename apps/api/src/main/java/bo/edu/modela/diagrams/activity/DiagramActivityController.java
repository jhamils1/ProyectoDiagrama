package bo.edu.modela.diagrams.activity;

import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/projects/{project}/diagrams/{id}/activity")
public class DiagramActivityController {
  private final DiagramActivityService service;
  public DiagramActivityController(DiagramActivityService service) { this.service = service; }

  @GetMapping
  ResponseEntity<DiagramActivityService.Page> list(@PathVariable UUID project, @PathVariable UUID id,
      @RequestParam(required = false) Long beforeVersion, @RequestParam(defaultValue = "10") int size) {
    return ResponseEntity.ok().cacheControl(CacheControl.noStore())
        .body(service.list(project, id, beforeVersion, size));
  }

  @GetMapping("/{version}/changes")
  ResponseEntity<DiagramActivityService.ChangePage> changes(@PathVariable UUID project, @PathVariable UUID id,
      @PathVariable long version, @RequestParam(defaultValue = "0") int offset,
      @RequestParam(defaultValue = "100") int size) {
    return ResponseEntity.ok().cacheControl(CacheControl.noStore())
        .body(service.changes(project, id, version, offset, size));
  }
}
