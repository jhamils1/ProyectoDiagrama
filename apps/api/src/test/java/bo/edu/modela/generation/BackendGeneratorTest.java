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
}
