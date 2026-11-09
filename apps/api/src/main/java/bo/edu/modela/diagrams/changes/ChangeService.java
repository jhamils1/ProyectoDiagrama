package bo.edu.modela.diagrams.changes;

import bo.edu.modela.auth.CurrentUser;
import bo.edu.modela.diagrams.*;
import bo.edu.modela.conversation.ConversationService;
import bo.edu.modela.diagrams.activity.DiagramActivityDiff;
import bo.edu.modela.shared.ApiException;
import java.time.Instant;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

@Service
public class ChangeService {
  public record Response(UUID id, String status, long baseRevision, long comparedRevision,
      DiagramDocument proposed, List<DiagramMerge.Difference> conflicts, DiagramService.Envelope current, boolean assistantRecorded) {}
  private final ChangeRepository rows;
  private final DiagramService diagrams;
  private final DiagramMerge merge;
  private final CurrentUser users;
  private final ObjectMapper json;
  private final ConversationService conversation;
  public ChangeService(ChangeRepository rows, DiagramService diagrams, DiagramMerge merge,
      CurrentUser users, ObjectMapper json, ConversationService conversation) {
    this.rows=rows; this.diagrams=diagrams; this.merge=merge; this.users=users; this.json=json; this.conversation=conversation;
  }
  private DiagramDocument decode(String value) { return json.readValue(value, DiagramDocument.class); }
  private Cambio own(UUID diagram, UUID id) {
    var c=rows.find(id);
    if(c==null || !c.diagramaId.equals(diagram) || !c.autorId.equals(users.get().id)) throw ApiException.notFound();
    return c;
  }
  private Response response(Cambio c, DiagramService.Envelope current) {
    var base=decode(c.valorAnterior);
    var proposal=decode(c.valorPropuesto);
    // Persisted comparison values remain stable until an explicit resolution refreshes them.
    List<DiagramMerge.Difference> differences=List.of();
    if(c.estado.equals("PENDIENTE")) {
      var compared=decode(rows.version(c.diagramaId,c.revisionComparada).contenido);
      differences=merge.merge(base,proposal,compared,Map.of()).conflicts();
    }
    return new Response(c.id,c.estado,c.revisionBase,c.revisionComparada,proposal,differences,current,
        conversation.hasAppliedEdit(c.diagramaId,c.id));
  }
  @Transactional(readOnly=true)
  public List<UUID> pending(UUID project, UUID diagram) {
    diagrams.state(project,diagram);
    return rows.pending(diagram,users.get().id).stream().map(c->c.id).toList();
  }
  @Transactional(readOnly=true)
  public Response get(UUID project, UUID diagram, UUID change) {
    var current=diagrams.get(project,diagram);
    return response(own(diagram,change),current);
  }
  @Transactional
  public Response create(UUID project, UUID diagram, UUID id, DiagramDocument proposal) {
    diagrams.creationPermission(project);
    proposal.validate();
    if(!diagram.equals(proposal.id())) throw DiagramMerge.invalid();
    var existing=rows.find(id);
    if(existing!=null) {
      var c=own(diagram,id);
      if(!c.operacion.equals("CREAR") || !proposal.sameContent(decode(c.valorPropuesto)))
        throw ApiException.conflict("La clave de reintento pertenece a otra creación.");
      return response(c,diagrams.get(project,diagram));
    }
    var saved=diagrams.createFresh(project,proposal);
    var version=rows.version(diagram,0);
    var c=new Cambio();
    c.id=id; c.diagramaId=diagram; c.autorId=users.get().id; c.elementoId=diagram;
    c.versionBaseId=version.id; c.revisionBase=0; c.revisionComparada=0;
    c.tipoElemento="DIAGRAMA"; c.propiedad="contenido"; c.operacion="CREAR";
    c.valorAnterior="null"; c.valorPropuesto=json.writeValueAsString(proposal);
    c.estado="APLICADO"; c.fechaCreacion=Instant.now(); c.fechaResolucion=c.fechaCreacion;
    rows.insert(c); rows.flush();
    return response(c,saved);
  }

