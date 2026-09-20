package bo.edu.modela.diagrams;

import bo.edu.modela.shared.PageResult;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/projects/{project}/diagrams")
public class DiagramController {
  public record Update(@NotNull @PositiveOrZero Long revision, @NotNull DiagramDocument document) {}

  private final DiagramService service;

  public DiagramController(DiagramService service) {
    this.service = service;
  }

  @GetMapping
  PageResult<DiagramService.Summary> list(
      @PathVariable UUID project,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    return service.list(project, page, size);
  }

  @GetMapping("/{id}")
  DiagramService.Envelope get(@PathVariable UUID project, @PathVariable UUID id) {
    return service.get(project, id);
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  DiagramService.Envelope create(@PathVariable UUID project, @RequestBody DiagramDocument doc) {
    return service.create(project, doc);
  }

  @GetMapping("/{id}/state")
  DiagramService.State state(@PathVariable UUID project, @PathVariable UUID id) {
    return service.state(project, id);
  }

  @PutMapping("/{id}")
  DiagramService.Envelope update(
      @PathVariable UUID project, @PathVariable UUID id, @Valid @RequestBody Update request) {
    return service.update(project, id, request.revision(), request.document());
  }

  @DeleteMapping("/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  void delete(@PathVariable UUID project, @PathVariable UUID id, @RequestParam long revision) {
    service.delete(project, id, revision);
  }
}
