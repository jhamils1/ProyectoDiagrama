package bo.edu.modela.diagrams.activity;

import bo.edu.modela.diagrams.DiagramDocument;
import java.util.*;

/** Describes committed changes by stable UUID, ignoring transport revision/timestamps. */
public final class DiagramActivityDiff {
  private DiagramActivityDiff() {}

  public record Change(String kind, UUID elementId, String label, String action,
      String property, String before, String after) {}
  private record Element(String kind, String label, Map<String, String> fields) {}

  public static List<Change> between(DiagramDocument before, DiagramDocument after) {
    if (before == null) return List.of(new Change("diagram", after.id(), after.name(),
        "created", "", null, null));
    var old = elements(before);
    var next = elements(after);
    var ids = new LinkedHashSet<>(old.keySet());
    ids.addAll(next.keySet());
    var changes = new ArrayList<Change>();
    for (var id : ids) {
      var a = old.get(id);
      var b = next.get(id);
      if (a == null || b == null) {
        var element = a == null ? b : a;
        changes.add(new Change(element.kind(), id, element.label(),
            a == null ? "created" : "deleted", "", null, null));
      } else {
        for (var field : b.fields().entrySet()) {
          var previous = a.fields().get(field.getKey());
          if (!Objects.equals(previous, field.getValue()))
            changes.add(new Change(b.kind(), id, b.label(), "updated", field.getKey(),
                previous, field.getValue()));
        }
      }
    }
    return List.copyOf(changes);
  }

  private static Map<UUID, Element> elements(DiagramDocument doc) {
    var result = new LinkedHashMap<UUID, Element>();
    result.put(doc.id(), new Element("diagram", doc.name(), fields("name", doc.name())));
    var names = new HashMap<UUID, String>();
    for (var c : doc.classes()) {
      names.put(c.id(), c.name());
      result.put(c.id(), new Element("class", c.name(), fields("name", c.name(),
          "abstract", c.abstractClass(), "position", c.position().x() + ", " + c.position().y())));
      for (var a : c.attributes())
        result.put(a.id(), new Element("attribute", c.name() + "." + a.name(),
            fields("name", a.name(), "class", c.id(), "dataType", a.dataType(),
                "visibility", a.visibility(), "identifier", a.identifier(), "required", a.required())));
    }
    for (var r : doc.relations())
      result.put(r.id(), new Element("relation",
          names.get(r.sourceId()) + " — " + names.get(r.targetId()),
          fields("name", r.name(), "type", r.type(), "source", r.sourceId(), "target", r.targetId(),
              "sourceMultiplicity", r.sourceMultiplicity(), "targetMultiplicity", r.targetMultiplicity(),
              "associationClass", r.associationClassId())));
    return result;
  }

  private static Map<String, String> fields(Object... pairs) {
    var fields = new LinkedHashMap<String, String>();
    for (int i = 0; i < pairs.length; i += 2)
      fields.put((String) pairs[i], pairs[i + 1] == null ? "" : pairs[i + 1].toString());
    return fields;
  }
}
