package bo.edu.modela.generation;

import bo.edu.modela.diagrams.DiagramDocument;
import bo.edu.modela.diagrams.DiagramDocument.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.Instant;
import java.util.*;
import java.util.zip.ZipInputStream;
import javax.tools.ToolProvider;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import static org.assertj.core.api.Assertions.*;

class BackendGeneratorTest {
  @TempDir Path temp;
  private ClassData clazz(String name, String field) {
    return new ClassData(UUID.randomUUID(), name, false, new Position(0d,0d), List.of(
        new AttributeData(UUID.randomUUID(), "codigo", "Long", "private", true, true),
        new AttributeData(UUID.randomUUID(), field, "String", "private", false, false)));
  }
  private DiagramDocument model(ClassData a, ClassData b, boolean reverse) {
    return new DiagramDocument(1, UUID.randomUUID(), "Demo", 0L, Instant.EPOCH, List.of(a,b), List.of(
        new RelationData(UUID.randomUUID(), "association", reverse ? b.id() : a.id(), reverse ? a.id() : b.id(),
            "tiene", reverse ? "0..*" : "1", reverse ? "1" : "0..*")));
  }
  private Map<String,String> unpack(byte[] bytes) throws Exception {
    Map<String,String> result = new TreeMap<>();
    try (var zip = new ZipInputStream(new ByteArrayInputStream(bytes), StandardCharsets.UTF_8)) {
      for (var e = zip.getNextEntry(); e != null; e = zip.getNextEntry()) {
        assertThat(e.getName()).doesNotContain("..", "\\").doesNotStartWith("/");
        assertThat(result.put(e.getName(), new String(zip.readAllBytes(), StandardCharsets.UTF_8))).isNull();
      }
    }
    return result;
  }
  private void compile(Map<String,String> files) throws Exception {
    var sources = new ArrayList<File>();
    for (var entry : files.entrySet()) {
      var path = temp.resolve(entry.getKey());
      Files.createDirectories(path.getParent());
      Files.writeString(path, entry.getValue());
      if (entry.getKey().endsWith(".java")) sources.add(path.toFile());
    }
    var compiler = ToolProvider.getSystemJavaCompiler();
    var diagnostics = new StringWriter();
    try (var manager = compiler.getStandardFileManager(null, null, StandardCharsets.UTF_8)) {
      var ok = compiler.getTask(diagnostics, manager, null,
          List.of("--release", "21", "-parameters", "-classpath", System.getProperty("java.class.path"), "-d", temp.toString()),
          null, manager.getJavaFileObjectsFromFiles(sources)).call();
      assertThat(ok).withFailMessage(diagnostics.toString()).isTrue();
    }
  }
  @Test void zipContainsCompilableClientePedidoAndNoModelMutation() throws Exception {
    var model = model(clazz("Cliente", "nombre"), clazz("Pedido", "detalle"), false);
    var before = model.toString();
    var files = unpack(BackendGenerator.zip(model));
    assertThat(files).containsKeys("pom.xml", "README.md", "src/main/resources/application.properties");
    assertThat(files).hasSize(17);
    compile(files);
    assertThat(model.toString()).isEqualTo(before);
    // Optional reproducible fixture for a separate real Maven build; never contains application credentials.
    var output = System.getProperty("generation.fixture");
    if (output != null) for (var entry : files.entrySet()) {
      var path = Path.of(output).resolve(entry.getKey());
      Files.createDirectories(path.getParent());
      Files.writeString(path, entry.getValue());
    }
  }
  @Test void reversedRelationAndJavaTypeNamesCompile() throws Exception {
    compile(unpack(BackendGenerator.zip(model(clazz("String", "value"), clazz("Long", "text"), true))));
  }
  @Test void umlMethodsDoNotChangeGeneratedBackend() throws Exception {
    var client = clazz("Cliente", "nombre");
    var order = clazz("Pedido", "detalle");
    var original = model(client, order, false);
    var withMethod = new ClassData(client.id(), client.name(), client.abstractClass(), client.position(),
        client.attributes(), List.of(new MethodData(UUID.randomUUID(), "encender", "void", "public")));
    var changed = new DiagramDocument(original.schemaVersion(), original.id(), original.name(), original.localRevision(),
        original.updatedAt(), List.of(withMethod, order), original.relations());
    changed.validate();
    assertThat(BackendGenerator.files(changed)).isEqualTo(BackendGenerator.files(original));
    compile(unpack(BackendGenerator.zip(changed)));
  }
  @Test void oneToOneGeneratesUniqueOwningReferenceAndOptionalInverse() throws Exception {
    var persona = clazz("Persona", "nombre");
    var perfil = clazz("Perfil", "biografia");
    var relation = new RelationData(UUID.randomUUID(), "association", persona.id(), perfil.id(), "", "1", "0..1");
    var files = BackendGenerator.files(new DiagramDocument(1, UUID.randomUUID(), "Uno a uno", 0L,
        Instant.EPOCH, List.of(persona, perfil), List.of(relation)));
    String root = "src/main/java/com/example/generated/";
    String field = "r" + relation.id().toString().replace("-", "");
    assertThat(files.get(root + "entity/Perfil.java")).contains("@jakarta.persistence.OneToOne", "unique=true", "public com.example.generated.entity.Persona " + field);
    assertThat(files.get(root + "entity/Persona.java")).contains("@jakarta.persistence.OneToOne(mappedBy=\"" + field + "\")", "public com.example.generated.entity.Perfil " + field + "Item");
    assertThat(files.get(root + "dto/PerfilRequest.java")).contains("@jakarta.validation.constraints.NotNull java.lang.Long " + field + "Id");
    assertThat(files.get(root + "dto/PersonaResponse.java")).contains("java.lang.Long " + field + "ItemId");
    compile(files);
  }
  @Test void associationClassGeneratesTwoOwningReferencesFromDetalle() throws Exception {
    var venta = clazz("Venta", "nombre");
    var producto = clazz("Producto", "nombre");
    var detalle = clazz("Detalle", "cantidad");
    var relation = new RelationData(UUID.randomUUID(), "association", venta.id(), producto.id(),
        "", "*", "1..*", detalle.id());
    var files = BackendGenerator.files(new DiagramDocument(1, UUID.randomUUID(), "Venta Producto", 0L,
        Instant.EPOCH, List.of(venta, producto, detalle), List.of(relation)));
    String root = "src/main/java/com/example/generated/";
    String field = "r" + relation.id().toString().replace("-", "");
    assertThat(files.get(root + "entity/Detalle.java")).contains(
        "@jakarta.persistence.ManyToOne", "public com.example.generated.entity.Venta " + field + "Source",
        "public com.example.generated.entity.Producto " + field + "Target");
    assertThat(files.get(root + "entity/Venta.java")).contains(
        "@jakarta.persistence.OneToMany(mappedBy=\"" + field + "Source\")");
    assertThat(files.get(root + "entity/Producto.java")).contains(
        "@jakarta.persistence.OneToMany(mappedBy=\"" + field + "Target\")");
    assertThat(files.get(root + "dto/DetalleRequest.java")).contains(
        "java.lang.Long " + field + "SourceId", "java.lang.Long " + field + "TargetId");
    compile(files);
  }

