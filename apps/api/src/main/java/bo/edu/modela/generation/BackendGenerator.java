package bo.edu.modela.generation;

import bo.edu.modela.diagrams.DiagramDocument;
import bo.edu.modela.diagrams.DiagramDocument.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.zip.*;
import javax.lang.model.SourceVersion;

/** Pure, bounded UML-to-source generation. No access to accounts or stored diagrams. */
public final class BackendGenerator {
  private static final String PACKAGE = "com.example.generated";
  private static final String ROOT = "src/main/java/com/example/generated/";
  private BackendGenerator() {}

  public static final class InvalidModel extends IllegalArgumentException {
    private final List<GenerationValidator.Issue> issues;
    public InvalidModel(List<GenerationValidator.Issue> issues) {
      super("El diagrama no está listo para generar.");
      this.issues = List.copyOf(issues);
    }
    public List<GenerationValidator.Issue> issues() { return issues; }
  }

  private record Link(String field, ClassData other, boolean manyToOne) {}
  private static String key(UUID id) { return id.toString().replace("-", ""); }
  private static String entity(ClassData c) { return PACKAGE + ".entity." + c.name(); }
  private static String id(ClassData c) {
    return c.attributes().stream().filter(AttributeData::identifier).findFirst().orElseThrow().name();
  }
  private static boolean javaName(String name) {
    return SourceVersion.isIdentifier(name) && !SourceVersion.isKeyword(name)
        && !Set.of("var", "yield", "record", "sealed", "permits", "when").contains(name);
  }

