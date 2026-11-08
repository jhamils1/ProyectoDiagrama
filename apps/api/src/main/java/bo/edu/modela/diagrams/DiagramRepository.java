package bo.edu.modela.diagrams;

import bo.edu.modela.diagrams.DiagramDocument.*;
import jakarta.persistence.EntityManager;
import java.util.*;
import org.springframework.stereotype.Repository;

@Repository
public class DiagramRepository {
  private final EntityManager em;

  public DiagramRepository(EntityManager em) {
    this.em = em;
  }

  public Diagrama find(UUID id) {
    return em.find(Diagrama.class, id);
  }

  public List<Diagrama> list(UUID project, int page, int size) {
    return em.createQuery(
            "from Diagrama where proyectoId=:p and eliminadoEn is null order by nombre,id",
            Diagrama.class)
        .setParameter("p", project)
        .setFirstResult(page * size)
        .setMaxResults(size)
        .getResultList();
  }

  public long count(UUID project) {
    return em.createQuery(
            "select count(d) from Diagrama d where proyectoId=:p and eliminadoEn is null",
            Long.class)
        .setParameter("p", project)
        .getSingleResult();
  }

  public void insert(Diagrama diagram) {
    em.persist(diagram);
  }

  public void flush() {
    em.flush();
  }

  public DiagramDocument read(Diagrama d) {
    var classes =
        em.createQuery("from ClaseUML where diagramaId=:d order by orden", ClaseUML.class)
            .setParameter("d", d.id)
            .getResultList();
    List<AtributoUML> attrs =
        classes.isEmpty()
            ? List.of()
            : em.createQuery(
                    "from AtributoUML where claseId in :ids order by orden", AtributoUML.class)
                .setParameter("ids", classes.stream().map(c -> c.id).toList())
                .getResultList();
    Map<UUID, List<AttributeData>> grouped = new HashMap<>();
    for (var a : attrs)
      grouped
          .computeIfAbsent(a.claseId, k -> new ArrayList<>())
          .add(
              new AttributeData(
                  a.id, a.nombre, a.tipoDato, a.visibilidad, a.identificador, a.obligatorio));
    var relations =
        em.createQuery("from RelacionUML where diagramaId=:d order by orden", RelacionUML.class)
            .setParameter("d", d.id)
            .getResultList();
    var document = new DiagramDocument(
        1,
        d.id,
        d.nombre,
        d.revision,
        d.fechaActualizacion,
        classes.stream()
            .map(
                c ->
                    new ClassData(
                        c.id,
                        c.nombre,
                        c.abstracta,
                        new Position(c.posicionX, c.posicionY),
                        grouped.getOrDefault(c.id, List.of())))
            .toList(),
        relations.stream()
            .map(
                r ->
                    new RelationData(
                        r.id,
                        r.tipo,
                        r.origenId,
                        r.destinoId,
                        r.nombre,
                        r.multiplicidadOrigen,
                        r.multiplicidadDestino,
                        r.claseAsociacionId))
            .toList());
    // A proposal may read and replace the graph in the same transaction. Bulk deletion does
    // not detach these rows: keep the aggregate/header managed, but release graph identities.
    attrs.forEach(em::detach);
    relations.forEach(em::detach);
    classes.forEach(em::detach);
    return document;
  }

  public void replace(DiagramDocument doc) {
    // Snapshot history is immutable; only the current graph is replaced atomically.
    em.createQuery(
            "delete from AtributoUML where claseId in (select id from ClaseUML where"
                + " diagramaId=:d)")
        .setParameter("d", doc.id())
        .executeUpdate();
    em.createQuery("delete from RelacionUML where diagramaId=:d")
        .setParameter("d", doc.id())
        .executeUpdate();
    em.createQuery("delete from ClaseUML where diagramaId=:d")
        .setParameter("d", doc.id())
        .executeUpdate();
    int order = 0;
    for (var c : doc.classes()) {
      var row = new ClaseUML();
      row.id = c.id();
      row.diagramaId = doc.id();
      row.nombre = c.name();
      row.abstracta = c.abstractClass();
      row.posicionX = c.position().x();
      row.posicionY = c.position().y();
      row.orden = order++;
      em.persist(row);
      int attributeOrder = 0;
      for (var a : c.attributes()) {
        var attr = new AtributoUML();
        attr.id = a.id();
        attr.claseId = c.id();
        attr.nombre = a.name();
        attr.tipoDato = a.dataType();
        attr.visibilidad = a.visibility();
        attr.identificador = a.identifier();
        attr.obligatorio = a.required();
        attr.orden = attributeOrder++;
        em.persist(attr);
      }
    }
    order = 0;
    for (var r : doc.relations()) {
      var row = new RelacionUML();
      row.id = r.id();
      row.diagramaId = doc.id();
      row.origenId = r.sourceId();
      row.destinoId = r.targetId();
      row.tipo = r.type();
      row.nombre = r.name();
      row.multiplicidadOrigen = r.sourceMultiplicity();
      row.multiplicidadDestino = r.targetMultiplicity();
      row.claseAsociacionId = r.associationClassId();
      row.orden = order++;
      em.persist(row);
    }
    em.flush();
  }

  public void snapshot(Diagrama d, String content, UUID authorId, String authorName) {
    var v = new VersionDiagrama();
    v.id = UUID.randomUUID();
    v.diagramaId = d.id;
    v.numero = d.versionActual;
    v.fechaCreacion = d.fechaActualizacion;
    v.contenido = content;
    v.autorId = authorId;
    v.autorNombre = authorName;
    em.persist(v);
    em.flush();
  }
}