  @Test void rejectsJavaKeywordsAndReservedRecordNames() {
    var model = model(clazz("class", "nombre"), clazz("Pedido", "getClass"), false);
    assertThatThrownBy(() -> BackendGenerator.zip(model)).isInstanceOfSatisfying(BackendGenerator.InvalidModel.class,
        e -> assertThat(e.issues()).extracting(GenerationValidator.Issue::code).containsExactly("JAVA_NAME_INVALID", "JAVA_NAME_INVALID"));
  }
  @Test void refusesIncompleteModelsInsteadOfProducingPartialZip() {
    var a = clazz("Cliente", "nombre");
    var noId = new ClassData(a.id(), a.name(), false, a.position(), List.of());
    assertThatThrownBy(() -> BackendGenerator.zip(model(noId, clazz("Pedido", "detalle"), false)))
        .isInstanceOfSatisfying(BackendGenerator.InvalidModel.class,
            e -> assertThat(e.issues()).extracting(GenerationValidator.Issue::code).contains("IDENTIFIER_REQUIRED"));
  }
  @Test void rejectsMandatoryCyclesThatWouldPreventCreatingRecords() {
    var a = clazz("Persona", "nombre");
    var model = new DiagramDocument(1, UUID.randomUUID(), "Demo", 0L, Instant.EPOCH, List.of(a), List.of(
        new RelationData(UUID.randomUUID(), "association", a.id(), a.id(), "tiene", "1", "0..*")));
    assertThatThrownBy(() -> BackendGenerator.zip(model)).isInstanceOfSatisfying(BackendGenerator.InvalidModel.class,
        e -> assertThat(e.issues()).extracting(GenerationValidator.Issue::code).contains("REQUIRED_RELATION_CYCLE"));
  }

