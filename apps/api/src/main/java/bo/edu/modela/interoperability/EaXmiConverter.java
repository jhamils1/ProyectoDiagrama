package bo.edu.modela.interoperability;

import bo.edu.modela.diagrams.DiagramDocument;
import bo.edu.modela.diagrams.DiagramDocument.*;
import bo.edu.modela.shared.ApiException;
import java.time.Instant;
import java.util.*;

/** Atomic conversion: a blocked preview never exposes a persistable partial document. */
public final class EaXmiConverter {
  public record Preview(DiagramDocument document, List<EaXmiReader.Issue> issues, List<String> notices) {
    public Preview { issues=List.copyOf(issues); notices=List.copyOf(notices); }
    public boolean ready() { return document!=null && issues.isEmpty(); }
  }
  private EaXmiConverter() {}
  public static Preview preview(byte[] xml, String diagramName) {
    return preview(xml,diagramName,Map.of(),Set.of());
  }
  public static Preview preview(byte[] xml, String diagramName,
      Map<String,String> attributeTypes, Set<String> excludedInvalidAssociations) {
    Objects.requireNonNull(attributeTypes); Objects.requireNonNull(excludedInvalidAssociations);
    var inventory=EaXmiReader.read(xml);
    var issues=new ArrayList<>(inventory.issues());
    var notices=new ArrayList<String>();
    var attributesById=new HashMap<String,EaXmiReader.Attribute>();
    for(var c:inventory.classes()) for(var a:c.attributes()) attributesById.put(a.id(),a);
    var unresolvedTypes=new HashSet<String>(); var invalidAssociations=new HashSet<String>();
    for(var issue:issues) {
      if(issue.code().equals("TYPE_MAPPING_REQUIRED")) unresolvedTypes.add(issue.elementId());
      if(issue.code().equals("ASSOCIATION_ENDS_INVALID")) invalidAssociations.add(issue.elementId());
    }
    var allowedTypes=Set.of("String","Integer","Long","Boolean","Float","Double","Decimal","Date","DateTime","UUID");
    for(var entry:attributeTypes.entrySet()) {
      if(!unresolvedTypes.contains(entry.getKey()) || entry.getValue()==null || !allowedTypes.contains(entry.getValue())) {
        issues.add(new EaXmiReader.Issue("RESOLUTION_INVALID",entry.getKey(),"La equivalencia debe resolver un atributo pendiente con un tipo admitido."));
      } else {
        issues.removeIf(i->i.code().equals("TYPE_MAPPING_REQUIRED") && i.elementId().equals(entry.getKey()));
        var a=attributesById.get(entry.getKey());
        var owner=inventory.classes().stream().filter(c->c.attributes().contains(a)).findFirst().orElseThrow();
        notices.add(owner.name() + "." + a.name() + ": " + a.originalType() + " → " + entry.getValue() + ".");
      }
    }
    for(var id:excludedInvalidAssociations) {
      if(!invalidAssociations.contains(id)) issues.add(new EaXmiReader.Issue("RESOLUTION_INVALID",id,"Solo se puede excluir explícitamente una asociación con extremos inválidos."));
      else {
        issues.removeIf(i->i.code().equals("ASSOCIATION_ENDS_INVALID") && i.elementId().equals(id));
        boolean empty=inventory.issues().stream().anyMatch(i->i.elementId().equals(id) && i.emptyAssociation());
        notices.add(empty ? "Se omitirá una relación vacía que no conecta clases." : "Se omitirá una relación incompleta por tu elección.");
      }
    }
    var ids=new HashMap<String,UUID>();
    if(inventory.classes().isEmpty()) issues.add(new EaXmiReader.Issue("NO_CLASSES","","No hay clases para importar."));
    for(var c:inventory.classes()) {
      register(ids,c.id(),issues);
      for(var a:c.attributes()) {
        register(ids,a.id(),issues);
        if(!Set.of("1","0..1").contains(a.multiplicity()==null?"":a.multiplicity()))
          issues.add(new EaXmiReader.Issue("ATTRIBUTE_MULTIPLICITY_UNSUPPORTED",a.id(),"El editor solo representa atributos 1 o 0..1."));
        if(a.visibility().isEmpty()) issues.add(new EaXmiReader.Issue("VISIBILITY_REQUIRED",a.id(),"Indica la visibilidad del atributo."));
      }
    }
    for(var r:inventory.relations()) register(ids,r.id(),issues);
    // Do not drop malformed associations, unknown types, or unsupported features.
    if(!issues.isEmpty()) return new Preview(null,issues,notices);
    var classes=new ArrayList<ClassData>();
    for(var c:inventory.classes()) {
      var attributes=new ArrayList<AttributeData>();
      for(var a:c.attributes()) attributes.add(new AttributeData(ids.get(a.id()),a.name(),attributeTypes.getOrDefault(a.id(),a.mappedType()),a.visibility(),a.identifier(),"1".equals(a.multiplicity())));
      Position pos;
      if(c.position()!=null) pos=new Position(c.position().x(),c.position().y());
      else {
        int index=classes.size(); pos=new Position(80d+(index%3)*300,80d+(index/3)*220);
        notices.add("La clase " + c.name() + " no tiene posición; se propone una posición en cuadrícula.");
      }
      classes.add(new ClassData(ids.get(c.id()),c.name(),c.abstractClass(),pos,attributes));
    }
    var relations=new ArrayList<RelationData>();
    for(var r:inventory.relations()) {
      boolean inheritance="generalization".equals(r.type());
      // Existing model requires multiplicity strings even for inheritance, where they have no UML meaning.
      relations.add(new RelationData(ids.get(r.id()),r.type(),ids.get(r.sourceId()),ids.get(r.targetId()),r.name(),
          inheritance?"1":r.sourceMultiplicity(),inheritance?"1":r.targetMultiplicity(),
          r.associationClassId()==null || r.associationClassId().isBlank() ? null : ids.get(r.associationClassId())));
    }
    notices.add("Se crean identificadores internos nuevos. Un atributo llamado id no se marca como identificador salvo isID=true explícito en el XML.");
    var document=new DiagramDocument(1,UUID.randomUUID(),diagramName,0L,Instant.now(),classes,relations);
    try { document.validate(); }
    catch(ApiException error) {
      issues.add(new EaXmiReader.Issue("MODEL_INVALID","",error.getMessage()));
      return new Preview(null,issues,notices);
    }
    return new Preview(document,issues,notices);
  }
  private static void register(Map<String,UUID> ids,String id,List<EaXmiReader.Issue> issues) {
    if(id==null || id.isBlank() || ids.putIfAbsent(id,UUID.randomUUID())!=null)
      issues.add(new EaXmiReader.Issue("ID_INVALID",id,"Identificador XMI ausente o repetido."));
  }
}