  public static Map<String, String> files(DiagramDocument model) {
    var issues = new ArrayList<>(GenerationValidator.validate(model).issues());
    for (var c : model.classes()) {
      if (!javaName(c.name())) issues.add(new GenerationValidator.Issue("JAVA_NAME_INVALID", c.id(), "Nombre Java no admitido: " + c.name()));
      for (var a : c.attributes()) {
        if (!javaName(a.name()) || Set.of("clone", "finalize", "getClass", "hashCode", "notify", "notifyAll", "toString", "wait").contains(a.name())) {
          issues.add(new GenerationValidator.Issue("JAVA_NAME_INVALID", a.id(), "Nombre de atributo incompatible con DTO Java: " + a.name()));
        }
      }
    }
    var links = new HashMap<UUID, List<Link>>();
    for (var c : model.classes()) links.put(c.id(), new ArrayList<>());
    for (var r : model.relations()) {
      var oneId = r.sourceMultiplicity().equals("1") ? r.sourceId() : r.targetId();
      var manyId = r.sourceMultiplicity().equals("1") ? r.targetId() : r.sourceId();
      var one = model.classes().stream().filter(c -> c.id().equals(oneId)).findFirst().orElseThrow();
      var many = model.classes().stream().filter(c -> c.id().equals(manyId)).findFirst().orElseThrow();
      String field = "r" + key(r.id());
      links.get(manyId).add(new Link(field, one, true));
      links.get(oneId).add(new Link(field + "Items", many, false));
    }
    for (var c : model.classes()) {
      Set<String> names = new HashSet<>();
      c.attributes().forEach(a -> names.add(a.name()));
      for (var link : links.get(c.id())) {
        for (var name : List.of(link.field(), link.field() + (link.manyToOne() ? "Id" : "Ids"))) {
          if (!names.add(name)) issues.add(new GenerationValidator.Issue("GENERATED_NAME_COLLISION", c.id(), "Nombre reservado para representar una relación: " + name));
        }
      }
      if (hasCycle(c.id(), links, new HashSet<>(), new HashSet<>())) {
        issues.add(new GenerationValidator.Issue("REQUIRED_RELATION_CYCLE", c.id(),
            "Las referencias obligatorias forman un ciclo; el CRUD inicial requiere crear primero los registros referenciados."));
      }
    }
    if (!issues.isEmpty()) throw new InvalidModel(issues);
    var files = new TreeMap<String, String>();
    files.put("pom.xml", pom());
    files.put("src/main/resources/application.properties", """
        spring.application.name=generated-backend
        server.port=${PORT:8081}
        spring.datasource.url=${DB_URL:jdbc:postgresql://localhost:5432/generated}
        spring.datasource.username=${DB_USER}
        spring.datasource.password=${DB_PASSWORD}
        spring.jpa.hibernate.ddl-auto=update
        spring.jpa.open-in-view=false
        """);
    files.put(ROOT + "Application.java", """
        package com.example.generated;
        @org.springframework.boot.autoconfigure.SpringBootApplication
        public class Application {
          public static void main(String[] args) {
            org.springframework.boot.SpringApplication.run(Application.class, args);
          }
        }
        """);
    files.put(ROOT + "controller/Errors.java", """
        package com.example.generated.controller;
        @org.springframework.web.bind.annotation.RestControllerAdvice
        public class Errors {
          @org.springframework.web.bind.annotation.ExceptionHandler(org.springframework.dao.DataIntegrityViolationException.class)
          public org.springframework.http.ResponseEntity<java.util.Map<String, String>> conflict() {
            return org.springframework.http.ResponseEntity.status(409).body(java.util.Map.of("message", "Identificador duplicado o relación que impide la operación."));
          }
        }
        """);
    StringBuilder readme = new StringBuilder("""
        # Backend CRUD generado

        Requisitos: Java 21, Maven 3.9+ y PostgreSQL. Crear una base vacía y definir
        DB_URL, DB_USER y DB_PASSWORD en el entorno. Ejecutar `mvn spring-boot:run`.
        Puerto predeterminado: 8081. Empaquetar con `mvn package`.
        El primer arranque crea tablas mediante Hibernate update (demostración, no migraciones productivas).
        Este backend de demostración no incorpora autenticación ni CORS; no publicarlo como API protegida.

        Los identificadores Long son obligatorios y proporcionados por el cliente.
        POST crea (201); PUT reemplaza los campos editables, exige el mismo ID que la ruta.
        GET consulta (404 si no existe); DELETE elimina (204) sin cascada (409 si hay referencias).
        Las relaciones se modifican desde el extremo muchos, enviando el ID del extremo uno.
        Las colecciones de IDs aparecen únicamente en la respuesta. No se crean entidades relacionadas automáticamente.
        Los nombres técnicos de relaciones provienen de sus UUID para evitar ambigüedades;
        representan asociaciones existentes y no agregan atributos al diagrama UML.
        Decimal/Double se representan como Double; Date/DateTime como LocalDateTime.
        Esto conserva el mapeo solicitado, no precisión decimal exacta ni zonas horarias.

        ## Rutas y relaciones
        """);
    for (var c : model.classes()) {
      var ls = links.get(c.id());
      files.put(ROOT + "entity/" + c.name() + ".java", entitySource(c, ls));
      files.put(ROOT + "repository/" + c.name() + "Repository.java", "package " + PACKAGE + ".repository;\npublic interface " + c.name() + "Repository extends org.springframework.data.jpa.repository.JpaRepository<" + entity(c) + ", java.lang.Long> {}\n");
      files.put(ROOT + "dto/" + c.name() + "Request.java", dto(c, ls, false));
      files.put(ROOT + "dto/" + c.name() + "Response.java", dto(c, ls, true));
      files.put(ROOT + "service/" + c.name() + "Service.java", service(c, ls));
      files.put(ROOT + "controller/" + c.name() + "Controller.java", controller(c));
      readme.append("\n- ").append(c.name()).append(": /").append(c.name().toLowerCase(Locale.ROOT)).append("s (ID: ").append(id(c)).append(")\n");
      for (var l : ls) readme.append("  - ").append(l.field()).append(l.manyToOne() ? "Id" : "Ids").append(" → ").append(l.other().name()).append(l.manyToOne() ? " (obligatorio en solicitud)\n" : " (solo respuesta)\n");
    }
    files.put("README.md", readme.toString());
    return Collections.unmodifiableMap(files);
  }