  @Test void joinedEntitiesCompileWithInheritedIdAttributesAndAssociations() throws Exception {
    var base = clazz("Cliente", "nombre");
    var child = new ClassData(UUID.randomUUID(), "Premium", false, new Position(0d, 0d), List.of(
        new AttributeData(UUID.randomUUID(), "puntos", "Integer", "private", false, true)));
    var leaf = new ClassData(UUID.randomUUID(), "Especial", false, new Position(0d, 0d), List.of());
    var order = clazz("Pedido", "detalle");
    var doc = new DiagramDocument(1, UUID.randomUUID(), "Herencia", 0L, Instant.EPOCH,
        List.of(leaf, order, child, base), List.of(
            new RelationData(UUID.randomUUID(), "generalization", child.id(), base.id(), "", "1", "1"),
            new RelationData(UUID.randomUUID(), "generalization", leaf.id(), child.id(), "", "1", "1"),
            new RelationData(UUID.randomUUID(), "association", base.id(), order.id(), "", "1", "0..*")));
    var before = doc.toString();
    var plan = InheritancePlan.analyze(doc);
    assertThat(plan.valid()).isTrue();
    var files = new TreeMap<String, String>();
    String root = "com/example/generated/entity/";
    files.put(root + "Cliente.java", BackendGenerator.entitySource(base,
        List.of(new BackendGenerator.Link("clienteItems", order, false, false)), plan.classes().get(base.id()), true));
    files.put(root + "Premium.java", BackendGenerator.entitySource(child, List.of(), plan.classes().get(child.id()), false));
    files.put(root + "Especial.java", BackendGenerator.entitySource(leaf, List.of(), plan.classes().get(leaf.id()), false));
    files.put(root + "Pedido.java", BackendGenerator.entitySource(order,
        List.of(new BackendGenerator.Link("cliente", base, true, false)), plan.classes().get(order.id()), false));
    assertThat(files.get(root + "Cliente.java")).contains("InheritanceType.JOINED", "@jakarta.persistence.Id");
    assertThat(files.get(root + "Premium.java")).contains("extends com.example.generated.entity.Cliente", "PrimaryKeyJoinColumn")
        .doesNotContain("@jakarta.persistence.Id", " codigo;", " nombre;", "clienteItems");
    assertThat(files.get(root + "Especial.java")).contains("extends com.example.generated.entity.Premium")
        .doesNotContain("@jakarta.persistence.Id", " puntos;");
    assertThat(files.get(root + "Pedido.java")).doesNotContain("Inheritance(", "PrimaryKeyJoinColumn");
    files.put("Probe.java", """
        class Probe {
          void inheritedState(com.example.generated.entity.Especial value) {
            value.codigo = 1L;
            value.nombre = "Ana";
            value.puntos = 10;
            value.clienteItems.add(new com.example.generated.entity.Pedido());
          }
        }
        """);
    compile(files);
    assertThat(doc.toString()).isEqualTo(before);
    compile(unpack(BackendGenerator.zip(doc)));
  }

  private RelationData inherits(ClassData child, ClassData parent) {
    return new RelationData(UUID.randomUUID(), "generalization", child.id(), parent.id(), "", "1", "1");
  }

  private DiagramDocument hierarchy(ClassData base, ClassData child, RelationData... extra) {
    var relations = new ArrayList<RelationData>(List.of(inherits(child, base)));
    relations.addAll(List.of(extra));
    return new DiagramDocument(1, UUID.randomUUID(), "Herencia", 0L, Instant.EPOCH,
        List.of(child, base), relations);
  }

