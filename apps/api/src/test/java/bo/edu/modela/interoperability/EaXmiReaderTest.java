package bo.edu.modela.interoperability;

import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class EaXmiReaderTest {
  byte[] sample() throws Exception {
    try(var in=getClass().getResourceAsStream("/interoperability/ea-sample.xml")) { return in.readAllBytes(); }
  }
  @Test void readsRealEaSampleWithoutInventingTypesOrLosingInvalidAssociation() throws Exception {
    var result=EaXmiReader.read(sample());
    assertThat(result.classes()).extracting(EaXmiReader.UmlClass::name).containsExactly("Cliente","ClientePremium","Pedido");
    assertThat(result.classes().get(0).attributes()).extracting(EaXmiReader.Attribute::mappedType).containsExactly("Long","String");
    assertThat(result.classes().get(2).attributes()).extracting(EaXmiReader.Attribute::mappedType).containsExactly("Integer",null);
    assertThat(result.classes().get(2).attributes().get(1).originalType()).isEqualTo("Real");
    var association=result.relations().stream().filter(r->r.type().equals("association")).findFirst().orElseThrow();
    assertThat(association.sourceId()).isEqualTo(result.classes().get(0).id());
    assertThat(association.targetId()).isEqualTo(result.classes().get(2).id());
    assertThat(association.sourceMultiplicity()).isEqualTo("1");
    assertThat(association.targetMultiplicity()).isEqualTo("0..*");
    var inheritance=result.relations().stream().filter(r->r.type().equals("generalization")).findFirst().orElseThrow();
    assertThat(inheritance.sourceId()).isEqualTo(result.classes().get(1).id());
    assertThat(inheritance.targetId()).isEqualTo(result.classes().get(0).id());
    assertThat(result.issues()).extracting(EaXmiReader.Issue::code).containsExactlyInAnyOrder("TYPE_MAPPING_REQUIRED","ASSOCIATION_ENDS_INVALID");
    assertThat(result.issues()).anyMatch(i->"Double".equals(i.suggestedType()) && i.message().contains("Pedido.total"));
    assertThat(result.issues()).anyMatch(EaXmiReader.Issue::emptyAssociation);
  }
  @Test void rejectsDtdExternalEntitiesAndMalformedXml() throws Exception {
    var xml=new String(sample(),StandardCharsets.ISO_8859_1);
    var malicious=xml.replace("?>","?><!DOCTYPE xmi:XMI [<!ENTITY secret SYSTEM 'file:///should-not-be-read'>]>");
    assertThatThrownBy(()->EaXmiReader.read(malicious.getBytes(StandardCharsets.ISO_8859_1))).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(()->EaXmiReader.read("<broken>".getBytes())).isInstanceOf(IllegalArgumentException.class);
  }
  @Test void enforcesSizeAndFormat() {
    assertThatThrownBy(()->EaXmiReader.read(new byte[EaXmiReader.MAX_BYTES+1])).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(()->EaXmiReader.read(new byte[0])).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(()->EaXmiReader.read("<xml/>".getBytes())).isInstanceOf(IllegalArgumentException.class);
  }
  @Test void doesNotSuggestDiscardingIncompleteRelationsOrMappingUnknownTypes() throws Exception {
    var xml=new String(sample(),StandardCharsets.ISO_8859_1)
        .replace("PrimitiveTypes.xmi#Real","PrimitiveTypes.xmi#Money")
        .replaceFirst("(?s)<ownedEnd[^>]*>.*?</ownedEnd>","");
    var result=EaXmiReader.read(xml.getBytes(StandardCharsets.ISO_8859_1));
    assertThat(result.issues()).anyMatch(i->i.code().equals("TYPE_MAPPING_REQUIRED") && i.suggestedType()==null);
    assertThat(result.issues()).anyMatch(i->i.code().equals("ASSOCIATION_ENDS_INVALID") && !i.emptyAssociation());
  }
  @Test void honorsDeclaredWindowsEncoding() throws Exception {
    var text=new String(sample(),java.nio.charset.Charset.forName("windows-1252")).replace("name=\"nombre\"","name=\"año\"");
    var result=EaXmiReader.read(text.getBytes(java.nio.charset.Charset.forName("windows-1252")));
    assertThat(result.classes().get(0).attributes().get(1).name()).isEqualTo("año");
  }
  @Test void reportsMissingMultiplicityWithoutAssumingOne() throws Exception {
    var xml=new String(sample(),StandardCharsets.ISO_8859_1).replaceAll("<lowerValue[^>]*/>","");
    var result=EaXmiReader.read(xml.getBytes(StandardCharsets.ISO_8859_1));
    assertThat(result.issues()).extracting(EaXmiReader.Issue::code).contains("MULTIPLICITY_MISSING");
    assertThat(result.relations().stream().filter(r->r.type().equals("association")).findFirst().orElseThrow().sourceMultiplicity()).isNull();
  }
}
