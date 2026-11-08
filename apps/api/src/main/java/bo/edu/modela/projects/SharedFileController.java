package bo.edu.modela.projects;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/projects/{project}/files")
public class SharedFileController {
  private final SharedFileService service;
  private final boolean uploadsEnabled;
  public SharedFileController(SharedFileService service,
      @Value("${modela.shared-files.uploads-enabled:false}") boolean uploadsEnabled) {
    this.service=service;
    this.uploadsEnabled=uploadsEnabled;
  }
  @GetMapping List<SharedFileService.FileInfo> list(@PathVariable UUID project) { return service.list(project); }
  @PostMapping(consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
  @ResponseStatus(HttpStatus.NO_CONTENT)
  void upload(@PathVariable UUID project, @RequestParam UUID id, @RequestParam MultipartFile file) throws IOException {
    if (!uploadsEnabled) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "La subida de archivos está deshabilitada por ahora.");
    service.upload(project,id,file.getOriginalFilename(),file.getBytes());
  }
  @GetMapping("/{id}") ResponseEntity<byte[]> download(@PathVariable UUID project,@PathVariable UUID id) {
    var file=service.download(project,id);
    return ResponseEntity.ok().contentType(MediaType.APPLICATION_OCTET_STREAM)
        .header(HttpHeaders.CONTENT_DISPOSITION,ContentDisposition.attachment().filename(file.name(),StandardCharsets.UTF_8).build().toString())
        .header("X-Content-Type-Options","nosniff").cacheControl(CacheControl.noStore()).body(file.data());
  }
  @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
  void delete(@PathVariable UUID project,@PathVariable UUID id) { service.delete(project,id); }
}
