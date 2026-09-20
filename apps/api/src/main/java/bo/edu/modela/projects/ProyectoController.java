package bo.edu.modela.projects;

import bo.edu.modela.shared.PageResult;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/projects")
public class ProyectoController {
  record Create(
      @NotBlank @Size(max = 100) String nombre, @NotNull @Size(max = 2000) String descripcion) {}

  record Update(
      @NotBlank @Size(max = 100) String nombre,
      @NotNull @Size(max = 2000) String descripcion,
      @NotNull @PositiveOrZero Long revision) {}

  record AddMember(@NotNull UUID usuarioId, @NotNull Participacion.Permiso permiso) {}

  record ChangeMember(
      @NotNull Participacion.Permiso permiso, @NotNull @PositiveOrZero Long revision) {}

  private final ProyectoService service;

  public ProyectoController(ProyectoService service) {
    this.service = service;
  }

  @GetMapping
  PageResult<ProyectoDto> list(
      @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
    return service.list(page, size);
  }

  @GetMapping("/{id}")
  ProyectoDto get(@PathVariable UUID id) {
    return service.get(id);
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  ProyectoDto create(@Valid @RequestBody Create b) {
    return service.create(b.nombre(), b.descripcion());
  }

  @PutMapping("/{id}")
  ProyectoDto update(@PathVariable UUID id, @Valid @RequestBody Update b) {
    return service.update(id, b.nombre(), b.descripcion(), b.revision());
  }

  @DeleteMapping("/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  void delete(@PathVariable UUID id, @RequestParam long revision) {
    service.delete(id, revision);
  }

  @GetMapping("/{id}/members")
  PageResult<ProyectoService.MemberDto> members(
      @PathVariable UUID id,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    return service.members(id, page, size);
  }

  @PostMapping("/{id}/members")
  @ResponseStatus(HttpStatus.CREATED)
  ProyectoService.MemberDto add(@PathVariable UUID id, @Valid @RequestBody AddMember b) {
    return service.add(id, b.usuarioId(), b.permiso());
  }

  @PutMapping("/{id}/members/{memberId}")
  ProyectoService.MemberDto change(
      @PathVariable UUID id, @PathVariable UUID memberId, @Valid @RequestBody ChangeMember b) {
    return service.change(id, memberId, b.permiso(), b.revision());
  }

  @DeleteMapping("/{id}/members/{memberId}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  void remove(@PathVariable UUID id, @PathVariable UUID memberId, @RequestParam long revision) {
    service.remove(id, memberId, revision);
  }
}