  private static String type(AttributeData a) {
    var t = GenerationValidator.JAVA_TYPES.get(a.dataType());
    return t.contains(".") ? t : "java.lang." + t;
  }
  private static boolean hasCycle(UUID id, Map<UUID, List<Link>> links, Set<UUID> visiting, Set<UUID> done) {
    if (done.contains(id)) return false;
    if (!visiting.add(id)) return true;
    for (var link : links.get(id)) {
      if (link.manyToOne() && hasCycle(link.other().id(), links, visiting, done)) return true;
    }
    visiting.remove(id);
    done.add(id);
    return false;
  }
  private static String entitySource(ClassData c, List<Link> links) {
    var s = new StringBuilder("package " + PACKAGE + ".entity;\n@jakarta.persistence.Entity\n@jakarta.persistence.Table(name=\"c_" + key(c.id()) + "\")\npublic class " + c.name() + " {\n");
    for (var a : c.attributes()) {
      if (a.identifier()) s.append("  @jakarta.persistence.Id\n");
      s.append("  @jakarta.persistence.Column(name=\"a_").append(key(a.id())).append("\", nullable=").append(!a.required()).append(")\n  public ").append(type(a)).append(" ").append(a.name()).append(";\n");
    }
    for (var l : links) {
      if (l.manyToOne()) s.append("  @jakarta.persistence.ManyToOne(fetch=jakarta.persistence.FetchType.LAZY, optional=false)\n  @jakarta.persistence.JoinColumn(name=\"").append(l.field()).append("\", nullable=false)\n  public ").append(entity(l.other())).append(" ").append(l.field()).append(";\n");
      else s.append("  @jakarta.persistence.OneToMany(mappedBy=\"").append(l.field().replaceFirst("Items$", "")).append("\")\n  public java.util.List<").append(entity(l.other())).append("> ").append(l.field()).append(" = new java.util.ArrayList<>();\n");
    }
    return s.append("}\n").toString();
  }
  private static String dto(ClassData c, List<Link> links, boolean response) {
    List<String> fields = new ArrayList<>();
    for (var a : c.attributes()) fields.add((!response && a.required() ? "@jakarta.validation.constraints.NotNull " : "") + type(a) + " " + a.name());
    for (var l : links) {
      if (l.manyToOne()) fields.add((response ? "" : "@jakarta.validation.constraints.NotNull ") + "java.lang.Long " + l.field() + "Id");
      else if (response) fields.add("java.util.List<java.lang.Long> " + l.field() + "Ids");
    }
    return "package " + PACKAGE + ".dto;\npublic record " + c.name() + (response ? "Response" : "Request") + "(" + String.join(", ", fields) + ") {}\n";
  }

