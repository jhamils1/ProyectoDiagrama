package bo.edu.modela.diagrams.changes;

import bo.edu.modela.diagrams.VersionDiagrama;
import bo.edu.modela.shared.ApiException;
import jakarta.persistence.EntityManager;
import java.util.*;
import org.springframework.stereotype.Repository;

@Repository
public class ChangeRepository {
  private final EntityManager em;
  public ChangeRepository(EntityManager em) { this.em = em; }
  public Cambio find(UUID id) { return em.find(Cambio.class, id); }
  public void insert(Object row) { em.persist(row); }
  public VersionDiagrama version(UUID diagram, long revision) {
    return em.createQuery("from VersionDiagrama where diagramaId=:id and numero=:n", VersionDiagrama.class)
        .setParameter("id", diagram).setParameter("n", revision + 1).getResultStream()
        .findFirst().orElseThrow(() -> ApiException.conflict("La versión base no existe."));
  }
  public List<Cambio> pending(UUID diagram, UUID author) {
    return em.createQuery("from Cambio where diagramaId=:d and autorId=:u and estado='PENDIENTE' order by fechaCreacion,id", Cambio.class)
        .setParameter("d", diagram).setParameter("u", author).setMaxResults(20).getResultList();
  }
  public List<Conflicto> conflicts(UUID change) {
    return em.createQuery("from Conflicto where cambioId=:c and estado='PENDIENTE' order by ruta", Conflicto.class)
        .setParameter("c", change).getResultList();
  }
  public void flush() { em.flush(); }
}