  @Test void completeInheritedCrudCompilesWithBothKindsOfInheritedRelations() throws Exception {
    var base = clazz("Cliente", "nombre");
    var child = new ClassData(UUID.randomUUID(), "ClientePremium", false, new Position(0d, 0d), List.of(
        new AttributeData(UUID.randomUUID(), "puntos", "Integer", "private", false, true)));
    var order = clazz("Pedido", "detalle");
    var region = clazz("Region", "nombre");
    var sibling = new ClassData(UUID.randomUUID(), "ClienteVip", false, new Position(0d, 0d), List.of());
    var leaf = new ClassData(UUID.randomUUID(), "ClienteEspecial", false, new Position(0d, 0d), List.of());
    var pedidos = new RelationData(UUID.randomUUID(), "association", base.id(), order.id(), "", "1", "0..*");
    var regiones = new RelationData(UUID.randomUUID(), "association", region.id(), base.id(), "", "1", "0..*");
    var doc = new DiagramDocument(1, UUID.randomUUID(), "Herencia", 0L, Instant.EPOCH,
        List.of(leaf, sibling, child, order, base, region),
        List.of(inherits(child, base), inherits(sibling, base), inherits(leaf, child), pedidos, regiones));
    var before = doc.toString();
    var files = BackendGenerator.files(doc);
    String root = "src/main/java/com/example/generated/";
    String orders = "r" + pedidos.id().toString().replace("-", "") + "Items";
    String regions = "r" + regiones.id().toString().replace("-", "");
    assertThat(files.get(root + "dto/ClientePremiumRequest.java"))
        .contains("java.lang.Long codigo", "java.lang.String nombre", "java.lang.Integer puntos", regions + "Id")
        .doesNotContain(orders);
    assertThat(files.get(root + "dto/ClientePremiumResponse.java")).contains(orders + "Ids", regions + "Id");
    assertThat(files.get(root + "entity/ClientePremium.java"))
        .contains("extends com.example.generated.entity.Cliente").doesNotContain(orders, regions, "@jakarta.persistence.Id");
    assertThat(files.get(root + "service/ClientePremiumService.java"))
        .contains("em.find(com.example.generated.entity.Cliente.class, input.codigo()) != null",
            "value.nombre = input.nombre()", "value.puntos = input.puntos()", "value." + regions + " = em.find(");
    assertThat(files.get(root + "service/ClienteService.java")).doesNotContain("value.puntos");
    compile(files);
    assertThat(doc.toString()).isEqualTo(before);
    // Optional independent Maven/runtime fixture for the next verification stage.
    var output = System.getProperty("generation.inheritanceFixture");
    if (output != null) for (var entry : files.entrySet()) {
      var path = Path.of(output).resolve(entry.getKey());
      Files.createDirectories(path.getParent());
      Files.writeString(path, entry.getValue());
    }
  }

  @Test void inheritedCrudRejectsRedeclaredIdsAndMissingRootId() {
    var base = clazz("Cliente", "nombre");
    var child = clazz("Premium", "puntos");
    assertThatThrownBy(() -> BackendGenerator.files(hierarchy(base, child)))
        .isInstanceOfSatisfying(BackendGenerator.InvalidModel.class,
            e -> assertThat(e.issues()).extracting(GenerationValidator.Issue::code)
                .contains("INHERITED_IDENTIFIER_REDECLARED", "INHERITED_ATTRIBUTE_COLLISION"));
    var noId = new ClassData(base.id(), base.name(), false, base.position(), List.of());
    var emptyChild = new ClassData(child.id(), child.name(), false, child.position(), List.of());
    assertThatThrownBy(() -> BackendGenerator.files(hierarchy(noId, emptyChild)))
        .isInstanceOfSatisfying(BackendGenerator.InvalidModel.class,
            e -> assertThat(e.issues()).extracting(GenerationValidator.Issue::code).contains("IDENTIFIER_REQUIRED"));
  }

