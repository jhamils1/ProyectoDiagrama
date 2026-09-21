package bo.edu.modela.interoperability;

import bo.edu.modela.diagrams.DiagramDocument;
import java.io.ByteArrayOutputStream;
import java.util.*;
import javax.xml.stream.*;

/** Semantic UML 2.5 XMI export. EA visual layout is intentionally not encoded here. */
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

  private static String id(UUID id) { return "m_" + id.toString().replace('-', '_'); }
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
