package bo.edu.modela.interoperability;

import bo.edu.modela.diagrams.DiagramService;
import bo.edu.modela.shared.ApiException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/projects/{project}/imports/xmi")
public class XmiPreviewController {
  public record Request(
      @NotBlank @Size(max=100) String name,
      @NotBlank @Size(max=2796204) String xmlBase64,
      @NotNull @Size(max=20000) Map<@NotBlank @Size(max=200) String, @NotBlank @Size(max=20) String> attributeTypes,
      @NotNull @Size(max=500) Set<@NotBlank @Size(max=200) String> excludedInvalidAssociations) {}
  private final DiagramService diagrams;
  public XmiPreviewController(DiagramService diagrams) { this.diagrams=diagrams; }

  @PostMapping("/preview")
  public ResponseEntity<EaXmiConverter.Preview> preview(@PathVariable UUID project, @Valid @RequestBody Request request) {
    diagrams.creationPermission(project);
    try {
      var bytes=Base64.getDecoder().decode(request.xmlBase64());
      return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(
          EaXmiConverter.preview(bytes,request.name(),request.attributeTypes(),request.excludedInvalidAssociations()));
    } catch(IllegalArgumentException ex) {
      throw new ApiException(HttpStatus.BAD_REQUEST,"XMI_INVALIDO",ex.getMessage());
    }
  }
}