  private static String service(ClassData c, List<Link> links) {
    String e = entity(c), request = PACKAGE + ".dto." + c.name() + "Request", response = PACKAGE + ".dto." + c.name() + "Response";
    var s = new StringBuilder("package " + PACKAGE + ".service;\n@org.springframework.stereotype.Service\n@org.springframework.transaction.annotation.Transactional\npublic class " + c.name() + "Service {\n");
    s.append("  private final ").append(PACKAGE).append(".repository.").append(c.name()).append("Repository repository;\n  @jakarta.persistence.PersistenceContext private jakarta.persistence.EntityManager em;\n  public ").append(c.name()).append("Service(").append(PACKAGE).append(".repository.").append(c.name()).append("Repository repository) { this.repository=repository; }\n");
    s.append("  private ").append(e).append(" find(java.lang.Long id) { return repository.findById(id).orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND)); }\n");
    List<String> output = new ArrayList<>();
    c.attributes().forEach(a -> output.add("value." + a.name()));
    for (var l : links) output.add(l.manyToOne() ? "(java.lang.Long) em.getEntityManagerFactory().getPersistenceUnitUtil().getIdentifier(value." + l.field() + ")" : "value." + l.field() + ".stream().map(item -> (java.lang.Long) em.getEntityManagerFactory().getPersistenceUnitUtil().getIdentifier(item)).toList()");
    s.append("  private ").append(response).append(" dto(").append(e).append(" value) { return new ").append(response).append("(").append(String.join(", ", output)).append("); }\n");
    s.append("  private void apply(").append(e).append(" value, ").append(request).append(" input) {\n");
    for (var a : c.attributes()) s.append("    value.").append(a.name()).append(" = input.").append(a.name()).append("();\n");
    for (var l : links) if (l.manyToOne()) {
      s.append("    value.").append(l.field()).append(" = em.find(").append(entity(l.other())).append(".class, input.").append(l.field()).append("Id());\n    if (value.").append(l.field()).append(" == null) throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST, \"Referencia inexistente\");\n");
    }
    s.append("  }\n  public java.util.List<").append(response).append("> list() { return repository.findAll().stream().map(this::dto).toList(); }\n  public ").append(response).append(" get(java.lang.Long id) { return dto(find(id)); }\n");
    s.append("  public ").append(response).append(" create(").append(request).append(" input) { if(repository.existsById(input.").append(id(c)).append("())) throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.CONFLICT); var value = new ").append(e).append("(); apply(value,input); em.persist(value); em.flush(); return dto(value); }\n");
    s.append("  public ").append(response).append(" update(java.lang.Long id, ").append(request).append(" input) { if(!id.equals(input.").append(id(c)).append("())) throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST, \"El ID no coincide con la ruta\"); var value=find(id); apply(value,input); em.flush(); return dto(value); }\n");
    s.append("  public void delete(java.lang.Long id) { repository.delete(find(id)); repository.flush(); }\n}\n");
    return s.toString();
  }
  private static String controller(ClassData c) {
    return """
        package com.example.generated.controller;
        import org.springframework.web.bind.annotation.*;
        @RestController
        @RequestMapping("/%s")
        public class %sController {
          private final com.example.generated.service.%sService service;
          public %sController(com.example.generated.service.%sService service) { this.service=service; }
          @GetMapping public java.util.List<com.example.generated.dto.%sResponse> list() { return service.list(); }
          @GetMapping("/{id}") public com.example.generated.dto.%sResponse get(@PathVariable("id") java.lang.Long id) { return service.get(id); }
          @PostMapping @ResponseStatus(org.springframework.http.HttpStatus.CREATED)
          public com.example.generated.dto.%sResponse create(@jakarta.validation.Valid @RequestBody com.example.generated.dto.%sRequest input) { return service.create(input); }
          @PutMapping("/{id}") public com.example.generated.dto.%sResponse update(@PathVariable("id") java.lang.Long id, @jakarta.validation.Valid @RequestBody com.example.generated.dto.%sRequest input) { return service.update(id,input); }
          @DeleteMapping("/{id}") @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
          public void delete(@PathVariable("id") java.lang.Long id) { service.delete(id); }
        }
        """.formatted(c.name().toLowerCase(Locale.ROOT) + "s", c.name(), c.name(), c.name(), c.name(), c.name(), c.name(), c.name(), c.name(), c.name(), c.name());
  }
  private static String pom() {
    return """
        <project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
          <modelVersion>4.0.0</modelVersion>
          <parent><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-parent</artifactId><version>4.1.1</version><relativePath/></parent>
          <groupId>com.example</groupId><artifactId>generated-backend</artifactId><version>1.0.0</version>
          <properties><java.version>21</java.version><project.build.sourceEncoding>UTF-8</project.build.sourceEncoding></properties>
          <dependencies>
            <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-webmvc</artifactId></dependency>
            <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-data-jpa</artifactId></dependency>
            <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-validation</artifactId></dependency>
            <dependency><groupId>org.postgresql</groupId><artifactId>postgresql</artifactId><scope>runtime</scope></dependency>
          </dependencies>
          <build><plugins><plugin><groupId>org.springframework.boot</groupId><artifactId>spring-boot-maven-plugin</artifactId></plugin></plugins></build>
        </project>
        """;
  }
  public static byte[] zip(DiagramDocument document) {
    var files = files(document);
    try (var bytes = new ByteArrayOutputStream(); var zip = new ZipOutputStream(bytes, StandardCharsets.UTF_8)) {
      for (var entry : files.entrySet()) {
        var ze = new ZipEntry(entry.getKey());
        ze.setTime(0);
        zip.putNextEntry(ze);
        zip.write(entry.getValue().getBytes(StandardCharsets.UTF_8));
        zip.closeEntry();
      }
      zip.finish();
      return bytes.toByteArray();
    } catch (IOException e) { throw new UncheckedIOException(e); }
  }
}
