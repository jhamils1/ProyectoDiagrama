package bo.edu.modela.conversation;

import bo.edu.modela.auth.CurrentUser;
import bo.edu.modela.diagrams.DiagramService;
import bo.edu.modela.projects.ProyectoRepository;
import bo.edu.modela.shared.ApiException;
import java.time.Instant;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ConversationService {
  public record Message(UUID id, long sequence, UUID authorId, String authorName,
      String content, Instant createdAt, long diagramRevision, String kind, String executorName, String continuationQuestion,
      String proposalInstruction, String proposalData) {}
  public record AssistantStatus(UUID id, String status, String error) {}
  public record Page(List<Message> items, Long nextBefore, Long nextAfter, AssistantStatus assistant) {}
  private static final RowMapper<Message> MESSAGE = (rs, row) -> new Message(
      rs.getObject("id", UUID.class), rs.getLong("secuencia"), rs.getObject("autor_id", UUID.class),
      rs.getString("autor_nombre"), rs.getString("contenido"),
      rs.getTimestamp("fecha_creacion").toInstant(), rs.getLong("revision_diagrama"), rs.getString("tipo"), rs.getString("ejecutor_nombre"), rs.getString("siguiente_consulta"), rs.getString("instruccion_propuesta"), rs.getString("propuesta_datos"));
  private final DiagramService diagrams;
  private final ProyectoRepository projects;
  private final CurrentUser current;
  private final JdbcTemplate jdbc;

  public ConversationService(DiagramService diagrams, ProyectoRepository projects,
      CurrentUser current, JdbcTemplate jdbc) {
    this.diagrams = diagrams; this.projects = projects; this.current = current; this.jdbc = jdbc;
  }

  @Transactional(readOnly = true)
  public Page list(UUID project, UUID diagram, Long before, Long after, int size) {
    diagrams.state(project, diagram);
    if ((before != null && after != null) || (before != null && before < 1) || (after != null && after < 0))
      throw invalid("Usa un solo cursor válido para consultar la conversación.");
    int limit = Math.max(1, Math.min(size, 50));
    boolean forward = after != null;
    // Only the two fixed query shapes below are concatenated, never user text.
    var found = jdbc.query("SELECT * FROM mensaje_diagrama WHERE diagrama_id=? AND secuencia "
        + (forward ? "> ? ORDER BY secuencia ASC" : "< ? ORDER BY secuencia DESC") + " LIMIT ?",
        MESSAGE, diagram, forward ? after : before == null ? Long.MAX_VALUE : before, limit + 1);
    boolean more = found.size() > limit;
    var items = new ArrayList<>(found.subList(0, Math.min(limit, found.size())));
    if (!forward) Collections.reverse(items);
    var statuses = jdbc.query("SELECT id, CASE WHEN estado='PROCESANDO' AND vencimiento < now() THEN 'PENDIENTE' ELSE estado END AS estado, error FROM solicitud_ia_diagrama WHERE diagrama_id=? ORDER BY creado_en DESC, id DESC LIMIT 1",
        (rs, row) -> new AssistantStatus(rs.getObject("id", UUID.class), rs.getString("estado"), rs.getString("error")), diagram);
    return new Page(List.copyOf(items), more && !forward ? items.getFirst().sequence() : null,
        more && forward ? items.getLast().sequence() : null, statuses.isEmpty() ? null : statuses.getFirst());
  }

  @Transactional
  public Message send(UUID project, UUID diagram, UUID messageId, String content) {
    // Load the authenticated entity before the project's lazy creator reference.
    // The existing user model exposes fields directly, so an uninitialized proxy
    // must not be mistaken for an inactive authenticated user.
    var author = current.get();
    // Serialize against diagram writes and membership revocation. CONSULTA may talk,
    // but this path never grants permission to edit the UML model.
    projects.findLocked(project).filter(p -> p.eliminadoEn == null).orElseThrow(ApiException::notFound);
    var state = diagrams.state(project, diagram);
    if (messageId == null || content == null || content.isBlank() || content.length() > 4000 || content.indexOf(0) >= 0)
      throw invalid("Escribe un mensaje de entre 1 y 4000 caracteres.");
    String text = content.strip();
    var existing = jdbc.query("SELECT * FROM mensaje_diagrama WHERE diagrama_id=? AND id=?",
        MESSAGE, diagram, messageId);
    if (!existing.isEmpty()) {
      var previous = existing.getFirst();
      if (!Objects.equals(previous.authorId(), author.id) || !previous.content().equals(text))
        throw ApiException.conflict("La clave de reintento pertenece a otro mensaje.");
      return previous;
    }
    jdbc.update("INSERT INTO conversacion_diagrama(diagrama_id) VALUES (?) ON CONFLICT DO NOTHING", diagram);
    long sequence = jdbc.queryForObject("""
        UPDATE conversacion_diagrama SET ultima_secuencia=ultima_secuencia+1
        WHERE diagrama_id=? RETURNING ultima_secuencia
        """, Long.class, diagram);
    var now = Instant.now();
    jdbc.update("""
        INSERT INTO mensaje_diagrama(id,diagrama_id,secuencia,autor_id,autor_nombre,contenido,fecha_creacion,revision_diagrama)
        VALUES (?,?,?,?,?,?,?,?)
        """, messageId, diagram, sequence, author.id, author.nombre, text,
        java.sql.Timestamp.from(now), state.revision());
    return new Message(messageId, sequence, author.id, author.nombre, text, now, state.revision(), "PERSONA", null, null, null, null);
  }

  @Transactional
  public boolean hasAppliedEdit(UUID diagram, UUID changeId) {
    UUID questionId = UUID.nameUUIDFromBytes((changeId + ":edit-question").getBytes(java.nio.charset.StandardCharsets.UTF_8));
    return !jdbc.query("SELECT id FROM mensaje_diagrama WHERE diagrama_id=? AND id=?", (rs, row) -> rs.getObject(1), diagram, questionId).isEmpty();
  }

  @Transactional
  public void recordAppliedEdit(UUID project, UUID diagram, UUID changeId, String instruction, String answer, long revision) {
    UUID questionId = UUID.nameUUIDFromBytes((changeId + ":edit-question").getBytes(java.nio.charset.StandardCharsets.UTF_8));
    UUID answerId = UUID.nameUUIDFromBytes((changeId + ":edit-answer").getBytes(java.nio.charset.StandardCharsets.UTF_8));
    send(project, diagram, questionId, instruction);
    if (!jdbc.query("SELECT id FROM mensaje_diagrama WHERE diagrama_id=? AND id=?", (rs, row) -> rs.getObject(1), diagram, answerId).isEmpty()) return;
    long sequence = jdbc.queryForObject("UPDATE conversacion_diagrama SET ultima_secuencia=ultima_secuencia+1 WHERE diagrama_id=? RETURNING ultima_secuencia", Long.class, diagram);
    jdbc.update("""
        INSERT INTO mensaje_diagrama(id,diagrama_id,secuencia,autor_id,autor_nombre,contenido,fecha_creacion,revision_diagrama,tipo)
        VALUES (?,?,?,NULL,'Asistente · edición',?,?,?,'ASISTENTE')
        """, answerId, diagram, sequence, answer, java.sql.Timestamp.from(Instant.now()), revision);
  }

  @Transactional
  public Message shareProposal(UUID project, UUID diagram, UUID id, long baseRevision, String instruction, List<String> changes, String proposalData) {
    var author = current.get();
    projects.findLocked(project).filter(p -> p.eliminadoEn == null).orElseThrow(ApiException::notFound);
    var state = diagrams.state(project, diagram);
    if (!Set.of("EDICION", "ADMINISTRACION").contains(state.permiso())) throw ApiException.forbidden();
    if (id == null || baseRevision < 0 || instruction == null || instruction.isBlank() || instruction.length() > 1500
        || changes == null || changes.isEmpty() || changes.size() > 8
        || instruction.indexOf(0) >= 0 || changes.stream().anyMatch(s -> s == null || s.isBlank() || s.length() > 300 || s.indexOf(0) >= 0)
        || (proposalData != null && (proposalData.isBlank() || proposalData.length() > 16000 || proposalData.indexOf(0) >= 0)))
      throw invalid("La propuesta contiene datos inválidos.");
    String text = "Instrucción: " + instruction.strip() + "\nCambios propuestos:\n- "
        + String.join("\n- ", changes.stream().map(String::strip).toList())
        + "\nSin aplicar al momento de compartir. Revisa el diagrama antes de actuar.";
    if (text.length() > 4000) throw invalid("La propuesta supera el tamaño permitido.");
    var existing = jdbc.query("SELECT * FROM mensaje_diagrama WHERE diagrama_id=? AND id=?", MESSAGE, diagram, id);
    if (!existing.isEmpty()) {
      var previous = existing.getFirst();
      if (!"PROPUESTA".equals(previous.kind()) || !Objects.equals(previous.authorId(), author.id)
          || previous.diagramRevision() != baseRevision || !previous.content().equals(text)
          || !Objects.equals(previous.proposalData(), proposalData))
        throw ApiException.conflict("La clave de reintento pertenece a otra propuesta.");
      return previous;
    }
    if (state.revision() != baseRevision) throw ApiException.conflict("El diagrama cambió. Genera una propuesta nueva antes de compartirla.");
    jdbc.update("INSERT INTO conversacion_diagrama(diagrama_id) VALUES (?) ON CONFLICT DO NOTHING", diagram);
    long sequence = jdbc.queryForObject("UPDATE conversacion_diagrama SET ultima_secuencia=ultima_secuencia+1 WHERE diagrama_id=? RETURNING ultima_secuencia", Long.class, diagram);
    var now = Instant.now();
    jdbc.update("""
        INSERT INTO mensaje_diagrama(id,diagrama_id,secuencia,autor_id,autor_nombre,contenido,fecha_creacion,revision_diagrama,tipo,instruccion_propuesta,propuesta_datos)
        VALUES (?,?,?,?,?,?,?,?,'PROPUESTA',?,?)
        """, id, diagram, sequence, author.id, author.nombre, text, java.sql.Timestamp.from(now), baseRevision, instruction.strip(), proposalData);
    return new Message(id, sequence, author.id, author.nombre, text, now, baseRevision, "PROPUESTA", null, null, instruction.strip(), proposalData);
  }

  private static ApiException invalid(String message) {
    return new ApiException(HttpStatus.BAD_REQUEST, "CONVERSACION_INVALIDA", message);
  }
}
