package bo.edu.modela.projects;

import bo.edu.modela.auth.CurrentUser;
import bo.edu.modela.shared.*;
import bo.edu.modela.users.*;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProyectoService {
  public record MemberDto(
      UUID id, UsuarioDto usuario, Participacion.Permiso permiso, long revision) {
    static MemberDto of(Participacion p) {
      return new MemberDto(p.id, UsuarioDto.of(p.usuario), p.permiso, p.revision);
    }
  }

  private final ProyectoRepository projects;
  private final ParticipacionRepository members;
  private final UsuarioRepository users;
  private final CurrentUser current;

  public ProyectoService(
      ProyectoRepository projects,
      ParticipacionRepository members,
      UsuarioRepository users,
      CurrentUser current) {
    this.projects = projects;
    this.members = members;
    this.users = users;
    this.current = current;
  }

  @Transactional(readOnly = true)
  public PageResult<ProyectoDto> list(int page, int size) {
    Usuario u = current.get();
    var request = PageResult.request(page, size);
    if (u.rol == Usuario.Rol.ADMINISTRADOR)
      return PageResult.of(
          projects.findByEliminadoEnIsNull(request).map(p -> ProyectoDto.of(p, "ADMINISTRACION")));
    var result = projects.findAuthorized(u.id, request);
    Map<UUID, String> permissions =
        members
            .findByUsuarioIdAndProyectoIdIn(u.id, result.stream().map(p -> p.id).toList())
            .stream()
            .collect(Collectors.toMap(p -> p.proyecto.id, p -> p.permiso.name()));
    return PageResult.of(result.map(p -> ProyectoDto.of(p, permissions.get(p.id))));
  }

  @Transactional(readOnly = true)
  public ProyectoDto get(UUID id) {
    var user = current.get();
    var project = available(id);
    String permission =
        user.rol == Usuario.Rol.ADMINISTRADOR
            ? "ADMINISTRACION"
            : members
                .findByProyectoIdAndUsuarioId(id, user.id)
                .map(m -> m.permiso.name())
                .orElseThrow(ApiException::notFound);
    return ProyectoDto.of(project, permission);
  }

  @Transactional
  public ProyectoDto create(String name, String description) {
    var admin = current.admin();
    var project = new Proyecto(name, description, admin);
    return ProyectoDto.of(projects.saveAndFlush(project), "ADMINISTRACION");
  }

  @Transactional
  public ProyectoDto update(UUID id, String name, String description, long revision) {
    current.admin();
    var p = available(id);
    checkRevision(p.revision, revision);
    p.nombre = name.trim();
    p.descripcion = description.trim();
    return ProyectoDto.of(projects.saveAndFlush(p), "ADMINISTRACION");
  }

  @Transactional
  public void delete(UUID id, long revision) {
    current.admin();
    var p = available(id);
    checkRevision(p.revision, revision);
    p.eliminadoEn = Instant.now();
    projects.saveAndFlush(p);
  }

  @Transactional(readOnly = true)
  public PageResult<MemberDto> members(UUID projectId, int page, int size) {
    current.admin();
    available(projectId);
    return PageResult.of(
        members
            .findByProyectoId(
                projectId,
                PageRequest.of(
                    Math.max(0, page),
                    Math.max(1, Math.min(100, size)),
                    Sort.by("fechaIngreso").and(Sort.by("id"))))
            .map(MemberDto::of));
  }

  @Transactional
  public MemberDto add(UUID projectId, UUID userId, Participacion.Permiso permission) {
    current.admin();
    var project = available(projectId);
    var user = users.findById(userId).orElseThrow(ApiException::notFound);
    if (!user.activo || user.rol != Usuario.Rol.COLABORADOR)
      throw ApiException.conflict("Selecciona un Colaborador activo.");
    return MemberDto.of(members.saveAndFlush(new Participacion(user, project, permission)));
  }

  @Transactional
  public MemberDto change(
      UUID projectId, UUID id, Participacion.Permiso permission, long revision) {
    current.admin();
    available(projectId);
    var member = members.findByIdAndProyectoId(id, projectId).orElseThrow(ApiException::notFound);
    checkRevision(member.revision, revision);
    member.permiso = permission;
    return MemberDto.of(members.saveAndFlush(member));
  }

  @Transactional
  public void remove(UUID projectId, UUID id, long revision) {
    current.admin();
    available(projectId);
    var member = members.findByIdAndProyectoId(id, projectId).orElseThrow(ApiException::notFound);
    checkRevision(member.revision, revision);
    members.delete(member);
    members.flush();
  }

  private Proyecto available(UUID id) {
    return projects.findByIdAndEliminadoEnIsNull(id).orElseThrow(ApiException::notFound);
  }

  private void checkRevision(long actual, long expected) {
    if (actual != expected)
      throw ApiException.conflict("Los datos cambiaron. Recarga antes de guardar.");
  }
}
