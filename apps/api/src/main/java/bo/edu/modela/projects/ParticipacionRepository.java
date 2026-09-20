package bo.edu.modela.projects;

import java.util.*;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;

public interface ParticipacionRepository extends JpaRepository<Participacion, UUID> {
  Optional<Participacion> findByProyectoIdAndUsuarioId(UUID projectId, UUID userId);

  @EntityGraph(attributePaths = {"usuario"})
  Optional<Participacion> findByIdAndProyectoId(UUID id, UUID projectId);

  @EntityGraph(attributePaths = {"usuario"})
  Page<Participacion> findByProyectoId(UUID projectId, Pageable page);

  @EntityGraph(attributePaths = {"proyecto"})
  List<Participacion> findByUsuarioIdAndProyectoIdIn(UUID userId, Collection<UUID> projectIds);
}
