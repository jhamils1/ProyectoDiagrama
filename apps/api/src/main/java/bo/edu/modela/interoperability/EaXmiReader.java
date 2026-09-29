package bo.edu.modela.interoperability;

import java.io.ByteArrayInputStream;
import java.nio.charset.Charset;
import java.util.*;
import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import org.w3c.dom.*;
import org.xml.sax.SAXException;
import org.xml.sax.helpers.DefaultHandler;

/** Read-only inventory of the EA UML 2.5 sample; not a persisted DiagramDocument. */
public final class EaXmiReader {
  private static final String XMI = "http://www.omg.org/spec/XMI/20131001";
  private static final String UML = "http://www.omg.org/spec/UML/20131001";
  private static final String LEGACY_UML = "omg.org/UML1.3";
  public static final int MAX_BYTES = 2 * 1024 * 1024;
  private static final Map<String,String> TYPES = Map.ofEntries(
      Map.entry("string","String"), Map.entry("int","Integer"), Map.entry("integer","Integer"),
      Map.entry("long","Long"), Map.entry("boolean","Boolean"), Map.entry("double","Double"),
      Map.entry("float","Float"), Map.entry("decimal","Decimal"), Map.entry("date","Date"),
      Map.entry("datetime","DateTime"), Map.entry("uuid","UUID"));
  public record Issue(String code, String elementId, String message, String suggestedType, boolean emptyAssociation) {
    public Issue(String code, String elementId, String message) { this(code,elementId,message,null,false); }
  }
  public record Attribute(String id, String name, String originalType, String mappedType, String visibility,
      boolean identifier, String multiplicity) {}
  public record Position(double x, double y) {}
  public record UmlClass(String id, String name, List<Attribute> attributes, boolean abstractClass, Position position) {
    public UmlClass { attributes = List.copyOf(attributes); }
  }
  public record Relation(String id, String type, String name, String sourceId, String targetId,
      String sourceMultiplicity, String targetMultiplicity, String associationClassId) {
    public Relation(String id, String type, String name, String sourceId, String targetId,
        String sourceMultiplicity, String targetMultiplicity) {
      this(id, type, name, sourceId, targetId, sourceMultiplicity, targetMultiplicity, null);
    }
  }
  public record Inventory(List<UmlClass> classes, List<Relation> relations, List<Issue> issues) {
    public Inventory { classes=List.copyOf(classes); relations=List.copyOf(relations); issues=List.copyOf(issues); }
  }
  private EaXmiReader() {}

