package bo.edu.modela.projects;

import java.util.*;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface ProyectoRepository extends JpaRepository<Proyecto, UUID> {
  Optional<Proyecto> findByIdAndEliminadoEnIsNull(UUID id);

  Page<Proyecto> findByEliminadoEnIsNull(Pageable page);

  @Query(
      "select p from Proyecto p where p.eliminadoEn is null and exists (select a.id from"
          + " Participacion a where a.proyecto=p and a.usuario.id=:userId)")
  Page<Proyecto> findAuthorized(@Param("userId") UUID userId, Pageable page);
}
