package bo.edu.modela.ai;

import bo.edu.modela.diagrams.DiagramDocument;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.Locale;
import java.util.regex.Pattern;
import java.text.Normalizer;

/** Builds bounded, explicit UML facts for the model; it never changes the diagram. */
final class DiagramFacts {
  private static final Pattern COUNT_QUESTION = Pattern.compile(
      "^\\s*¿?cu[aá]nt[oa]s?\\s+([\\p{L}][\\p{L}\\p{N}_]*)\\s+(?:puede\\s+tener|tiene|pueden\\s+estar\\s+asociad[oa]s?\\s+(?:a|con))\\s+(?:un|una|el|la)\\s+([\\p{L}][\\p{L}\\p{N}_]*)\\s*(?:seg[uú]n (?:este|el) diagrama)?\\s*\\??\\s*(?:responde brevemente[.!]?)?\\s*$",
      Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
  private static final Pattern REVERSED_COUNT_QUESTION = Pattern.compile(
      "^\\s*¿?(?:un|una|el|la)\\s+([\\p{L}][\\p{L}\\p{N}_]*)\\s+puede\\s+tener\\s+cu[aá]nt[oa]s?\\s+([\\p{L}][\\p{L}\\p{N}_]*)\\s*\\??\\s*$",
      Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
  private static final Pattern MULTIPLICITY_QUESTION = Pattern.compile(
      "^\\s*¿?(?:cu[aá]l es la multiplicidad|qu[eé] multiplicidad hay)\\s+(?:de|entre)\\s+([\\p{L}][\\p{L}\\p{N}_]*)\\s+(?:y|con)\\s+([\\p{L}][\\p{L}\\p{N}_]*)\\s*(?:seg[uú]n (?:este|el) diagrama)?\\s*\\??\\s*$",
      Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
  private static final Pattern NAMED_ASSOCIATION_QUESTION = Pattern.compile(
      "^\\s*¿?(?:(?:cu[aá]l es la multiplicidad de|expl[ií]came|explica)\\s+)?la relaci[oó]n\\s+([\\p{L}\\p{N}_][\\p{L}\\p{N}_ .-]{0,79}?)\\s*\\??\\s*$",
      Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
  private static final Pattern ADDITIONAL_ACTION = Pattern.compile(
      "\\b(?:agrega|añade|elimina|modifica|crea|cambia)\\b", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
  private static final Pattern CLASSES_QUESTION = Pattern.compile(
      "^\\s*¿?(?:qu[eé] clases (?:hay|existen|tiene|contiene)(?: en (?:este|el) diagrama| (?:este|el) diagrama)?|cu[aá]les son las clases (?:del|de este|de el|en este|en el) diagrama)\\s*\\??\\s*$",
      Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
  private static final Pattern REVIEW_QUESTION = Pattern.compile(
      "^\\s*¿?(?:revisa|revisar|analiza|analizar)\\s+(?:el|este|mi)\\s+diagrama(?: de clases)?(?:\\s+y\\s+dime\\s+(?:una|alguna)\\s+(?:mejora|sugerencia)(?: posible)?)?\\s*\\??[.!]?\\s*$",
      Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
  private static final Pattern ATTRIBUTES_QUESTION = Pattern.compile(
      "^\\s*¿?(?:qu[eé]|cu[aá]les son los) atributos (?:tiene|posee|de) (?:la clase |el |la )?([\\p{L}][\\p{L}\\p{N}_]*)\\s*\\??\\s*$",
      Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
  private static final Pattern RELATION_QUESTION = Pattern.compile(
      "^\\s*¿?(?:qu[eé] relaci[oó]n (?:hay|existe)|c[oó]mo (?:se relacionan|est[aá]n relacionad[oa]s?))\\s+(?:entre |las clases )?([\\p{L}][\\p{L}\\p{N}_]*)\\s+(?:y|con)\\s+([\\p{L}][\\p{L}\\p{N}_]*)\\s*\\??\\s*$",
      Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
  private static final Pattern ATTRIBUTE_TYPE_QUESTION = Pattern.compile(
      "^\\s*¿?(?:cu[aá]l es el tipo|qu[eé] tipo (?:tiene|es)) (?:del atributo |de )([\\p{L}][\\p{L}\\p{N}_]*) (?:de|en) (?:la clase |el |la )?([\\p{L}][\\p{L}\\p{N}_]*)\\s*\\??\\s*$",
      Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
  private DiagramFacts() {}

  static String format(DiagramDocument doc, long revision) {
    Map<UUID, String> names = new HashMap<>();
    StringBuilder facts = new StringBuilder("Diagrama: ").append(doc.name())
        .append(". Revisión: ").append(revision).append('\n');
    if (doc.classes().isEmpty()) facts.append("No hay clases.\n");
    for (var c : doc.classes()) {
      names.put(c.id(), c.name());
      facts.append("Clase ").append(c.name()).append(Boolean.TRUE.equals(c.abstractClass()) ? " abstracta" : "").append(": ");
      if (c.attributes().isEmpty()) facts.append("sin atributos");
      for (var a : c.attributes()) facts.append(a.name()).append(':').append(a.dataType().isEmpty() ? "tipo no definido" : a.dataType())
          .append(Boolean.TRUE.equals(a.identifier()) ? " ID" : "").append("; ");
      facts.append('\n');
    }
    if (doc.relations().isEmpty()) facts.append("No hay relaciones.\n");
    for (var r : doc.relations()) {
      String source = names.get(r.sourceId()), target = names.get(r.targetId());
      if (r.type().equals("generalization")) {
        facts.append("Herencia: ").append(source).append(" es subclase de ").append(target).append(".\n");
      } else if (r.sourceId().equals(r.targetId())) {
        facts.append("Asociación reflexiva en ").append(source)
            .append(": multiplicidad del extremo origen ").append(r.sourceMultiplicity())
            .append("; extremo destino ").append(r.targetMultiplicity())
            .append(". Los nombres de los roles no están definidos.\n");
      } else {
        facts.append("Asociación ").append(source).append(" - ").append(target);
        if (!r.name().isBlank()) facts.append(" (").append(r.name()).append(')');
        facts.append(": por cada ").append(source).append(", cantidad de ").append(target).append(": ")
            .append(range(r.targetMultiplicity())).append("; por cada ").append(target).append(", cantidad de ")
            .append(source).append(": ").append(range(r.sourceMultiplicity())).append(".\n");
      }
      if (r.associationClassId() != null)
        facts.append("Clase de asociación: ").append(names.get(r.associationClassId())).append(".\n");
    }
    return facts.toString();
  }

  private static String range(String multiplicity) {
    if (multiplicity.equals("*")) return "* (mínimo 0, sin máximo)";
    String[] parts = multiplicity.split("\\.\\.");
    if (parts.length == 1) return multiplicity + " (exactamente " + multiplicity + ")";
    return multiplicity + " (mínimo " + parts[0] + ", máximo "
        + (parts[1].equals("*") ? "sin límite" : parts[1]) + ")";
  }

  /** Only handles a narrow question form; ambiguous cases are answered without guessing. */
  static String answerCount(DiagramDocument doc, String question) {
    var match = COUNT_QUESTION.matcher(question);
    String wantedName, perName;
    if (match.matches()) { wantedName = match.group(1); perName = match.group(2); }
    else {
      var reverse = REVERSED_COUNT_QUESTION.matcher(question);
      if (!reverse.matches()) return null;
      perName = reverse.group(1); wantedName = reverse.group(2);
    }
    var wanted = resolveClass(doc, wantedName);
    var per = resolveClass(doc, perName);
    if (wanted == null || per == null)
      return "No puedo identificar ambas clases de forma inequívoca en el diagrama. Indica sus nombres exactos.";
    if (wanted.id().equals(per.id())) {
      boolean selfAssociation = doc.relations().stream().anyMatch(r -> r.type().equals("association")
          && r.sourceId().equals(per.id()) && r.targetId().equals(per.id()));
      return selfAssociation
          ? "No puedo distinguir los extremos de una asociación reflexiva sin roles identificados."
          : "No hay una asociación reflexiva de " + per.name() + " en el diagrama.";
    }
    var relations = doc.relations().stream().filter(r -> r.type().equals("association")
        && ((r.sourceId().equals(per.id()) && r.targetId().equals(wanted.id()))
            || (r.targetId().equals(per.id()) && r.sourceId().equals(wanted.id())))).toList();
    if (relations.isEmpty()) return "No hay una asociación directa entre " + per.name() + " y " + wanted.name() + " en el diagrama.";
    if (relations.size() > 1) return "Hay varias asociaciones entre esas clases. Indica cuál deseas consultar.";
    var relation = relations.getFirst();
    String multiplicity = relation.sourceId().equals(wanted.id()) ? relation.sourceMultiplicity() : relation.targetMultiplicity();
    return "Según el diagrama, por cada " + per.name() + ", la cantidad permitida de " + wanted.name()
        + " es " + range(multiplicity) + ". La multiplicidad no indica cuántos registros existen realmente.";
  }

  /** Use validated diagram data for narrow questions; defer everything else to the model. */
  static String answerQuestion(DiagramDocument doc, String question) {
    String count = answerCount(doc, question);
    if (count != null) return count;
    if (REVIEW_QUESTION.matcher(question).matches()) return basicReview(doc);
    if (CLASSES_QUESTION.matcher(question).matches()) {
      if (doc.classes().isEmpty()) return "El diagrama no contiene clases.";
      return "Clases del diagrama: " + String.join(", ", doc.classes().stream().map(DiagramDocument.ClassData::name).toList()) + ".";
    }
    var attributes = ATTRIBUTES_QUESTION.matcher(question);
    if (attributes.matches()) {
      var type = resolveClass(doc, attributes.group(1));
      if (type == null) return "No puedo identificar esa clase de forma inequívoca en el diagrama. Indica su nombre exacto.";
      if (type.attributes().isEmpty()) return "La clase " + type.name() + " no tiene atributos propios registrados.";
      var names = type.attributes().stream().map(a -> a.name() + ": "
          + (a.dataType().isEmpty() ? "tipo no definido" : a.dataType())).toList();
      return "Atributos propios de " + type.name() + ": " + String.join(", ", names) + ".";
    }
    var attributeType = ATTRIBUTE_TYPE_QUESTION.matcher(question);
    if (attributeType.matches()) {
      var type = resolveClass(doc, attributeType.group(2));
      if (type == null) return "No puedo identificar esa clase de forma inequívoca en el diagrama. Indica su nombre exacto.";
      var found = type.attributes().stream().filter(a -> a.name().equalsIgnoreCase(attributeType.group(1))).toList();
      if (found.isEmpty()) return "No encuentro ese atributo entre los atributos propios de " + type.name() + ".";
      var attribute = found.getFirst();
      return attribute.dataType().isEmpty() ? "El atributo " + attribute.name() + " de " + type.name() + " no tiene tipo definido."
          : "El tipo del atributo " + attribute.name() + " de " + type.name() + " es " + attribute.dataType() + ".";
    }
    var multiplicity = MULTIPLICITY_QUESTION.matcher(question);
    if (multiplicity.matches()) return describeAssociation(doc, multiplicity.group(1), multiplicity.group(2));
    var named = NAMED_ASSOCIATION_QUESTION.matcher(question);
    if (named.matches()) {
      String name = named.group(1).strip();
      // Do not silently discard a second requested action as part of a relation name.
      if (ADDITIONAL_ACTION.matcher(name).find()) return null;
      return describeNamedAssociation(doc, name);
    }
    var relation = RELATION_QUESTION.matcher(question);
    if (relation.matches()) return describeRelation(doc, relation.group(1), relation.group(2));
    return null;
  }

  /** Reports only observable, bounded checks; these are suggestions, not UML errors. */
  private static String basicReview(DiagramDocument doc) {
    if (doc.classes().isEmpty()) return "El diagrama no contiene clases para revisar. Agrega clases antes de evaluar su estructura.";
    var findings = new java.util.ArrayList<String>();
    for (var type : doc.classes()) {
      if (type.attributes().isEmpty()) findings.add("La clase " + type.name() + " no tiene atributos propios; comprueba si necesita alguno.");
      for (var attribute : type.attributes())
        if (attribute.dataType().isBlank()) findings.add("El atributo " + type.name() + "." + attribute.name() + " no tiene tipo definido.");
      boolean connected = doc.relations().stream().anyMatch(relation -> relation.sourceId().equals(type.id())
          || relation.targetId().equals(type.id()) || type.id().equals(relation.associationClassId()));
      if (!connected && doc.classes().size() > 1)
        findings.add("La clase " + type.name() + " no tiene relaciones registradas; revisa si debe conectarse con otras.");
    }
    if (findings.isEmpty()) return "Revisión básica: no encontré clases sin atributos propios, atributos sin tipo ni clases aisladas. "
        + "Estas comprobaciones no garantizan que el diseño o sus reglas de negocio sean correctos.";
    int limit = Math.min(12, findings.size());
    String result = "Revisión básica del diagrama (son sugerencias, no errores obligatorios):\n- "
        + String.join("\n- ", findings.subList(0, limit));
    if (findings.size() > limit) result += "\nHay " + (findings.size() - limit) + " observaciones más; revisa el diagrama.";
    return result + "\nEsta revisión no comprueba todas las reglas de negocio ni modifica el diagrama.";
  }

  private static String describeNamedAssociation(DiagramDocument doc, String name) {
    var relations = doc.relations().stream().filter(r -> !r.name().isBlank() && normalize(r.name()).equals(normalize(name))).toList();
    if (relations.isEmpty()) return "No encuentro una relación con ese nombre en el diagrama.";
    if (relations.size() > 1) return "Hay varias relaciones con ese nombre. Revisa sus clases y tipos en el diagrama para distinguirlas.";
    var relation = relations.getFirst();
    var source = doc.classes().stream().filter(c -> c.id().equals(relation.sourceId())).findFirst().orElseThrow();
    var target = doc.classes().stream().filter(c -> c.id().equals(relation.targetId())).findFirst().orElseThrow();
    if (relation.type().equals("generalization"))
      return "La relación " + relation.name() + " es una herencia: " + source.name() + " es subclase de " + target.name() + ". La multiplicidad no se aplica a la herencia.";
    if (source.id().equals(target.id()))
      return "La asociación " + relation.name() + " es reflexiva en " + source.name()
          + ": extremo origen " + range(relation.sourceMultiplicity()) + "; extremo destino "
          + range(relation.targetMultiplicity()) + ". Los roles no están identificados.";
    String result = "Asociación " + relation.name() + ": por cada " + source.name() + ", cantidad de " + target.name()
        + ": " + range(relation.targetMultiplicity()) + "; por cada " + target.name() + ", cantidad de "
        + source.name() + ": " + range(relation.sourceMultiplicity()) + ".";
    if (relation.associationClassId() != null) {
      var associationClass = doc.classes().stream().filter(c -> c.id().equals(relation.associationClassId())).findFirst();
      if (associationClass.isPresent()) result += " La clase de asociación es " + associationClass.get().name() + ".";
    }
    return result;
  }

  private static String describeRelation(DiagramDocument doc, String first, String second) {
    var left = resolveClass(doc, first);
    var right = resolveClass(doc, second);
    if (left == null || right == null) return "No puedo identificar ambas clases de forma inequívoca en el diagrama. Indica sus nombres exactos.";
    var relations = doc.relations().stream().filter(r ->
        (r.sourceId().equals(left.id()) && r.targetId().equals(right.id()))
            || (r.targetId().equals(left.id()) && r.sourceId().equals(right.id()))).toList();
    if (relations.isEmpty()) return "No hay una relación directa entre " + left.name() + " y " + right.name() + " en el diagrama.";
    if (relations.size() > 1) return "Hay varias relaciones entre esas clases. Indica cuál deseas consultar.";
    var relation = relations.getFirst();
    if (relation.type().equals("generalization")) {
      var child = relation.sourceId().equals(left.id()) ? left.name() : right.name();
      var parent = relation.targetId().equals(left.id()) ? left.name() : right.name();
      return "Según el diagrama, " + child + " es subclase de " + parent + ".";
    }
    String result = describeAssociation(doc, first, second);
    if (relation.associationClassId() == null) return result;
    String associationClass = doc.classes().stream().filter(c -> c.id().equals(relation.associationClassId()))
        .map(DiagramDocument.ClassData::name).findFirst().orElse(null);
    return associationClass == null ? result : result + " La clase de asociación es " + associationClass + ".";
  }

  private static String describeAssociation(DiagramDocument doc, String first, String second) {
    var left = resolveClass(doc, first);
    var right = resolveClass(doc, second);
    if (left == null || right == null) return "No puedo identificar ambas clases de forma inequívoca en el diagrama. Indica sus nombres exactos.";
    if (left.id().equals(right.id())) return "Para una asociación reflexiva indica el extremo; los roles no están identificados.";
    var relations = doc.relations().stream().filter(r -> r.type().equals("association")
        && ((r.sourceId().equals(left.id()) && r.targetId().equals(right.id()))
            || (r.targetId().equals(left.id()) && r.sourceId().equals(right.id())))).toList();
    if (relations.isEmpty()) return "No hay una asociación directa entre " + left.name() + " y " + right.name() + " en el diagrama.";
    if (relations.size() > 1) return "Hay varias asociaciones entre esas clases. Indica cuál deseas consultar.";
    var relation = relations.getFirst();
    String leftCount = relation.sourceId().equals(left.id()) ? relation.sourceMultiplicity() : relation.targetMultiplicity();
    String rightCount = relation.sourceId().equals(right.id()) ? relation.sourceMultiplicity() : relation.targetMultiplicity();
    return "Según el diagrama, por cada " + left.name() + ", cantidad de " + right.name() + ": " + range(rightCount)
        + "; por cada " + right.name() + ", cantidad de " + left.name() + ": " + range(leftCount) + ".";
  }

  private static DiagramDocument.ClassData resolveClass(DiagramDocument doc, String word) {
    String query = normalize(word);
    var matches = doc.classes().stream().filter(c -> {
      String name = normalize(c.name());
      return query.equals(name) || query.equals(name + "s") || query.equals(name + "es");
    }).toList();
    return matches.size() == 1 ? matches.getFirst() : null;
  }

  private static String normalize(String text) {
    return Normalizer.normalize(text, Normalizer.Form.NFD).replaceAll("\\p{M}+", "").toLowerCase(Locale.ROOT);
  }
}
