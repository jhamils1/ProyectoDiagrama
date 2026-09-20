package bo.edu.modela.users;

import bo.edu.modela.shared.PageResult;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.UUID;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/users")
public class UsuarioController {
  record Create(
      @NotBlank @Size(max = 100) String nombre, @NotBlank @Email @Size(max = 254) String correo) {}

  record Update(
      @NotBlank @Size(max = 100) String nombre,
      @NotNull Boolean activo,
      @NotNull @PositiveOrZero Long revision) {}

  private final UsuarioService service;

  public UsuarioController(UsuarioService service) {
    this.service = service;
  }

  @GetMapping
  PageResult<UsuarioDto> list(
      @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
    return service.list(page, size);
  }

  @PostMapping
  @ResponseStatus(org.springframework.http.HttpStatus.CREATED)
  UsuarioDto create(@Valid @RequestBody Create b) {
    return service.create(b.nombre(), b.correo());
  }

  @PutMapping("/{id}")
  UsuarioDto update(@PathVariable UUID id, @Valid @RequestBody Update b) {
    return service.update(id, b.nombre(), b.activo(), b.revision());
  }
}
