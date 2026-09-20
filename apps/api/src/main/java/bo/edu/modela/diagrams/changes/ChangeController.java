package bo.edu.modela.diagrams.changes;

import bo.edu.modela.diagrams.DiagramDocument;
import bo.edu.modela.auth.CurrentUser;
import bo.edu.modela.shared.ApiException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/projects/{project}/diagrams/{diagram}/changes")
public class ChangeController {
  public record Proposal(@NotNull UUID id, @NotNull @PositiveOrZero Long baseRevision, @NotNull DiagramDocument document, UUID authorId) {}
  public record Resolution(@NotNull @PositiveOrZero Long comparedRevision, @NotNull Map<String,DiagramMerge.Choice> choices) {}
  public record Creation(@NotNull UUID id, @NotNull UUID authorId, @NotNull DiagramDocument document) {}
  private final ChangeService service;
  private final CurrentUser users;
  @PostMapping("/create") ChangeService.Response create(@PathVariable UUID project,@PathVariable UUID diagram,@Valid @RequestBody Creation body) {
    if(!body.authorId().equals(users.get().id)) throw ApiException.forbidden();
    return service.create(project,diagram,body.id(),body.document());
  }
  public ChangeController(ChangeService service, CurrentUser users) { this.service=service; this.users=users; }
  @GetMapping List<UUID> pending(@PathVariable UUID project,@PathVariable UUID diagram) {
    return service.pending(project,diagram);
  }
  @GetMapping("/{change}") ChangeService.Response get(@PathVariable UUID project,@PathVariable UUID diagram,@PathVariable UUID change) {
    return service.get(project,diagram,change);
  }
  @PostMapping ChangeService.Response propose(@PathVariable UUID project,@PathVariable UUID diagram,@Valid @RequestBody Proposal body) {
    if(body.authorId()!=null && !body.authorId().equals(users.get().id)) throw ApiException.forbidden();
    return service.propose(project,diagram,body.id(),body.baseRevision(),body.document());
  }
  @PostMapping("/{change}/resolve") ChangeService.Response resolve(@PathVariable UUID project,@PathVariable UUID diagram,@PathVariable UUID change,@Valid @RequestBody Resolution body) {
    return service.resolve(project,diagram,change,body.comparedRevision(),body.choices());
  }
  @PostMapping("/{change}/discard") ChangeService.Response discard(@PathVariable UUID project,@PathVariable UUID diagram,@PathVariable UUID change) {
    return service.discard(project,diagram,change);
  }
}
