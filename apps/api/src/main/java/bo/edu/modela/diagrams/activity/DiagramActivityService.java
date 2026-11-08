package bo.edu.modela.diagrams.activity;

import bo.edu.modela.diagrams.DiagramDocument;
import bo.edu.modela.diagrams.DiagramService;
import bo.edu.modela.shared.ApiException;
import java.time.Instant;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

@Service
public class DiagramActivityService {
  public record Entry(long version, Instant createdAt, UUID authorId, String authorName,
      List<DiagramActivityDiff.Change> changes, int totalChanges) {}
  public record Page(List<Entry> items, Long nextBeforeVersion) {}
  public record ChangePage(long version, List<DiagramActivityDiff.Change> items,
      int totalChanges, Integer nextOffset) {}
  private final DiagramService diagrams;
  private final JdbcTemplate jdbc;
  private final ObjectMapper json;

  public DiagramActivityService(DiagramService diagrams, JdbcTemplate jdbc, ObjectMapper json) {
    this.diagrams = diagrams; this.jdbc = jdbc; this.json = json;
  }

  @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
  public Page list(UUID project, UUID diagram, Long beforeVersion, int size) {
    // Same access checks as opening the diagram, including inactive users/deleted projects.
    diagrams.state(project, diagram);
    if (beforeVersion != null && beforeVersion < 1)
      throw new ApiException(HttpStatus.BAD_REQUEST, "CURSOR_INVALIDO", "La versión debe ser positiva.");
    int limit = Math.max(1, Math.min(size, 20));
    // Keyset pagination remains stable when new versions arrive while reading older activity.
    // The unique (diagrama_id, numero) index also supports the predecessor join.
    var entries = jdbc.query("""
        SELECT v.numero, v.fecha_creacion, v.autor_id, v.autor_nombre,
               v.contenido::text AS current_content, p.contenido::text AS previous_content
        FROM version_diagrama v
        LEFT JOIN version_diagrama p ON p.diagrama_id=v.diagrama_id AND p.numero=v.numero-1
        WHERE v.diagrama_id=? AND v.numero < ?
        ORDER BY v.numero DESC LIMIT ?
        """, (rs, row) -> {
      var previous = rs.getString("previous_content");
      var changes = DiagramActivityDiff.between(
          previous == null ? null : json.readValue(previous, DiagramDocument.class),
          json.readValue(rs.getString("current_content"), DiagramDocument.class));
      return new Entry(rs.getLong("numero"), rs.getTimestamp("fecha_creacion").toInstant(),
          rs.getObject("autor_id", UUID.class), rs.getString("autor_nombre"),
          changes.stream().limit(100).toList(), changes.size());
    }, diagram, beforeVersion == null ? Long.MAX_VALUE : beforeVersion, limit + 1);
    boolean more = entries.size() > limit;
    var items = List.copyOf(entries.subList(0, Math.min(limit, entries.size())));
    return new Page(items, more ? items.getLast().version() : null);
  }

  @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
  public ChangePage changes(UUID project, UUID diagram, long version, int offset, int size) {
    diagrams.state(project, diagram);
    if (version < 1 || offset < 0 || size < 1 || size > 100)
      throw new ApiException(HttpStatus.BAD_REQUEST, "PAGINA_INVALIDA", "Los parámetros de actividad no son válidos.");
    var rows = jdbc.query("""
        SELECT v.contenido::text AS current_content, p.contenido::text AS previous_content
        FROM version_diagrama v
        LEFT JOIN version_diagrama p ON p.diagrama_id=v.diagrama_id AND p.numero=v.numero-1
        WHERE v.diagrama_id=? AND v.numero=?
        """, (rs, row) -> {
      var previous = rs.getString("previous_content");
      if (version > 1 && previous == null)
        throw new ApiException(HttpStatus.CONFLICT, "HISTORIAL_INCOMPLETO", "No se encuentra la versión anterior para comparar los cambios.");
      return DiagramActivityDiff.between(
          previous == null ? null : json.readValue(previous, DiagramDocument.class),
          json.readValue(rs.getString("current_content"), DiagramDocument.class));
    }, diagram, version);
    if (rows.isEmpty())
      throw new ApiException(HttpStatus.NOT_FOUND, "VERSION_NO_ENCONTRADA", "No se encontró la versión solicitada.");
    var changes = rows.getFirst();
    int start = Math.min(offset, changes.size());
    int end = Math.min(start + size, changes.size());
    return new ChangePage(version, List.copyOf(changes.subList(start, end)), changes.size(),
        end < changes.size() ? end : null);
  }
}
