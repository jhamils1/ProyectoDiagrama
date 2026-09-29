package bo.edu.modela.interoperability;

import bo.edu.modela.diagrams.DiagramDocument;
import java.io.ByteArrayOutputStream;
import java.util.*;
import javax.xml.stream.*;

/** Semantic UML 2.5 export and EA-native XMI 1.1 export with diagram layout. */
public final class EaXmiWriter {
  private static final String XMI = "http://www.omg.org/spec/XMI/20131001";
  private static final String UML = "http://www.omg.org/spec/UML/20131001";
  private EaXmiWriter() {}

  public static byte[] write(DiagramDocument model) {
    Objects.requireNonNull(model, "model").validate();
    try {
      var output = new ByteArrayOutputStream();
      var xml = XMLOutputFactory.newFactory().createXMLStreamWriter(output, "UTF-8");
      xml.writeStartDocument("UTF-8", "1.0");
      xml.writeStartElement("xmi", "XMI", XMI);
      xml.writeNamespace("xmi", XMI); xml.writeNamespace("uml", UML);
      xml.writeAttribute("xmi", XMI, "version", "2.5.1");
      xml.writeStartElement("uml", "Model", UML);
      xid(xml, id(model.id())); attr(xml, "name", model.name());
      var types = new TreeSet<String>();
      model.classes().forEach(c -> c.attributes().forEach(a -> {
        if (!a.dataType().isEmpty()) types.add(a.dataType());
      }));
      for (var type : types) {
        element(xml, "packagedElement", "PrimitiveType", "type_" + type);
        attr(xml, "name", type); xml.writeEndElement();
      }
      for (var c : model.classes()) {
        element(xml, "packagedElement", "Class", id(c.id()));
        attr(xml, "name", c.name()); attr(xml, "isAbstract", c.abstractClass().toString());
        for (var a : c.attributes()) {
          element(xml, "ownedAttribute", "Property", id(a.id()));
          attr(xml, "name", a.name()); attr(xml, "visibility", a.visibility());
          attr(xml, "isID", a.identifier().toString());
          if (!a.dataType().isEmpty()) attr(xml, "type", "type_" + a.dataType());
          bounds(xml, id(a.id()), a.required() ? "1" : "0..1");
          xml.writeEndElement();
        }
        for (var r : model.relations()) if (r.type().equals("generalization") && r.sourceId().equals(c.id())) {
          element(xml, "generalization", "Generalization", id(r.id()));
          attr(xml, "general", id(r.targetId())); xml.writeEndElement();
        }
        xml.writeEndElement();
      }
      for (var r : model.relations()) if (r.type().equals("association")) {
        element(xml, "packagedElement", "Association", id(r.id()));
        attr(xml, "name", r.name());
        String source = "src_" + id(r.id()), target = "dst_" + id(r.id());
        attr(xml, "memberEnd", source + " " + target);
        end(xml, source, id(r.id()), id(r.sourceId()), r.sourceMultiplicity());
        end(xml, target, id(r.id()), id(r.targetId()), r.targetMultiplicity());
        xml.writeEndElement();
      }
      xml.writeEndElement(); xml.writeEndElement(); xml.writeEndDocument(); xml.close();
      return output.toByteArray();
    } catch (XMLStreamException error) {
      throw new IllegalStateException("No se pudo generar el XML UML.", error);
    }
  }