  @Test void inheritedCrudRejectsTechnicalFieldShadowingAndInheritedMandatoryCycles() {
    var base = clazz("Cliente", "nombre");
    var child = new ClassData(UUID.randomUUID(), "Premium", false, new Position(0d, 0d), List.of());
    // A required reference from the root to its child is inherited by the child, forming a cycle.
    var relation = new RelationData(UUID.randomUUID(), "association", child.id(), base.id(), "", "1", "0..*");
    assertThatThrownBy(() -> BackendGenerator.files(hierarchy(base, child, relation)))
        .isInstanceOfSatisfying(BackendGenerator.InvalidModel.class,
            e -> assertThat(e.issues()).extracting(GenerationValidator.Issue::code).contains("REQUIRED_RELATION_CYCLE"));
    String field = "r" + relation.id().toString().replace("-", "");
    var shadowing = new ClassData(child.id(), child.name(), false, child.position(), List.of(
        new AttributeData(UUID.randomUUID(), field, "String", "private", false, false)));
    assertThatThrownBy(() -> BackendGenerator.files(hierarchy(base, shadowing, relation)))
        .isInstanceOfSatisfying(BackendGenerator.InvalidModel.class,
            e -> assertThat(e.issues()).extracting(GenerationValidator.Issue::code).contains("GENERATED_NAME_COLLISION"));
  }

  @Test void abstractEntityTemplateCompilesAndCannotBeInstantiated() throws Exception {
    var base = new ClassData(UUID.randomUUID(), "EntidadBase", true, new Position(0d, 0d), List.of(
        new AttributeData(UUID.randomUUID(), "codigo", "Long", "private", true, true)));
    var child = new ClassData(UUID.randomUUID(), "EntidadConcreta", false, new Position(0d, 0d), List.of());
    var doc = new DiagramDocument(1, UUID.randomUUID(), "Abstracta", 0L, Instant.EPOCH,
        List.of(child, base), List.of(new RelationData(UUID.randomUUID(), "generalization",
            child.id(), base.id(), "", "1", "1")));
    var plan = InheritancePlan.analyze(doc);
    assertThat(plan.valid()).isTrue();
    String root = "com/example/generated/entity/";
    var files = new TreeMap<String, String>();
    files.put(root + "EntidadBase.java", BackendGenerator.entitySource(base, List.of(), plan.classes().get(base.id()), true));
    files.put(root + "EntidadConcreta.java", BackendGenerator.entitySource(child, List.of(), plan.classes().get(child.id()), false));
    assertThat(files.get(root + "EntidadBase.java")).contains("public abstract class EntidadBase",
        "InheritanceType.JOINED", "@jakarta.persistence.Id");
    assertThat(files.get(root + "EntidadConcreta.java")).contains("extends com.example.generated.entity.EntidadBase")
        .doesNotContain("public abstract class");
    compile(files);
  }

  @Test void abstractRootGetsEntityOnlyAndConcreteChildGetsCrud() throws Exception {
    var base = new ClassData(UUID.randomUUID(), "EntidadBase", true, new Position(0d, 0d), List.of(
        new AttributeData(UUID.randomUUID(), "codigo", "Long", "private", true, true)));
    var child = new ClassData(UUID.randomUUID(), "EntidadConcreta", false, new Position(0d, 0d), List.of());
    var region = new ClassData(UUID.randomUUID(), "Region", false, new Position(0d, 0d), List.of(
        new AttributeData(UUID.randomUUID(), "codigo", "Long", "private", true, true),
        new AttributeData(UUID.randomUUID(), "nombre", "String", "private", false, true)));
    var relation = new RelationData(UUID.randomUUID(), "association", region.id(), child.id(), "", "1", "0..*");
    var doc = new DiagramDocument(1, UUID.randomUUID(), "Abstracta", 0L, Instant.EPOCH,
        List.of(base, child, region), List.of(new RelationData(UUID.randomUUID(), "generalization",
            child.id(), base.id(), "", "1", "1"), relation));
    var files = BackendGenerator.files(doc);
    assertThat(files).containsKey("src/main/java/com/example/generated/entity/EntidadBase.java")
        .doesNotContainKey("src/main/java/com/example/generated/controller/EntidadBaseController.java")
        .containsKey("src/main/java/com/example/generated/controller/EntidadConcretaController.java");
    compile(files);
    var output = System.getProperty("generation.abstractFixture");
    if (output != null) for (var entry : files.entrySet()) {
      var path = Path.of(output).resolve(entry.getKey());
      Files.createDirectories(path.getParent());
      Files.writeString(path, entry.getValue());
    }
  }
}