  @Transactional
  public Response propose(UUID project, UUID diagram, UUID id, long baseRevision, DiagramDocument proposal, String assistantInstruction) {
    if (assistantInstruction != null && (assistantInstruction.isBlank() || assistantInstruction.length() > 1500 || assistantInstruction.indexOf(0) >= 0))
      throw DiagramMerge.invalid();
    var current=diagrams.forWrite(project,diagram);
    proposal.requireMethodCompatible(current.document());
    proposal.validate();
    if(!diagram.equals(proposal.id())) throw DiagramMerge.invalid();
    var existing=rows.find(id);
    if(existing!=null) {
      var own=own(diagram,id);
      if(!own.operacion.equals("EDITAR") || own.revisionBase!=baseRevision || !proposal.sameContent(decode(own.valorPropuesto)))
        throw ApiException.conflict("La clave de reintento pertenece a otra propuesta.");
      return response(own,current);
    }
    var version=rows.version(diagram,baseRevision);
    var base=decode(version.contenido);
    var c=new Cambio();
    c.id=id; c.diagramaId=diagram; c.autorId=users.get().id; c.elementoId=diagram;
    c.versionBaseId=version.id; c.revisionBase=baseRevision; c.revisionComparada=current.revision();
    c.tipoElemento="DIAGRAMA"; c.propiedad="contenido"; c.operacion="EDITAR";
    c.valorAnterior=version.contenido; c.valorPropuesto=json.writeValueAsString(proposal);
    c.estado="PENDIENTE"; c.fechaCreacion=Instant.now(); rows.insert(c);
    var result=merge.merge(base,proposal,current.document(),Map.of());
    if(result.conflicts().isEmpty()) {
      var saved = apply(project,c,current,result.document());
      if (assistantInstruction != null) {
        var diff = DiagramActivityDiff.between(current.document(), saved.current().document());
        var created = diff.stream().filter(d -> d.kind().equals("class") && d.action().equals("created")).toList();
        var methods = diff.stream().filter(d -> d.kind().equals("method") && d.action().equals("created")).toList();
        String answer = diff.isEmpty() ? "No se realizaron cambios en el diagrama."
            : created.size() == 1 && diff.size() == 1 ? "La clase " + created.getFirst().label() + " ha sido creada."
            : methods.size() == 1 && diff.size() == 1 ? "El método " + methods.getFirst().label() + " ha sido agregado."
            : "Los cambios solicitados se guardaron en el diagrama. Consulta la actividad para ver el detalle.";
        conversation.recordAppliedEdit(project, diagram, id, assistantInstruction, answer, saved.current().revision());
        return response(c, saved.current());
      }
      return saved;
    }
    compare(c,current,result.conflicts());
    return response(c,current);
  }
  private void compare(Cambio c, DiagramService.Envelope current, List<DiagramMerge.Difference> differences) {
    for(var old:rows.conflicts(c.id)) { old.estado="SUPERADO"; old.fechaResolucion=Instant.now(); }
    rows.flush();
    c.revisionComparada=current.revision();
    var version=rows.version(c.diagramaId,current.revision());
    for(var d:differences) {
      var conflict=new Conflicto(); conflict.id=UUID.randomUUID(); conflict.cambioId=c.id;
      conflict.versionComparadaId=version.id; conflict.ruta=d.path(); conflict.descripcion=d.label();
      conflict.valorLocal=json.writeValueAsString(d.local());
      conflict.valorServidor=json.writeValueAsString(d.server()); conflict.estado="PENDIENTE";
      rows.insert(conflict);
    }
    rows.flush();
  }
  private Response apply(UUID project, Cambio c, DiagramService.Envelope current, DiagramDocument document) {
    document.validate();
    var saved=document.sameContent(current.document()) ? current
        : diagrams.update(project,c.diagramaId,current.revision(),document);
    c.estado="APLICADO"; c.fechaResolucion=Instant.now();
    rows.flush();
    return response(c,saved);
  }
  @Transactional
  public Response resolve(UUID project, UUID diagram, UUID change, long comparedRevision,
      Map<String,DiagramMerge.Choice> choices) {
    var current=diagrams.forWrite(project,diagram);
    var c=own(diagram,change);
    if(!c.estado.equals("PENDIENTE")) return response(c,current);
    var base=decode(c.valorAnterior); var proposal=decode(c.valorPropuesto);
    var comparison=merge.merge(base,proposal,current.document(),Map.of());
    if(comparedRevision!=current.revision() || c.revisionComparada!=current.revision()) {
      compare(c,current,comparison.conflicts());
      return response(c,current);
    }
    var paths=new HashSet<>(comparison.conflicts().stream().map(DiagramMerge.Difference::path).toList());
    if(!paths.equals(choices.keySet())) throw DiagramMerge.invalid();
    var result=merge.merge(base,proposal,current.document(),choices);
    if(!result.conflicts().isEmpty()) throw DiagramMerge.invalid();
    for(var conflict:rows.conflicts(c.id)) {
      var diff=comparison.conflicts().stream().filter(d->d.path().equals(conflict.ruta)).findFirst().orElseThrow();
      conflict.valorResuelto=json.writeValueAsString(merge.select(diff,choices.get(diff.path())));
      conflict.estado="RESUELTO"; conflict.resueltoPor=users.get().id; conflict.fechaResolucion=Instant.now();
    }
    return apply(project,c,current,result.document());
  }
  @Transactional
  public Response discard(UUID project, UUID diagram, UUID change) {
    var current=diagrams.forWrite(project,diagram);
    var c=own(diagram,change);
    if(c.estado.equals("PENDIENTE")) {
      c.estado="DESCARTADO"; c.fechaResolucion=Instant.now();
      for(var conflict:rows.conflicts(c.id)) {
        conflict.estado="DESCARTADO"; conflict.resueltoPor=users.get().id; conflict.fechaResolucion=Instant.now();
      }
    }
    return response(c,current);
  }
}