  /** XMI 1.1 dialect consumed by the Enterprise Architect version used in the course. */
  public static byte[] writeEnterpriseArchitect11(DiagramDocument model) {
    Objects.requireNonNull(model, "model").validate();
    try {
      var output = new ByteArrayOutputStream();
      var xml = XMLOutputFactory.newFactory().createXMLStreamWriter(output, "windows-1252");
      xml.writeStartDocument("windows-1252", "1.0");
      xml.writeStartElement("XMI");
      xml.writeNamespace("UML", "omg.org/UML1.3");
      // Enterprise Architect's legacy importer expects these dotted attributes,
      // exactly as its own XMI 1.1 exporter emits them.
      xml.writeAttribute("xmi.version", "1.1");
      // Select EA's native XMI 1.1 importer. Without this header EA falls back to
      // generic UML and loses its association-class and endpoint-style metadata.
      xml.writeStartElement("XMI.header");
      xml.writeStartElement("XMI.documentation");
      xml.writeStartElement("XMI.exporter"); xml.writeCharacters("Enterprise Architect"); xml.writeEndElement();
      xml.writeStartElement("XMI.exporterVersion"); xml.writeCharacters("2.5"); xml.writeEndElement();
      xml.writeEndElement(); xml.writeEndElement();
      xml.writeStartElement("XMI.content");
      legacyElement(xml, "Model"); legacyId(xml, "MX_" + legacyElementId(model.id())); attr(xml, "name", "EA Model");
      legacyElement(xml, "Namespace.ownedElement");
      legacyElement(xml, "Package"); legacyId(xml, legacyPackageId(model.id())); attr(xml, "name", model.name());
      attr(xml, "isRoot", "false"); attr(xml, "isLeaf", "false"); attr(xml, "isAbstract", "false"); attr(xml, "visibility", "public");
      legacyElement(xml, "ModelElement.taggedValue");
      legacyTag(xml, "version", "1.0"); legacyTag(xml, "ea_stype", "Public");
      legacyTag(xml, "iscontrolled", "FALSE"); legacyTag(xml, "isprotected", "FALSE");
      xml.writeEndElement();
      legacyElement(xml, "Namespace.ownedElement");
      var types = new TreeSet<String>();
      model.classes().forEach(c -> c.attributes().forEach(a -> { if (!a.dataType().isEmpty()) types.add(a.dataType()); }));
      var associationClassRelations = new HashMap<UUID, DiagramDocument.RelationData>();
      model.relations().forEach(r -> { if (r.associationClassId() != null) associationClassRelations.put(r.associationClassId(), r); });
      var localIds = new HashMap<UUID, Integer>();
      for (int index = 0; index < model.classes().size(); index++) localIds.put(model.classes().get(index).id(), index + 1);
      for (var type : types) {
        legacyElement(xml, "DataType"); legacyId(xml, "type_" + type); attr(xml, "name", legacyType(type)); xml.writeEndElement();
      }
      for (var c : model.classes()) {
        legacyElement(xml, "Class"); legacyId(xml, legacyElementId(c.id())); attr(xml, "name", c.name());
        attr(xml, "visibility", "public"); attr(xml, "isRoot", "false"); attr(xml, "isLeaf", "false");
        attr(xml, "isAbstract", c.abstractClass().toString()); attr(xml, "isActive", "false"); attr(xml, "namespace", legacyPackageId(model.id()));
        legacyElement(xml, "ModelElement.taggedValue");
        legacyTag(xml, "isSpecification", "false"); legacyTag(xml, "ea_stype", "Class");
        legacyTag(xml, "ea_ntype", associationClassRelations.containsKey(c.id()) ? "17" : "0");
        legacyTag(xml, "version", "1.0"); legacyTag(xml, "package", legacyPackageId(model.id()));
        legacyTag(xml, "ea_localid", String.valueOf(localIds.get(c.id()))); legacyTag(xml, "ea_eleType", "element");
        if (associationClassRelations.containsKey(c.id()))
          legacyTag(xml, "conID", legacyElementId(associationClassRelations.get(c.id()).id()));
        xml.writeEndElement();
        legacyElement(xml, "Classifier.feature");
        int attributePosition = 0;
        for (var a : c.attributes()) {
          legacyElement(xml, "Attribute"); legacyId(xml, legacyElementId(a.id())); attr(xml, "name", a.name()); attr(xml, "visibility", a.visibility());
          attr(xml, "changeable", "none"); attr(xml, "ownerScope", "instance"); attr(xml, "targetScope", "instance");
          attr(xml, "isID", a.identifier().toString()); attr(xml, "multiplicity", a.required() ? "1" : "0..1");
          legacyElement(xml, "StructuralFeature.type"); legacyElement(xml, "Classifier");
          xml.writeAttribute("xmi.idref", "type_" + a.dataType()); xml.writeEndElement(); xml.writeEndElement();
          legacyElement(xml, "ModelElement.taggedValue");
          legacyTag(xml, "type", legacyType(a.dataType()));
          legacyTag(xml, "ea_guid", "{" + a.id().toString().toUpperCase(Locale.ROOT) + "}");
          legacyTag(xml, "position", String.valueOf(attributePosition++));
          legacyTag(xml, "lowerBound", a.required() ? "1" : "0"); legacyTag(xml, "upperBound", "1");
          legacyTag(xml, "containment", "Not Specified"); legacyTag(xml, "ordered", "0");
          legacyTag(xml, "static", "0"); legacyTag(xml, "collection", "false");
          xml.writeEndElement();
          xml.writeEndElement();
        }
        xml.writeEndElement(); xml.writeEndElement();
      }
      int relationLocalId = model.classes().size() + 1;
      for (var r : model.relations()) if (r.type().equals("association")) {
        legacyElement(xml, "Association"); legacyId(xml, legacyElementId(r.id())); attr(xml, "name", r.name()); attr(xml, "visibility", "public");
        attr(xml, "isRoot", "false"); attr(xml, "isLeaf", "false"); attr(xml, "isAbstract", "false");
        legacyElement(xml, "ModelElement.taggedValue");
        legacyTag(xml, "style", "3"); legacyTag(xml, "ea_type", "Association"); legacyTag(xml, "direction", "Unspecified");
        legacyTag(xml, "linemode", "3"); legacyTag(xml, "linecolor", "-1"); legacyTag(xml, "linewidth", "0");
        legacyTag(xml, "seqno", "0"); legacyTag(xml, "headStyle", "0"); legacyTag(xml, "lineStyle", "0");
        legacyTag(xml, "ea_localid", String.valueOf(relationLocalId++));
        legacyTag(xml, "ea_sourceName", model.classes().stream().filter(c -> c.id().equals(r.sourceId())).findFirst().orElseThrow().name());
        legacyTag(xml, "ea_targetName", model.classes().stream().filter(c -> c.id().equals(r.targetId())).findFirst().orElseThrow().name());
        legacyTag(xml, "ea_sourceType", "Class"); legacyTag(xml, "ea_targetType", "Class");
        legacyTag(xml, "ea_sourceID", String.valueOf(localIds.get(r.sourceId()))); legacyTag(xml, "ea_targetID", String.valueOf(localIds.get(r.targetId())));
        legacyTag(xml, "virtualInheritance", "0");
        if (r.associationClassId() != null) {
          legacyTag(xml, "subtype", "Class"); legacyTag(xml, "privatedata1", String.valueOf(localIds.get(r.associationClassId())));
          legacyTag(xml, "associationclass", legacyElementId(r.associationClassId()));
        }
        legacyTag(xml, "lb", legacyMultiplicity(r.sourceMultiplicity())); legacyTag(xml, "rb", legacyMultiplicity(r.targetMultiplicity()));
        xml.writeEndElement();
        legacyElement(xml, "Association.connection"); legacyEnd(xml, r.sourceId(), r.sourceMultiplicity(), "source"); legacyEnd(xml, r.targetId(), r.targetMultiplicity(), "target");
        xml.writeEndElement(); xml.writeEndElement();
      }
      xml.writeEndElement(); // UML:Namespace.ownedElement
      xml.writeEndElement(); // UML:Package
      xml.writeEndElement(); // UML:Namespace.ownedElement
      xml.writeEndElement(); // UML:Model
      legacyDiagram(xml, model); // EA diagrams are siblings of the model, owned by its package.
      xml.writeEndElement(); // XMI.content
      xml.writeEndElement(); // XMI
      xml.writeEndDocument(); xml.close();
      return output.toByteArray();
    } catch (XMLStreamException error) {
      throw new IllegalStateException("No se pudo generar el XML de Enterprise Architect.", error);
    }
  }