  public static Inventory read(byte[] bytes) {
    if (bytes == null || bytes.length == 0 || bytes.length > MAX_BYTES)
      throw new IllegalArgumentException("El XML debe tener contenido y no superar 2 MiB.");
    try {
      var factory = DocumentBuilderFactory.newInstance();
      factory.setNamespaceAware(true);
      factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
      factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
      factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
      factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
      factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, "");
      factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "");
      factory.setXIncludeAware(false);
      factory.setExpandEntityReferences(false);
      var builder = factory.newDocumentBuilder();
      builder.setErrorHandler(new DefaultHandler() {
        @Override public void fatalError(org.xml.sax.SAXParseException e) throws SAXException { throw e; }
        @Override public void error(org.xml.sax.SAXParseException e) throws SAXException { throw e; }
      });
      var root = builder.parse(new ByteArrayInputStream(normalizeLegacyNamespace(bytes))).getDocumentElement();
      if ("XMI".equals(root.getTagName()) && "1.1".equals(legacyVersion(root)))
        return readEnterpriseArchitect11(root);
      if (!XMI.equals(root.getNamespaceURI()) || !"XMI".equals(root.getLocalName()))
        throw new IllegalArgumentException("Formato XMI no admitido; usa la exportación UML 2.5 acordada.");
      var all = root.getElementsByTagName("*");
      Map<String,Element> ids = new HashMap<>();
      for (int i=0; i<all.getLength(); i++) {
        var e=(Element)all.item(i); var id=e.getAttributeNS(XMI,"id");
        // EA repeats connector IDs in diagram/extension metadata. Only definitions
        // of packaged elements are used to resolve classes and primitive types.
        if (!"packagedElement".equals(e.getTagName())) continue;
        if (!id.isEmpty() && ids.putIfAbsent(id,e)!=null) throw new IllegalArgumentException("Identificador XMI duplicado: " + id);
      }
      var models = root.getElementsByTagNameNS(UML,"Model");
      if (models.getLength()!=1) throw new IllegalArgumentException("Se requiere un modelo UML único.");
      var elements = ((Element)models.item(0)).getElementsByTagName("packagedElement");
      var classes = new ArrayList<UmlClass>(); var relations = new ArrayList<Relation>(); var issues = new ArrayList<Issue>();
      Map<String,Position> positions = new HashMap<>();
      for(int i=0;i<all.getLength();i++) {
        var shape=(Element)all.item(i);
        if(!shape.getAttributeNS(XMI,"type").endsWith(":UMLClassifierShape")) continue;
        var bounds=first(shape,"bounds");
        if(bounds!=null) {
          try {
            var position=new Position(Double.parseDouble(bounds.getAttribute("x")),Double.parseDouble(bounds.getAttribute("y")));
            if(positions.putIfAbsent(shape.getAttribute("modelElement"),position)!=null)
              issues.add(new Issue("MULTIPLE_CLASS_POSITIONS",shape.getAttribute("modelElement"),"La clase aparece en varios diagramas; selecciona uno antes de importar."));
          } catch(NumberFormatException ex) { issues.add(new Issue("POSITION_INVALID",shape.getAttribute("modelElement"),"Coordenadas inválidas.")); }
        }
      }
      Set<String> classIds = new HashSet<>();
      for (int i=0; i<elements.getLength(); i++) {
        var e=(Element)elements.item(i);
        if (!kind(e,"Class")) {
          if(!kind(e,"Package") && !kind(e,"PrimitiveType") && !kind(e,"Association"))
            issues.add(new Issue("ELEMENT_UNSUPPORTED",e.getAttributeNS(XMI,"id"),"Elemento UML no soportado: " + e.getAttributeNS(XMI,"type")));
          continue;
        }
        var cid = e.getAttributeNS(XMI,"id"); classIds.add(cid);
        if(!children(e,"ownedOperation").isEmpty()) issues.add(new Issue("METHODS_UNSUPPORTED",cid,"El editor todavía no admite métodos."));
        var attributes = new ArrayList<Attribute>();
        for (var a : children(e,"ownedAttribute")) {
          var type=first(a,"type"); String raw="";
          if (type!=null && type.hasAttribute("href")) {
            var href=type.getAttribute("href");
            // Recognize the standard primitive reference without fetching it.
            if (href.startsWith(UML+"/PrimitiveTypes.xmi#")) raw=href.substring(href.indexOf('#')+1);
            else raw=href;
          } else {
            var ref=type==null ? a.getAttribute("type") : type.getAttributeNS(XMI,"idref");
            var resolved=ids.get(ref);
            raw=resolved!=null && kind(resolved,"PrimitiveType") ? resolved.getAttribute("name") : ref;
          }
          var aid=a.getAttributeNS(XMI,"id"); var mapped=TYPES.get(raw.toLowerCase(Locale.ROOT));
          if (!raw.isEmpty() && mapped==null) issues.add(new Issue("TYPE_MAPPING_REQUIRED",aid,
              e.getAttribute("name") + "." + a.getAttribute("name") + " usa el tipo " + raw + ".",
              raw.equals("Real") ? "Double" : null,false));
          if(a.hasAttribute("association") || "true".equals(a.getAttribute("isDerived")) || "true".equals(a.getAttribute("isStatic")) || first(a,"defaultValue")!=null)
            issues.add(new Issue("ATTRIBUTE_FEATURE_UNSUPPORTED",aid,"El atributo tiene características que este importador no admite."));
          attributes.add(new Attribute(aid,a.getAttribute("name"),raw,raw.isEmpty()?"":mapped,a.getAttribute("visibility"),"true".equals(a.getAttribute("isID")),multiplicity(a,issues)));
        }
        classes.add(new UmlClass(cid,e.getAttribute("name"),attributes,"true".equals(e.getAttribute("isAbstract")),positions.get(cid)));
        for (var g:children(e,"generalization")) relations.add(new Relation(g.getAttributeNS(XMI,"id"),"generalization","",cid,g.getAttribute("general"),null,null));
      }
      for (int i=0; i<elements.getLength(); i++) {
        var e=(Element)elements.item(i); if(!kind(e,"Association")) continue;
        var id=e.getAttributeNS(XMI,"id"); var ends=children(e,"ownedEnd");
        if(ends.size()!=2) { issues.add(new Issue("ASSOCIATION_ENDS_INVALID",id,
            ends.isEmpty() ? "Se encontró una relación vacía que no conecta clases." : "La relación está incompleta: falta uno de sus extremos.",null,ends.isEmpty())); continue; }
        if(ends.stream().anyMatch(a->a.hasAttribute("aggregation") && !"none".equals(a.getAttribute("aggregation"))))
          issues.add(new Issue("AGGREGATION_UNSUPPORTED",id,"Composición y agregación no admitidas en esta importación."));
        var source=ends.stream().filter(a->a.getAttributeNS(XMI,"id").startsWith("EAID_src")).findFirst().orElse(ends.get(0));
        var target=ends.get(0)==source ? ends.get(1) : ends.get(0);
        relations.add(new Relation(id,"association",e.getAttribute("name"),reference(source),reference(target),multiplicity(source,issues),multiplicity(target,issues)));
      }
      for(var r:relations) if(!classIds.contains(r.sourceId()) || !classIds.contains(r.targetId()))
        issues.add(new Issue("CLASS_REFERENCE_MISSING",r.id(),"La relación referencia una clase que no está en el modelo."));
      return new Inventory(classes,relations,issues);
    } catch (IllegalArgumentException e) { throw e; }
    catch (Exception e) { throw new IllegalArgumentException("XML inválido o no admitido; no se permiten DTD ni entidades externas.",e); }
  }

  /** EA 2.5 emits xmi.version without declaring the xmi prefix. Declare it locally before parsing. */
  private static byte[] normalizeLegacyNamespace(byte[] bytes) {
    var charset = Charset.forName("windows-1252");
    var xml = new String(bytes, charset);
    if (!xml.contains("xmi.version=\"1.1\"") || xml.contains("xmlns:xmi=")) return bytes;
    return xml.replaceFirst("<XMI\\b", "<XMI xmlns:xmi=\"http://www.omg.org/XMI\"").getBytes(charset);
  }

  /** Reads the XMI 1.1 dialect produced by legacy Enterprise Architect exports. */
  private static Inventory readEnterpriseArchitect11(Element root) {
    var classes = new ArrayList<UmlClass>();
    var relations = new ArrayList<Relation>();
    var issues = new ArrayList<Issue>();
    var classIds = new HashSet<String>();

    var classNodes = root.getElementsByTagNameNS(LEGACY_UML, "Class");
    for (int i = 0; i < classNodes.getLength(); i++) {
      var element = (Element) classNodes.item(i);
      if ("true".equals(element.getAttribute("isRoot"))) continue;
      var id = legacyId(element);
      var attributes = new ArrayList<Attribute>();
      var attributeNodes = element.getElementsByTagNameNS(LEGACY_UML, "Attribute");
      for (int j = 0; j < attributeNodes.getLength(); j++) {
        var attribute = (Element) attributeNodes.item(j);
        var raw = legacyTaggedValue(attribute, "type");
        var mapped = TYPES.get(raw.toLowerCase(Locale.ROOT));
        var attributeId = legacyId(attribute);
        if (!raw.isEmpty() && mapped == null)
          issues.add(new Issue("TYPE_MAPPING_REQUIRED", attributeId,
              element.getAttribute("name") + "." + attribute.getAttribute("name") + " usa el tipo " + raw + ".",
              raw.equals("Real") ? "Double" : null, false));
        // EA normally omits a multiplicity for scalar attributes. In that case it means one,
        // unlike an association end where an omitted multiplicity is ambiguous.
        var attributeMultiplicity = attribute.getAttribute("multiplicity");
        attributes.add(new Attribute(attributeId, attribute.getAttribute("name"), raw,
            raw.isEmpty() ? "" : mapped, attribute.getAttribute("visibility"), false,
            attributeMultiplicity.isBlank() ? "1" : legacyMultiplicity(attribute, issues)));
      }
      classes.add(new UmlClass(id, element.getAttribute("name"), attributes,
          "true".equals(element.getAttribute("isAbstract")), null));
      classIds.add(id);
    }

    var associationNodes = root.getElementsByTagNameNS(LEGACY_UML, "Association");
    for (int i = 0; i < associationNodes.getLength(); i++) {
      var association = (Element) associationNodes.item(i);
      var ends = new ArrayList<Element>();
      var endNodes = association.getElementsByTagNameNS(LEGACY_UML, "AssociationEnd");
      for (int j = 0; j < endNodes.getLength(); j++) ends.add((Element) endNodes.item(j));
      var id = legacyId(association);
      if (ends.size() != 2) {
        issues.add(new Issue("ASSOCIATION_ENDS_INVALID", id,
            ends.isEmpty() ? "Se encontrÃ³ una relaciÃ³n vacÃ­a que no conecta clases."
                : "La relaciÃ³n estÃ¡ incompleta: falta uno de sus extremos.", null, ends.isEmpty()));
        continue;
      }
      var source = ends.get(0);
      var target = ends.get(1);
      relations.add(new Relation(id, "association", association.getAttribute("name"),
          source.getAttribute("type"), target.getAttribute("type"),
          legacyMultiplicity(source, issues), legacyMultiplicity(target, issues),
          legacyTaggedValue(association, "associationclass")));
    }
    for (var relation : relations) {
      if (!classIds.contains(relation.sourceId()) || !classIds.contains(relation.targetId()))
        issues.add(new Issue("CLASS_REFERENCE_MISSING", relation.id(),
            "La relaciÃ³n referencia una clase que no estÃ¡ en el modelo."));
      if (!relation.associationClassId().isBlank() && !classIds.contains(relation.associationClassId()))
        issues.add(new Issue("ASSOCIATION_CLASS_MISSING", relation.id(),
            "La clase de asociaciÃ³n referenciada no estÃ¡ en el modelo."));
    }
    return new Inventory(classes, relations, issues);
  }

  private static String legacyId(Element element) {
    var namespaced = element.getAttributeNS("http://www.omg.org/XMI", "id");
    return namespaced.isBlank() ? element.getAttribute("xmi.id") : namespaced;
  }

  private static String legacyVersion(Element root) {
    var namespaced = root.getAttributeNS("http://www.omg.org/XMI", "version");
    return namespaced.isBlank() ? root.getAttribute("xmi.version") : namespaced;
  }

  private static String legacyTaggedValue(Element element, String tag) {
    var values = element.getElementsByTagNameNS(LEGACY_UML, "TaggedValue");
    for (int i = 0; i < values.getLength(); i++) {
      var value = (Element) values.item(i);
      if (tag.equals(value.getAttribute("tag"))) return value.getAttribute("value");
    }
    return "";
  }

  private static String legacyMultiplicity(Element element, List<Issue> issues) {
    var value = element.getAttribute("multiplicity");
    if (value.isBlank()) {
      var lower = legacyTaggedValue(element, "lowerBound");
      var upper = legacyTaggedValue(element, "upperBound");
      if (!lower.isBlank() && !upper.isBlank()) value = lower.equals(upper) ? lower : lower + ".." + upper;
    }
    value = value.trim();
    if ("*".equals(value)) return "0..*";
    if ("0..".equals(value)) return "0..*";
    if ("1..".equals(value)) return "1..*";
    if (value.isBlank()) {
      issues.add(new Issue("MULTIPLICITY_MISSING", legacyId(element),
          "Falta multiplicidad explÃ­cita; no se asignarÃ¡ por defecto."));
      return null;
    }
    return value;
  }

  private static boolean kind(Element e,String type) {
    var value=e.getAttributeNS(XMI,"type"); int colon=value.indexOf(':');
    return colon>0 && type.equals(value.substring(colon+1)) && UML.equals(e.lookupNamespaceURI(value.substring(0,colon)));
  }
  private static List<Element> children(Element e,String name) {
    var result=new ArrayList<Element>();
    for(Node n=e.getFirstChild();n!=null;n=n.getNextSibling()) if(n instanceof Element a && name.equals(a.getTagName())) result.add(a);
    return result;
  }
  private static Element first(Element e,String name) { return children(e,name).stream().findFirst().orElse(null); }
  private static String reference(Element e) { var t=first(e,"type"); return t==null?e.getAttribute("type"):t.getAttributeNS(XMI,"idref"); }
  private static String multiplicity(Element e,List<Issue> issues) {
    var low=first(e,"lowerValue"); var high=first(e,"upperValue");
    if(low==null || high==null || !low.hasAttribute("value") || !high.hasAttribute("value")) {
      issues.add(new Issue("MULTIPLICITY_MISSING",e.getAttributeNS(XMI,"id"),"Falta multiplicidad explícita; no se asignará por defecto.")); return null;
    }
    var l=low.getAttribute("value"); var h=high.getAttribute("value");
    return l.equals(h)?l:l+".."+h;
  }
}
