package bo.edu.modela.diagrams;

import bo.edu.modela.auth.CurrentUser;
import bo.edu.modela.projects.*;
import bo.edu.modela.shared.*;
import bo.edu.modela.users.Usuario;
import bo.edu.modela.users.UsuarioRepository;
import org.springframework.context.ApplicationEventPublisher;
import java.time.Instant;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

@Service
public class DiagramService {
  public record Summary(
      UUID id, String name, long revision, long versionActual, Instant updatedAt) {}

  public record Envelope(
      DiagramDocument document, long revision, long versionActual, String permiso) {}

  public record State(long revision, String permiso) {}
  public record Changed(UUID project, UUID diagram) {}
  public record LiveState(UUID userId, String name, long revision, String permiso) {}

  private final DiagramRepository diagrams;
  private final ProyectoRepository projects;
  private final ParticipacionRepository members;
  private final CurrentUser current;
  private final ObjectMapper json;
  private final UsuarioRepository users;
  private final ApplicationEventPublisher events;

  public DiagramService(
      DiagramRepository diagrams,
      ProyectoRepository projects,
      ParticipacionRepository members,
      CurrentUser current,
      ObjectMapper json,
      UsuarioRepository users,
      ApplicationEventPublisher events) {
    this.diagrams = diagrams;
    this.projects = projects;
    this.members = members;
    this.current = current;
    this.json = json;
    this.users = users;
    this.events = events;
  }

  private String access(UUID project, boolean write) {
    return access(project, write, current.get());
  }

  private String access(UUID project, boolean write, Usuario user) {
    var p = write ? projects.findLocked(project) : projects.findByIdAndEliminadoEnIsNull(project);
    if (p.isEmpty() || p.get().eliminadoEn != null) throw ApiException.notFound();
    if (user.rol == Usuario.Rol.ADMINISTRADOR) return "ADMINISTRACION";
    var membership =
        members.findByProyectoIdAndUsuarioId(project, user.id).orElseThrow(ApiException::notFound);
    if (write && membership.permiso != Participacion.Permiso.EDICION)
      throw ApiException.forbidden();
    return membership.permiso.name();
  }

  private Diagrama available(UUID project, UUID id) {
    var d = diagrams.find(id);
    if (d == null || !project.equals(d.proyectoId) || d.eliminadoEn != null)
      throw ApiException.notFound();
    return d;
  }

  private Envelope result(Diagrama d, DiagramDocument doc, String permission) {
    return new Envelope(doc, d.revision, d.versionActual, permission);
  }

  @Transactional(readOnly = true)
  public PageResult<Summary> list(UUID project, int page, int size) {
    access(project, false);
    page = Math.max(0, Math.min(page, 100000));
    size = Math.max(1, Math.min(size, 100));
    return new PageResult<>(
        diagrams.list(project, page, size).stream()
            .map(
                d -> new Summary(d.id, d.nombre, d.revision, d.versionActual, d.fechaActualizacion))
            .toList(),
        diagrams.count(project),
        page,
        size);
  }

  @Transactional(
      readOnly = true,
      isolation = org.springframework.transaction.annotation.Isolation.REPEATABLE_READ)
  public Envelope get(UUID project, UUID id) {
    String permission = access(project, false);
    var d = available(project, id);
    return result(d, diagrams.read(d), permission);
  }

  @Transactional(readOnly = true)
  public State state(UUID project, UUID id) {
    String permission = access(project, false);
    return new State(available(project, id).revision, permission);
  }

  @Transactional
  public Envelope forWrite(UUID project, UUID id) {
    String permission = access(project, true);
    var d = available(project, id);
    return result(d, diagrams.read(d), permission);
  }

  // WebSocket callbacks do not run in the HTTP SecurityContext. The handshake identity is
  // revalidated against the database, with a new transaction even after a save's commit.
  @Transactional(readOnly = true, propagation = org.springframework.transaction.annotation.Propagation.REQUIRES_NEW)
  public LiveState liveState(UUID project, UUID id, UUID userId) {
    var user = users.findById(userId).filter(u -> u.activo).orElseThrow(ApiException::unauthorized);
    String permission = access(project, false, user);
    return new LiveState(user.id, user.nombre, available(project, id).revision, permission);
  }

  @Transactional
  public void creationPermission(UUID project) { access(project, true); }

  @Transactional
  public Envelope createFresh(UUID project, DiagramDocument doc) {
    access(project, true);
    if (diagrams.find(doc.id()) != null)
      throw ApiException.conflict("El identificador del diagrama ya está ocupado.");
    return create(project, doc);
  }

  @Transactional
  public Envelope create(UUID project, DiagramDocument doc) {
    String permission = access(project, true);
    doc.validate();
    var existing = diagrams.find(doc.id());
    if (existing != null) {
      if (!project.equals(existing.proyectoId)) throw ApiException.notFound();
      if (existing.eliminadoEn == null
          && existing.revision == 0
          && doc.sameContent(diagrams.read(existing)))
        return result(existing, diagrams.read(existing), permission);
      throw ApiException.conflict("Este identificador ya existe. Recarga la lista de diagramas.");
    }
    var d = new Diagrama();
    d.id = doc.id();
    d.proyectoId = project;
    d.nombre = doc.name().trim();
    d.versionActual = 1;
    d.fechaActualizacion = Instant.now();
    diagrams.insert(d);
    diagrams.flush();
    diagrams.replace(doc);
    var saved = doc.persisted(d.revision, d.fechaActualizacion);
    diagrams.snapshot(d, json.writeValueAsString(saved));
    events.publishEvent(new Changed(project, d.id));
    return result(d, saved, permission);
  }

  @Transactional
  public Envelope update(UUID project, UUID id, long revision, DiagramDocument doc) {
    String permission = access(project, true);
    var d = available(project, id);
    if (d.revision != revision)
      throw ApiException.conflict(
          "Otra persona guardó este diagrama. Recarga antes de volver a editar; el servidor"
              + " conserva la versión más reciente.");
    doc.validate();
    if (!id.equals(doc.id()))
      throw ApiException.conflict("El identificador del documento no coincide con la ruta.");
    d.nombre = doc.name().trim();
    d.fechaActualizacion = Instant.now();
    d.versionActual++;
    diagrams.flush();
    diagrams.replace(doc);
    var saved = doc.persisted(d.revision, d.fechaActualizacion);
    diagrams.snapshot(d, json.writeValueAsString(saved));
    events.publishEvent(new Changed(project, d.id));
    return result(d, saved, permission);
  }

  @Transactional
  public void delete(UUID project, UUID id, long revision) {
    access(project, true);
    var d = available(project, id);
    if (d.revision != revision)
      throw ApiException.conflict("El diagrama cambió. Recarga antes de eliminarlo.");
    d.eliminadoEn = Instant.now();
    diagrams.flush();
    events.publishEvent(new Changed(project, id));
  }
}