  private static String id(UUID id) { return "m_" + id.toString().replace('-', '_'); }
  private static String legacyElementId(UUID id) { return "EAID_" + id.toString().toUpperCase(Locale.ROOT).replace('-', '_'); }
  private static String legacyPackageId(UUID id) { return "EAPK_" + id.toString().toUpperCase(Locale.ROOT).replace('-', '_'); }
  private static void legacyElement(XMLStreamWriter xml, String name) throws XMLStreamException {
    xml.writeStartElement("UML", name, "omg.org/UML1.3");
  }
  private static void legacyId(XMLStreamWriter xml, String value) throws XMLStreamException {
    xml.writeAttribute("xmi.id", value);
  }
  private static void legacyTag(XMLStreamWriter xml, String tag, String value) throws XMLStreamException {
    legacyElement(xml, "TaggedValue"); attr(xml, "tag", tag); attr(xml, "value", value); xml.writeEndElement();
  }
  private static void legacyEnd(XMLStreamWriter xml, UUID type, String multiplicity, String end) throws XMLStreamException {
    legacyElement(xml, "AssociationEnd"); attr(xml, "type", legacyElementId(type)); attr(xml, "multiplicity", legacyMultiplicity(multiplicity));
    attr(xml, "visibility", "public"); attr(xml, "aggregation", "none"); attr(xml, "isOrdered", "false");
    attr(xml, "targetScope", "instance"); attr(xml, "changeable", "none"); attr(xml, "isNavigable", "true");
    legacyElement(xml, "ModelElement.taggedValue"); legacyTag(xml, "containment", "Unspecified");
    legacyTag(xml, "source".equals(end) ? "sourcestyle" : "deststyle", "Union=0;Derived=0;AllowDuplicates=0;Owned=0;Navigable=Unspecified;");
    legacyTag(xml, "ea_end", end); xml.writeEndElement();
    xml.writeEndElement();
  }
  private static void legacyDiagram(XMLStreamWriter xml, DiagramDocument model) throws XMLStreamException {
    var diagramId = "EAID_" + model.id().toString().toUpperCase(Locale.ROOT).replace('-', '_');
    var displayIds = new HashMap<UUID, String>();
    for (var c : model.classes()) displayIds.put(c.id(), legacyElementId(c.id()).substring(5, 13));
    legacyElement(xml, "Diagram"); legacyId(xml, diagramId); attr(xml, "name", model.name());
    attr(xml, "diagramType", "ClassDiagram"); attr(xml, "owner", legacyPackageId(model.id())); attr(xml, "toolName", "Enterprise Architect 2.5");
    legacyElement(xml, "ModelElement.taggedValue"); legacyTag(xml, "version", "1.0"); legacyTag(xml, "islocked", "false");
    legacyTag(xml, "package", legacyPackageId(model.id())); legacyTag(xml, "type", "Logical");
    legacyTag(xml, "EAStyle", "ShowPrivate=1;ShowProtected=1;ShowPublic=1;HideRelationships=0;HideAtts=0;HideOps=0;HideProps=0;ShowIcons=1;HideStereo=0;HideElemStereo=0;ConnectorNotation=UML 2.1;ExplicitNavigability=0;");
    legacyTag(xml, "styleex", "AttPkg=1;TConnectorNotation=UML 2.1;TExplicitNavigability=0;SuppressedCompartments=;");
    xml.writeEndElement();
    legacyElement(xml, "Diagram.element");
    int sequence = 1;
    for (var c : model.classes()) {
      int left = (int) Math.round(c.position().x()); int top = (int) Math.round(c.position().y());
      int height = Math.max(90, 54 + c.attributes().size() * 22);
      legacyElement(xml, "DiagramElement");
      attr(xml, "geometry", "Left=" + left + ";Top=" + top + ";Right=" + (left + 210) + ";Bottom=" + (top + height) + ";");
      attr(xml, "subject", legacyElementId(c.id())); attr(xml, "seqno", String.valueOf(sequence++)); attr(xml, "style", "DUID=" + displayIds.get(c.id()) + ";"); xml.writeEndElement();
    }
    for (var r : model.relations()) if (r.type().equals("association")) {
      legacyElement(xml, "DiagramElement");
      attr(xml, "geometry", "SX=0;SY=0;EX=0;EY=0;EDGE=2;Path=;"); attr(xml, "subject", legacyElementId(r.id()));
      attr(xml, "style", "Mode=3;EOID=" + displayIds.get(r.targetId()) + ";SOID=" + displayIds.get(r.sourceId()) + ";Color=-1;LWidth=0;Hidden=0;");
      xml.writeEndElement();
    }
    xml.writeEndElement(); xml.writeEndElement();
  }
  private static String legacyMultiplicity(String value) {
    // EA accepts 1..* verbatim. Its legacy shorthand is only needed for 0..*.
    return "0..*".equals(value) ? "*" : value;
  }
  private static String legacyType(String value) {
    return switch (value) { case "Integer" -> "int"; case "Long" -> "long"; case "Boolean" -> "boolean"; case "Double" -> "double"; case "Float" -> "float"; default -> value; };
  }
  private static void xid(XMLStreamWriter xml, String id) throws XMLStreamException {
    xml.writeAttribute("xmi", XMI, "id", id);
  }
  private static void element(XMLStreamWriter xml, String name, String type, String id) throws XMLStreamException {
    xml.writeStartElement(name); xid(xml, id); xml.writeAttribute("xmi", XMI, "type", "uml:" + type);
  }
  private static void attr(XMLStreamWriter xml, String name, String value) throws XMLStreamException {
    if (value.codePoints().anyMatch(c -> !(c == 9 || c == 10 || c == 13 || (c >= 32 && c <= 0xD7FF)
        || (c >= 0xE000 && c <= 0xFFFD) || (c >= 0x10000 && c <= 0x10FFFF)))) {
      throw new IllegalArgumentException("El modelo contiene caracteres no permitidos en XML.");
    }
    xml.writeAttribute(name, value);
  }
  private static void end(XMLStreamWriter xml, String id, String association, String type, String multiplicity) throws XMLStreamException {
    element(xml, "ownedEnd", "Property", id);
    attr(xml, "type", type); attr(xml, "association", association);
    bounds(xml, id, multiplicity); xml.writeEndElement();
  }
  private static void bounds(XMLStreamWriter xml, String id, String multiplicity) throws XMLStreamException {
    String[] range = multiplicity.equals("*") ? new String[]{"0", "*"} : multiplicity.split("\\.\\.");
    element(xml, "lowerValue", "LiteralInteger", id + "_lower");
    attr(xml, "value", range[0]); xml.writeEndElement();
    element(xml, "upperValue", "LiteralUnlimitedNatural", id + "_upper");
    attr(xml, "value", range.length == 1 ? range[0] : range[1]); xml.writeEndElement();
  }
}
