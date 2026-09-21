package bo.edu.modela.interoperability;

import java.nio.charset.Charset;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class EaXmiConverterTest {
  private static final Charset ENCODING=Charset.forName("windows-1252");
  String sample() throws Exception {
    try(var in=getClass().getResourceAsStream("/interoperability/ea-sample.xml")) { return new String(in.readAllBytes(),ENCODING); }
  }
  // Test-only corrected variant. The original fixture and the user's export remain unchanged.
  String supported() throws Exception {
    return sample().replace("PrimitiveTypes.xmi#Real","PrimitiveTypes.xmi#Double")
        .replaceAll("<packagedElement xmi:type=\"uml:Association\" xmi:id=\"[^\"]+\"/>","");
  }
  EaXmiConverter.Preview preview(String xml) { return EaXmiConverter.preview(xml.getBytes(ENCODING),"Importado"); }
  @Test void blocksRealSampleWithoutPartialDocument() throws Exception {
    var result=preview(sample());
    assertThat(result.ready()).isFalse(); assertThat(result.document()).isNull();
    assertThat(result.issues()).extracting(EaXmiReader.Issue::code).contains("TYPE_MAPPING_REQUIRED","ASSOCIATION_ENDS_INVALID");
  }
  @Test void resolvesOnlyExplicitChoicesAndRecordsThem() throws Exception {
    var bytes=sample().getBytes(ENCODING);
    var inventory=EaXmiReader.read(bytes);
    var attribute=inventory.issues().stream().filter(i->i.code().equals("TYPE_MAPPING_REQUIRED")).findFirst().orElseThrow().elementId();
    var association=inventory.issues().stream().filter(i->i.code().equals("ASSOCIATION_ENDS_INVALID")).findFirst().orElseThrow().elementId();
    assertThat(EaXmiConverter.preview(bytes,"Importado",java.util.Map.of(attribute,"Double"),java.util.Set.of()).ready()).isFalse();
    var resolved=EaXmiConverter.preview(bytes,"Importado",java.util.Map.of(attribute,"Double"),java.util.Set.of(association));
    assertThat(resolved.ready()).isTrue(); resolved.document().validate();
    assertThat(resolved.document().classes().get(2).attributes().get(1).dataType()).isEqualTo("Double");
    assertThat(resolved.notices()).anyMatch(n->n.contains("Real → Double"));
    assertThat(resolved.notices()).anyMatch(n->n.contains("relación vacía"));
    assertThat(preview(sample()).ready()).isFalse();
  }
  @Test void rejectsForgedResolutionsAndUnsupportedTypes() throws Exception {
    var bytes=sample().getBytes(ENCODING);
    var pending=EaXmiReader.read(bytes).issues().get(0).elementId();
    var result=EaXmiConverter.preview(bytes,"Importado",java.util.Map.of(pending,"Inventado","unknown","String"),java.util.Set.of("valid-relation"));
    assertThat(result.document()).isNull();
    assertThat(result.issues()).filteredOn(i->i.code().equals("RESOLUTION_INVALID")).hasSize(3);
  }
  @Test void convertsSupportedVariantWithPositionsRequiredFlagsAndReferences() throws Exception {
    var result=preview(supported());
    assertThat(result.issues()).isEmpty(); assertThat(result.ready()).isTrue();
    result.document().validate();
    var classes=result.document().classes();
    assertThat(classes).hasSize(3);
    assertThat(classes.get(0).position().x()).isEqualTo(40d);
    assertThat(classes.get(0).attributes().get(0).required()).isTrue();
    assertThat(classes.get(0).attributes().get(0).identifier()).isFalse();
    assertThat(classes.get(0).attributes().get(1).visibility()).isEqualTo("private");
    assertThat(classes.get(2).attributes().get(1).dataType()).isEqualTo("Double");
    var inheritance=result.document().relations().stream().filter(r->r.type().equals("generalization")).findFirst().orElseThrow();
    assertThat(inheritance.sourceId()).isEqualTo(classes.get(1).id());
    assertThat(inheritance.targetId()).isEqualTo(classes.get(0).id());
    var association=result.document().relations().stream().filter(r->r.type().equals("association")).findFirst().orElseThrow();
    assertThat(association.sourceId()).isEqualTo(classes.get(0).id());
    assertThat(association.targetMultiplicity()).isEqualTo("0..*");
    assertThat(preview(supported()).document().classes().get(0).id()).isNotEqualTo(classes.get(0).id());
  }
  @Test void preservesAbstractAndExplicitIdentifier() throws Exception {
    var xml=supported().replace("name=\"Cliente\">","name=\"Cliente\" isAbstract=\"true\">")
        .replace("name=\"id\" visibility=\"private\"","name=\"id\" visibility=\"private\" isID=\"true\"");
    var result=preview(xml);
    assertThat(result.ready()).isTrue();
    assertThat(result.document().classes().get(0).abstractClass()).isTrue();
    assertThat(result.document().classes().get(0).attributes().get(0).identifier()).isTrue();
  }
  @Test void rejectsNamesNotSupportedByExistingEditor() throws Exception {
    var result=preview(supported().replace("name=\"Cliente\"","name=\"Class A\""));
    assertThat(result.document()).isNull();
    assertThat(result.issues()).extracting(EaXmiReader.Issue::code).contains("MODEL_INVALID");
  }
  @Test void blocksMethodsAndCollectionsRatherThanLosingThem() throws Exception {
    var xml=supported().replace("name=\"ClientePremium\">","name=\"ClientePremium\"><ownedOperation name=\"calcular\"/>")
        .replace("value=\"1\"/>","value=\"2\"/>");
    var result=preview(xml);
    assertThat(result.document()).isNull();
    assertThat(result.issues()).extracting(EaXmiReader.Issue::code).contains("METHODS_UNSUPPORTED","ATTRIBUTE_MULTIPLICITY_UNSUPPORTED");
  }
  @Test void reportsLayoutFallbackWithoutChangingInput() throws Exception {
    var xml=supported().replaceAll("<bounds[^>]*/>","");
    var result=preview(xml);
    assertThat(result.ready()).isTrue();
    assertThat(result.notices()).anyMatch(n->n.contains("cuadrícula"));
    assertThat(result.document().classes().get(0).position().x()).isEqualTo(80d);
  }
}
