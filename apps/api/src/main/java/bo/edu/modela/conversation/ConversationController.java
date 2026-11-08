package bo.edu.modela.conversation;

import bo.edu.modela.ai.SharedAssistantService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.UUID;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/projects/{project}/diagrams/{diagram}/conversation")
public class ConversationController {
  public record Send(@NotNull UUID id, @NotBlank @Size(max = 4000) String content) {}
  public record Complete(@NotNull UUID token, @Size(max = 4000) String content, boolean failed,
      @Size(max = 40) String failureReason) {}
  public record Release(@NotNull UUID token) {}
  public record ShareProposal(@NotNull UUID id, @Min(0) long baseRevision,
      @NotBlank @Size(max = 1500) String instruction, @NotEmpty @Size(max = 8) java.util.List<@NotBlank @Size(max = 300) String> changes,
      @Size(max = 16000) String proposalData) {}
  private final ConversationService service;
  private final SharedAssistantService assistant;
  public ConversationController(ConversationService service, SharedAssistantService assistant) { this.service = service; this.assistant = assistant; }

  @GetMapping
  ResponseEntity<ConversationService.Page> list(@PathVariable UUID project, @PathVariable UUID diagram,
      @RequestParam(required = false) Long before, @RequestParam(required = false) Long after,
      @RequestParam(defaultValue = "30") int size) {
    return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.list(project, diagram, before, after, size));
  }

  @PostMapping
  ResponseEntity<ConversationService.Message> send(@PathVariable UUID project, @PathVariable UUID diagram,
      @Valid @RequestBody Send request) {
    return ResponseEntity.status(HttpStatus.CREATED).cacheControl(CacheControl.noStore())
        .body(service.send(project, diagram, request.id(), request.content()));
  }

  @PostMapping("/assistant")
  ResponseEntity<SharedAssistantService.RequestStatus> ask(@PathVariable UUID project, @PathVariable UUID diagram,
      @Valid @RequestBody Send request) {
    return ResponseEntity.accepted().cacheControl(CacheControl.noStore())
        .body(assistant.request(project, diagram, request.id(), request.content()));
  }

  @PostMapping("/proposals")
  ResponseEntity<ConversationService.Message> shareProposal(@PathVariable UUID project, @PathVariable UUID diagram,
      @Valid @RequestBody ShareProposal request) {
    return ResponseEntity.status(HttpStatus.CREATED).cacheControl(CacheControl.noStore())
        .body(service.shareProposal(project, diagram, request.id(), request.baseRevision(), request.instruction(), request.changes(), request.proposalData()));
  }

  @PostMapping("/assistant/claim")
  ResponseEntity<SharedAssistantService.Claim> claim(@PathVariable UUID project, @PathVariable UUID diagram) {
    var work = assistant.claim(project, diagram);
    return work == null ? ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build()
        : ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(work);
  }

  @PostMapping("/assistant/{id}/complete")
  ResponseEntity<SharedAssistantService.RequestStatus> complete(@PathVariable UUID project, @PathVariable UUID diagram,
      @PathVariable UUID id, @Valid @RequestBody Complete request) {
    return ResponseEntity.ok().cacheControl(CacheControl.noStore())
        .body(assistant.complete(project, diagram, id, request.token(), request.content(), request.failed(), request.failureReason()));
  }

  @PostMapping("/assistant/{id}/release")
  ResponseEntity<Void> release(@PathVariable UUID project, @PathVariable UUID diagram,
      @PathVariable UUID id, @Valid @RequestBody Release request) {
    assistant.release(project, diagram, id, request.token());
    return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
  }
}
