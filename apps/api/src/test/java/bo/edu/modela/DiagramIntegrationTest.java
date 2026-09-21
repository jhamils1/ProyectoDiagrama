package bo.edu.modela;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import bo.edu.modela.auth.*;
import bo.edu.modela.projects.*;
import bo.edu.modela.users.*;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import tools.jackson.databind.ObjectMapper;

// Requests commit independently: exercises replacement, rollback and concurrency beyond a shared
// test transaction.
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class DiagramIntegrationTest {
  @Test @SuppressWarnings("unchecked")
  void xmiPreviewChecksAccessResolvesExplicitChoicesAndNeverPersists() throws Exception {
    byte[] xml;
    try(var in=getClass().getResourceAsStream("/interoperability/ea-sample.xml")) { xml=in.readAllBytes(); }
    var body=new HashMap<String,Object>();
    body.put("name","Importado"); body.put("xmlBase64",Base64.getEncoder().encodeToString(xml));
    body.put("attributeTypes",Map.of()); body.put("excludedInvalidAssociations",List.of());
    String endpoint="/api/projects/"+project.id+"/imports/xmi/preview";
    mvc.perform(post(endpoint).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body))).andExpect(status().isUnauthorized());
    mvc.perform(post(endpoint).with(actor(admin)).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body))).andExpect(status().isForbidden());
    mvc.perform(post(endpoint).with(actor(collaborator)).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body))).andExpect(status().isNotFound());
    var member=members.saveAndFlush(new Participacion(collaborator,project,Participacion.Permiso.CONSULTA));
    mvc.perform(post(endpoint).with(actor(collaborator)).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body))).andExpect(status().isForbidden());
    member.permiso=Participacion.Permiso.EDICION; members.saveAndFlush(member);
    mvc.perform(post(endpoint).with(actor(collaborator)).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)))
        .andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store"))
        .andExpect(jsonPath("$.document").isEmpty()).andExpect(jsonPath("$.issues.length()").value(2));
    var inventory=bo.edu.modela.interoperability.EaXmiReader.read(xml);
    var type=inventory.issues().stream().filter(i->i.code().equals("TYPE_MAPPING_REQUIRED")).findFirst().orElseThrow().elementId();
    var relation=inventory.issues().stream().filter(i->i.code().equals("ASSOCIATION_ENDS_INVALID")).findFirst().orElseThrow().elementId();
    body.put("attributeTypes",Map.of(type,"Double")); body.put("excludedInvalidAssociations",List.of(relation));
    var previewResponse=mvc.perform(post(endpoint).with(actor(admin)).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)))
        .andExpect(status().isOk()).andExpect(jsonPath("$.document.classes.length()").value(3))
        .andExpect(jsonPath("$.document.relations.length()").value(2)).andExpect(jsonPath("$.issues").isEmpty())
        .andReturn().getResponse().getContentAsString();
    var reviewed=(Map<String,Object>)json.readValue(previewResponse,Map.class).get("document");
    body.put("xmlBase64","not-base64!");
    mvc.perform(post(endpoint).with(actor(admin)).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)))
        .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("XMI_INVALIDO"));
    assertThat(jdbc.queryForObject("select count(*) from diagrama where proyecto_id=?",Integer.class,project.id)).isZero();
    members.deleteById(member.id);
    mvc.perform(post(endpoint).with(actor(collaborator)).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body))).andExpect(status().isNotFound());
    create(reviewed,collaborator).andExpect(status().isNotFound());
    create(reviewed,admin).andExpect(status().isCreated());
    create(reviewed,admin).andExpect(status().isCreated());
    assertThat(jdbc.queryForObject("select count(*) from diagrama where proyecto_id=?",Integer.class,project.id)).isEqualTo(1);
    mvc.perform(get(path()+"/"+reviewed.get("id")).with(actor(admin)))
        .andExpect(status().isOk()).andExpect(jsonPath("$.document.classes.length()").value(3))
        .andExpect(jsonPath("$.document.relations.length()").value(2));
  }
  @Test @SuppressWarnings("unchecked")
  void backendDownloadChecksPermissionsRevisionAndKeepsHistory() throws Exception {
    var doc = copy(document());
    var classes = (List<Map<String,Object>>)doc.get("classes");
    for (var c : classes) c.put("attributes", List.of(Map.of("id", UUID.randomUUID().toString(),
        "name", "codigo", "dataType", "Long", "visibility", "private", "identifier", true, "required", true)));
    var parent = classes.stream().filter(c -> c.get("name").equals("Cliente")).findFirst().orElseThrow();
    var child = new HashMap<String,Object>(parent);
    child.put("id", UUID.randomUUID().toString()); child.put("name", "ClientePremium");
    child.put("attributes", List.of()); classes.add(child);
    var relations = new ArrayList<Map<String,Object>>((List<Map<String,Object>>)doc.get("relations"));
    relations.add(Map.of("id",UUID.randomUUID().toString(),"type","generalization",
        "sourceId",child.get("id"),"targetId",parent.get("id"),"name","","sourceMultiplicity","1","targetMultiplicity","1"));
    doc.put("relations", relations);
    create(doc, admin).andExpect(status().isCreated());
    String endpoint = path()+"/"+doc.get("id")+"/backend?revision=0";
    mvc.perform(get(endpoint)).andExpect(status().isUnauthorized());
    mvc.perform(get(endpoint).with(actor(collaborator))).andExpect(status().isNotFound());
    var member = members.saveAndFlush(new Participacion(collaborator, project, Participacion.Permiso.CONSULTA));
    mvc.perform(get(endpoint).with(actor(collaborator))).andExpect(status().isForbidden());
    member.permiso = Participacion.Permiso.EDICION; members.saveAndFlush(member);
    for (var user : List.of(admin, collaborator)) {
      var response = mvc.perform(get(endpoint).with(actor(user))).andExpect(status().isOk())
          .andExpect(content().contentType("application/zip"))
          .andExpect(header().string("Cache-Control", "no-store"))
          .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.containsString(".zip")))
          .andReturn().getResponse();
      try (var zip = new java.util.zip.ZipInputStream(new java.io.ByteArrayInputStream(response.getContentAsByteArray()))) {
        var names = new ArrayList<String>();
        for (var entry = zip.getNextEntry(); entry != null; entry = zip.getNextEntry()) {
          names.add(entry.getName());
          if (entry.getName().endsWith("entity/ClientePremium.java")) {
            assertThat(new String(zip.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8))
                .contains("extends com.example.generated.entity.Cliente").doesNotContain("@jakarta.persistence.Id");
          }
        }
        assertThat(names).contains("pom.xml", "src/main/java/com/example/generated/entity/Cliente.java");
        assertThat(names).contains("src/main/java/com/example/generated/controller/ClientePremiumController.java");
      }
    }
    mvc.perform(get(path()+"/"+doc.get("id")+"/backend?revision=1").with(actor(admin))).andExpect(status().isConflict());
    mvc.perform(get("/api/projects/"+other.id+"/diagrams/"+doc.get("id")+"/backend?revision=0").with(actor(admin))).andExpect(status().isNotFound());
    assertThat(jdbc.queryForObject("select count(*) from version_diagrama where diagrama_id=?", Integer.class,
        UUID.fromString((String)doc.get("id")))).isEqualTo(1);
    members.deleteById(member.id);
    mvc.perform(get(endpoint).with(actor(collaborator))).andExpect(status().isNotFound());
  }

  @Test
  void backendDownloadReportsValidationIssuesInsteadOfZip() throws Exception {
    var doc = document(); create(doc, admin).andExpect(status().isCreated());
    mvc.perform(get(path()+"/"+doc.get("id")+"/backend?revision=0").with(actor(admin)))
        .andExpect(status().isUnprocessableEntity())
        .andExpect(jsonPath("$.code").value("GENERACION_INVALIDA"))
        .andExpect(jsonPath("$.issues[0].elementId").exists())
        .andExpect(jsonPath("$.issues[0].message").isNotEmpty());
  }

  @Test @SuppressWarnings("unchecked")
  void backendDownloadExplainsRedeclaredInheritedIdentifier() throws Exception {
    var doc = copy(document());
    var classes = (List<Map<String,Object>>)doc.get("classes");
    for (var c : classes) c.put("attributes", List.of(Map.of("id", UUID.randomUUID().toString(),
        "name", "id", "dataType", "Long", "visibility", "private", "identifier", true, "required", true)));
    doc.put("relations", List.of(Map.of("id",UUID.randomUUID().toString(),"type","generalization",
        "sourceId",classes.get(1).get("id"),"targetId",classes.get(0).get("id"),
        "name","","sourceMultiplicity","1","targetMultiplicity","1")));
    create(doc, admin).andExpect(status().isCreated());
    mvc.perform(get(path()+"/"+doc.get("id")+"/backend?revision=0").with(actor(admin)))
        .andExpect(status().isUnprocessableEntity())
        .andExpect(jsonPath("$.code").value("GENERACION_INVALIDA"))
        .andExpect(jsonPath("$.issues[*].code", org.hamcrest.Matchers.hasItem("INHERITED_IDENTIFIER_REDECLARED")));
  }
  ResultActions createOffline(Map<String,Object> doc, UUID requestId, Usuario user) throws Exception {
    return mvc.perform(post(path()+"/"+doc.get("id")+"/changes/create").with(actor(user)).with(csrf())
      .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of(
        "id",requestId,"authorId",user.id,"document",doc))));
  }
  @Test
  void offlineCreationRetriesAfterLaterEditsWithoutOverwritingOrDuplicating() throws Exception {
    var doc=document(); UUID requestId=UUID.randomUUID();
    createOffline(doc,requestId,admin).andExpect(status().isOk()).andExpect(jsonPath("$.current.revision").value(0));
    var changed=copy(doc); changed.put("name","Cambio posterior");
    update(changed,0,admin).andExpect(status().isOk());
    createOffline(doc,requestId,admin).andExpect(status().isOk())
      .andExpect(jsonPath("$.current.document.name").value("Cambio posterior"))
      .andExpect(jsonPath("$.current.revision").value(1));
    assertThat(jdbc.queryForObject("select count(*) from version_diagrama where diagrama_id=?",Integer.class,UUID.fromString((String)doc.get("id")))).isEqualTo(2);
    assertThat(jdbc.queryForObject("select operacion from cambio where id=?",String.class,requestId)).isEqualTo("CREAR");
    createOffline(changed,requestId,admin).andExpect(status().isConflict());
    createOffline(doc,UUID.randomUUID(),admin).andExpect(status().isConflict());
    propose(doc,requestId,0,admin).andExpect(status().isConflict());
  }
  @Test
  void offlineCreationChecksIdentityPermissionCsrfAndRevocation() throws Exception {
    var doc=document(); UUID requestId=UUID.randomUUID();
    var membership=members.saveAndFlush(new Participacion(collaborator,project,Participacion.Permiso.CONSULTA));
    createOffline(doc,requestId,collaborator).andExpect(status().isForbidden());
    mvc.perform(post(path()+"/"+doc.get("id")+"/changes/create").with(actor(admin)).with(csrf())
      .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("id",requestId,"authorId",collaborator.id,"document",doc))))
      .andExpect(status().isForbidden());
    mvc.perform(post(path()+"/"+doc.get("id")+"/changes/create").with(actor(admin))
      .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("id",requestId,"authorId",admin.id,"document",doc))))
      .andExpect(status().isForbidden());
    membership.permiso=Participacion.Permiso.EDICION; members.saveAndFlush(membership);
    createOffline(doc,requestId,collaborator).andExpect(status().isOk());
    createOffline(doc,requestId,admin).andExpect(status().isNotFound());
    members.deleteById(membership.id);
    createOffline(doc,requestId,collaborator).andExpect(status().isNotFound());
  }
  @Test
  void invalidOfflineCreationLeavesNoDiagramOrReceipt() throws Exception {
    var doc=document(); doc.put("name",""); UUID requestId=UUID.randomUUID();
    createOffline(doc,requestId,admin).andExpect(status().isBadRequest());
    assertThat(jdbc.queryForObject("select count(*) from diagrama where proyecto_id=?",Integer.class,project.id)).isZero();
    assertThat(jdbc.queryForObject("select count(*) from cambio where id=?",Integer.class,requestId)).isZero();
  }
  @Test
  void concurrentOfflineCreationCommitsOneReceiptAndOneVersion() throws Exception {
    var doc=document(); UUID requestId=UUID.randomUUID();
    try(var pool=Executors.newFixedThreadPool(2)) {
      var gate=new CountDownLatch(1);
      Callable<Integer> action=()->{ gate.await(); return createOffline(doc,requestId,admin).andReturn().getResponse().getStatus(); };
      var a=pool.submit(action); var b=pool.submit(action); gate.countDown();
      assertThat(List.of(a.get(15,TimeUnit.SECONDS),b.get(15,TimeUnit.SECONDS))).containsExactly(200,200);
    }
    assertThat(jdbc.queryForObject("select count(*) from cambio where id=?",Integer.class,requestId)).isEqualTo(1);
    assertThat(jdbc.queryForObject("select count(*) from version_diagrama where diagrama_id=?",Integer.class,UUID.fromString((String)doc.get("id")))).isEqualTo(1);
  }
  @Test
  void offlineProposalCannotBeSubmittedUnderAnotherAccount() throws Exception {
    var doc=document(); create(doc,admin).andExpect(status().isCreated());
    UUID change=UUID.randomUUID(); doc.put("name","Offline");
    mvc.perform(post(path()+"/"+doc.get("id")+"/changes").with(actor(admin)).with(csrf())
      .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of(
        "id",change,"baseRevision",0,"document",doc,"authorId",UUID.randomUUID()))))
      .andExpect(status().isForbidden());
    assertThat(jdbc.queryForObject("select count(*) from cambio where id=?",Integer.class,change)).isZero();
    mvc.perform(post(path()+"/"+doc.get("id")+"/changes").with(actor(admin)).with(csrf())
      .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of(
        "id",change,"baseRevision",0,"document",doc,"authorId",admin.id))))
      .andExpect(status().isOk()).andExpect(jsonPath("$.current.revision").value(1));
  }
  ResultActions propose(Map<String,Object> doc, UUID requestId, long revision, Usuario user) throws Exception {
    return mvc.perform(post(path()+"/"+doc.get("id")+"/changes").with(actor(user)).with(csrf())
        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("id",requestId,"baseRevision",revision,"document",doc))));
  }
  ResultActions resolveChange(Map<String,Object> doc, UUID change, long revision, Map<String,Object> choices, Usuario user) throws Exception {
    return mvc.perform(post(path()+"/"+doc.get("id")+"/changes/"+change+"/resolve").with(actor(user)).with(csrf())
        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("comparedRevision",revision,"choices",choices))));
  }
  @SuppressWarnings("unchecked")
  Map<String,Object> copy(Map<String,Object> doc) { return json.readValue(json.writeValueAsString(doc),Map.class); }

  @Test @SuppressWarnings("unchecked")
  void proposalsMergeIndependentFieldsAndRetryWithoutDuplicateVersions() throws Exception {
    var base=document(); create(base,admin).andExpect(status().isCreated());
    var remote=copy(base); remote.put("name","Remoto"); update(remote,0,admin).andExpect(status().isOk());
    var local=copy(base); ((List<Map<String,Object>>)local.get("classes")).get(0).put("name","Local");
    UUID change=UUID.randomUUID();
    propose(local,change,0,admin).andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("APLICADO"))
        .andExpect(jsonPath("$.current.document.name").value("Remoto"))
        .andExpect(jsonPath("$.current.document.classes[0].name").value("Local"))
        .andExpect(jsonPath("$.current.revision").value(2));
    propose(local,change,0,admin).andExpect(status().isOk()).andExpect(jsonPath("$.current.revision").value(2));
    local.put("name","Reutilizado"); propose(local,change,0,admin).andExpect(status().isConflict());
    assertThat(jdbc.queryForObject("select count(*) from cambio where id=?",Integer.class,change)).isEqualTo(1);
  }

  @Test
  void conflictPersistsBothValuesAndCustomResolutionIsAtomicAndIdempotent() throws Exception {
    var base=document(); create(base,admin).andExpect(status().isCreated());
    var remote=copy(base); remote.put("name","Servidor"); update(remote,0,admin).andExpect(status().isOk());
    var local=copy(base); local.put("name","Propuesta"); UUID change=UUID.randomUUID();
    propose(local,change,0,admin).andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("PENDIENTE"))
        .andExpect(jsonPath("$.conflicts[0].base").value("Ventas"))
        .andExpect(jsonPath("$.conflicts[0].local").value("Propuesta"))
        .andExpect(jsonPath("$.conflicts[0].server").value("Servidor"));
    mvc.perform(get(path()+"/"+base.get("id")+"/changes").with(actor(admin)))
        .andExpect(status().isOk()).andExpect(jsonPath("$[0]").value(change.toString()));
    mvc.perform(get(path()+"/"+base.get("id")+"/changes/"+change).with(actor(admin)))
        .andExpect(status().isOk()).andExpect(jsonPath("$.proposed.name").value("Propuesta"));
    var choices=Map.<String,Object>of("/name",Map.of("source","custom","value","Acuerdo"));
    resolveChange(base,change,1,choices,admin).andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("APLICADO"))
        .andExpect(jsonPath("$.current.document.name").value("Acuerdo"))
        .andExpect(jsonPath("$.current.revision").value(2));
    resolveChange(base,change,1,choices,admin).andExpect(status().isOk()).andExpect(jsonPath("$.current.revision").value(2));
    assertThat(jdbc.queryForObject("select estado from conflicto where cambio_id=?",String.class,change)).isEqualTo("RESUELTO");
    assertThat(jdbc.queryForObject("select valor_resuelto #>> '{}' from conflicto where cambio_id=?",String.class,change)).isEqualTo("Acuerdo");
  }

  @Test
  void aNewSaveDuringResolutionRequiresFreshChoicesAndKeepsHistory() throws Exception {
    var doc=document(); create(doc,admin).andExpect(status().isCreated());
    var local=copy(doc); local.put("name","Local");
    doc.put("name","Primero"); update(doc,0,admin).andExpect(status().isOk());
    UUID change=UUID.randomUUID(); propose(local,change,0,admin).andExpect(status().isOk());
    doc.put("name","Más reciente"); update(doc,1,admin).andExpect(status().isOk());
    var choice=Map.<String,Object>of("/name",Map.of("source","local"));
    resolveChange(doc,change,1,choice,admin).andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("PENDIENTE"))
        .andExpect(jsonPath("$.comparedRevision").value(2))
        .andExpect(jsonPath("$.conflicts[0].server").value("Más reciente"));
    resolveChange(doc,change,2,Map.of("/name",Map.of("source","server")),admin)
        .andExpect(status().isOk()).andExpect(jsonPath("$.current.document.name").value("Más reciente"));
    assertThat(jdbc.queryForObject("select count(*) from conflicto where cambio_id=? and estado='SUPERADO'",Integer.class,change)).isEqualTo(1);
  }

  @Test
  void invalidResolutionRollsBackAndDiscardDoesNotChangeTheDiagram() throws Exception {
    var doc=document(); create(doc,admin).andExpect(status().isCreated());
    var local=copy(doc); local.put("name","Local"); doc.put("name","Servidor"); update(doc,0,admin).andExpect(status().isOk());
    UUID change=UUID.randomUUID(); propose(local,change,0,admin).andExpect(status().isOk());
    resolveChange(doc,change,1,Map.of("/name",Map.of("source","custom","value","")),admin).andExpect(status().isBadRequest());
    resolveChange(doc,change,1,Map.of(),admin).andExpect(status().isBadRequest());
    assertThat(jdbc.queryForObject("select estado from cambio where id=?",String.class,change)).isEqualTo("PENDIENTE");
    mvc.perform(post(path()+"/"+doc.get("id")+"/changes/"+change+"/discard").with(actor(admin)).with(csrf()))
        .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("DESCARTADO"))
        .andExpect(jsonPath("$.current.revision").value(1));
  }

  @Test
  void proposalsRespectAuthorPermissionsCsrfAndRevocation() throws Exception {
    var doc=document(); create(doc,admin).andExpect(status().isCreated());
    var local=copy(doc); local.put("name","Local"); doc.put("name","Remoto"); update(doc,0,admin).andExpect(status().isOk());
    members.saveAndFlush(new Participacion(collaborator,project,Participacion.Permiso.CONSULTA));
    propose(local,UUID.randomUUID(),0,collaborator).andExpect(status().isForbidden());
    jdbc.update("update participacion set permiso='EDICION' where proyecto_id=?",project.id);
    UUID change=UUID.randomUUID(); propose(local,change,0,collaborator).andExpect(status().isOk());
    mvc.perform(get(path()+"/"+doc.get("id")+"/changes/"+change).with(actor(admin))).andExpect(status().isNotFound());
    mvc.perform(post(path()+"/"+doc.get("id")+"/changes/"+change+"/discard").with(actor(collaborator))).andExpect(status().isForbidden());
    jdbc.update("update participacion set permiso='CONSULTA' where proyecto_id=?",project.id);
    resolveChange(doc,change,1,Map.of("/name",Map.of("source","local")),collaborator).andExpect(status().isForbidden());
    jdbc.update("delete from participacion where proyecto_id=?",project.id);
    mvc.perform(get(path()+"/"+doc.get("id")+"/changes/"+change).with(actor(collaborator))).andExpect(status().isNotFound());
  }

  @Test @SuppressWarnings("unchecked")
  void crossFieldInvalidMergeRequiresAnExplicitWholeModelChoice() throws Exception {
    var base=document(); create(base,admin).andExpect(status().isCreated());
    var local=copy(base); var remote=copy(base);
    ((List<Map<String,Object>>)local.get("classes")).get(0).put("name","Mismo");
    ((List<Map<String,Object>>)remote.get("classes")).get(1).put("name","Mismo");
    update(remote,0,admin).andExpect(status().isOk());
    UUID change=UUID.randomUUID();
    propose(local,change,0,admin).andExpect(status().isOk()).andExpect(jsonPath("$.conflicts[0].path").value("/"));
    resolveChange(base,change,1,Map.of("/",Map.of("source","local")),admin).andExpect(status().isOk())
        .andExpect(jsonPath("$.current.document.classes[0].name").value("Mismo"));
  }

  @Test @SuppressWarnings("unchecked")
  void deletingAnEditedClassRequiresChoiceAndDoesNotLeaveDanglingRelations() throws Exception {
    var base=document(); create(base,admin).andExpect(status().isCreated());
    var local=copy(base); var remote=copy(base);
    ((List<Map<String,Object>>)local.get("classes")).get(0).put("name","Editada");
    ((List<Map<String,Object>>)remote.get("classes")).remove(0); remote.put("relations",List.of());
    update(remote,0,admin).andExpect(status().isOk());
    UUID change=UUID.randomUUID(); var response=propose(local,change,0,admin).andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("PENDIENTE")).andReturn();
    String conflictPath=json.readTree(response.getResponse().getContentAsString()).get("conflicts").get(0).get("path").asText();
    resolveChange(base,change,1,Map.of(conflictPath,Map.of("source","server")),admin).andExpect(status().isOk())
        .andExpect(jsonPath("$.current.document.classes.length()").value(1))
        .andExpect(jsonPath("$.current.document.relations.length()").value(0));
  }

  @Test
  void invalidBaseAndForeignDiagramNeverCreateChanges() throws Exception {
    var doc=document(); create(doc,admin).andExpect(status().isCreated());
    propose(doc,UUID.randomUUID(),8,admin).andExpect(status().isConflict());
    mvc.perform(post("/api/projects/"+other.id+"/diagrams/"+doc.get("id")+"/changes").with(actor(admin)).with(csrf())
        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("id",UUID.randomUUID(),"baseRevision",0,"document",doc))))
        .andExpect(status().isNotFound());
    assertThat(jdbc.queryForObject("select count(*) from cambio where diagrama_id=?",Integer.class,UUID.fromString((String)doc.get("id")))).isZero();
  }

  @Autowired bo.edu.modela.diagrams.DiagramService diagramService;

  @Test
  void liveIdentityIsRevalidatedWithoutAnHttpSecurityContext() throws Exception {
    var doc = document();
    create(doc, admin).andExpect(status().isCreated());
    UUID id = UUID.fromString((String) doc.get("id"));
    assertThatThrownBy(() -> diagramService.liveState(project.id, id, collaborator.id))
        .isInstanceOf(bo.edu.modela.shared.ApiException.class);
    members.saveAndFlush(new Participacion(collaborator, project, Participacion.Permiso.CONSULTA));
    assertThat(diagramService.liveState(project.id, id, collaborator.id).permiso()).isEqualTo("CONSULTA");
    jdbc.update("update participacion set permiso='EDICION' where proyecto_id=?", project.id);
    assertThat(diagramService.liveState(project.id, id, collaborator.id).permiso()).isEqualTo("EDICION");
    jdbc.update("delete from participacion where proyecto_id=?", project.id);
    assertThatThrownBy(() -> diagramService.liveState(project.id, id, collaborator.id))
        .isInstanceOf(bo.edu.modela.shared.ApiException.class);
    jdbc.update("update usuario set activo=false where id=?", collaborator.id);
    assertThatThrownBy(() -> diagramService.liveState(project.id, id, collaborator.id))
        .isInstanceOf(bo.edu.modela.shared.ApiException.class);
  }

  @Test
  void stateTracksRevisionWithoutReturningTheGraph() throws Exception {
    var doc = document();
    create(doc, admin).andExpect(status().isCreated());
    members.saveAndFlush(new Participacion(collaborator, project, Participacion.Permiso.CONSULTA));
    String endpoint = path() + "/" + doc.get("id") + "/state";
    mvc.perform(get(endpoint).with(actor(collaborator)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.revision").value(0))
        .andExpect(jsonPath("$.permiso").value("CONSULTA"))
        .andExpect(jsonPath("$.document").doesNotExist());
    doc.put("name", "Actualizado");
    update(doc, 0, admin).andExpect(status().isOk());
    mvc.perform(get(endpoint).with(actor(collaborator)))
        .andExpect(status().isOk()).andExpect(jsonPath("$.revision").value(1));
    jdbc.update("delete from participacion where proyecto_id=?", project.id);
    mvc.perform(get(endpoint).with(actor(collaborator))).andExpect(status().isNotFound());
  }

  @Test
  void stateRequiresSessionAndProjectAccessAndRejectsDeletedDiagrams() throws Exception {
    var doc = document();
    create(doc, admin).andExpect(status().isCreated());
    String endpoint = path() + "/" + doc.get("id") + "/state";
    mvc.perform(get(endpoint)).andExpect(status().isUnauthorized());
    mvc.perform(get(endpoint).with(actor(collaborator))).andExpect(status().isNotFound());
    mvc.perform(get("/api/projects/" + other.id + "/diagrams/" + doc.get("id") + "/state")
            .with(actor(admin))).andExpect(status().isNotFound());
    mvc.perform(delete(path() + "/" + doc.get("id") + "?revision=0")
            .with(actor(admin)).with(csrf())).andExpect(status().isNoContent());
    mvc.perform(get(endpoint).with(actor(admin))).andExpect(status().isNotFound());
  }

  @Test
  @SuppressWarnings("unchecked")
  void rejectsInvalidNamesAttributesPositionsAndInheritanceCycles() throws Exception {
    for (String scenario : List.of("duplicateName", "identifier", "position", "cycle")) {
      var doc = document();
      var classes = new ArrayList<>((List<Map<String, Object>>) doc.get("classes"));
      var first = new HashMap<>(classes.get(0));
      if (scenario.equals("duplicateName")) first.put("name", "cliente");
      if (scenario.equals("position")) first.put("position", Map.of("x", 100001, "y", 0));
      if (scenario.equals("identifier"))
        first.put(
            "attributes",
            List.of(
                Map.of(
                    "id",
                    UUID.randomUUID().toString(),
                    "name",
                    "id",
                    "dataType",
                    "UUID",
                    "visibility",
                    "private",
                    "identifier",
                    true,
                    "required",
                    false)));
      if (scenario.equals("cycle")) {
        var r = new HashMap<>(((List<Map<String, Object>>) doc.get("relations")).get(0));
        r.put("type", "generalization");
        var inverse = new HashMap<>(r);
        inverse.put("id", UUID.randomUUID().toString());
        inverse.put("sourceId", r.get("targetId"));
        inverse.put("targetId", r.get("sourceId"));
        doc.put("relations", List.of(r, inverse));
      }
      classes.set(0, first);
      doc.put("classes", classes);
      create(doc, admin).andExpect(status().isBadRequest());
    }
    assertThat(
            jdbc.queryForObject(
                "select count(*) from diagrama where proyecto_id=?", Integer.class, project.id))
        .isZero();
  }

  @Autowired MockMvc mvc;
  @Autowired UsuarioRepository users;
  @Autowired ProyectoRepository projects;
  @Autowired ParticipacionRepository members;
  @Autowired ObjectMapper json;
  @Autowired JdbcTemplate jdbc;
  @MockitoBean GoogleTokenVerifier google;
  Usuario admin, collaborator;
  Proyecto project, other;

  @BeforeEach
  void setup() {
    assertThat(jdbc.queryForObject("select current_database()", String.class))
        .isEqualTo("modela_test");
    admin = users.findByCorreo("admin@test.local").orElseThrow();
    collaborator =
        users.saveAndFlush(
            new Usuario(
                "Prueba diagramas",
                UUID.randomUUID() + "@gmail.com",
                Usuario.Rol.COLABORADOR,
                null));
    project =
        projects.saveAndFlush(new Proyecto("Diagramas " + UUID.randomUUID(), "Pruebas", admin));
    other = projects.saveAndFlush(new Proyecto("Ajeno " + UUID.randomUUID(), "Pruebas", admin));
  }

  @AfterEach
  void cleanup() {
    for (var p : List.of(project, other)) {
      jdbc.update("delete from conflicto where cambio_id in (select c.id from cambio c join diagrama d on d.id=c.diagrama_id where d.proyecto_id=?)",p.id);
      jdbc.update("delete from cambio where diagrama_id in (select id from diagrama where proyecto_id=?)",p.id);
      jdbc.update(
          "delete from version_diagrama where diagrama_id in (select id from diagrama where"
              + " proyecto_id=?)",
          p.id);
      jdbc.update(
          "delete from atributo_uml where clase_id in (select c.id from clase_uml c join diagrama d"
              + " on d.id=c.diagrama_id where d.proyecto_id=?)",
          p.id);
      jdbc.update(
          "delete from relacion_uml where diagrama_id in (select id from diagrama where"
              + " proyecto_id=?)",
          p.id);
      jdbc.update(
          "delete from clase_uml where diagrama_id in (select id from diagrama where"
              + " proyecto_id=?)",
          p.id);
      jdbc.update("delete from diagrama where proyecto_id=?", p.id);
      jdbc.update("delete from participacion where proyecto_id=?", p.id);
      projects.deleteById(p.id);
    }
    users.deleteById(collaborator.id);
  }

  RequestPostProcessor actor(Usuario u) {
    return authentication(
        new UsernamePasswordAuthenticationToken(
            new SessionPrincipal(u.id, u.rol), null, List.of()));
  }

  String path() {
    return "/api/projects/" + project.id + "/diagrams";
  }

  Map<String, Object> document() {
    String a = UUID.randomUUID().toString(), b = UUID.randomUUID().toString();
    var attribute =
        Map.of(
            "id",
            UUID.randomUUID().toString(),
            "name",
            "id",
            "dataType",
            "UUID",
            "visibility",
            "private",
            "identifier",
            true,
            "required",
            true);
    var first =
        Map.of(
            "id",
            a,
            "name",
            "Pedido",
            "abstract",
            false,
            "position",
            Map.of("x", 100, "y", 200),
            "attributes",
            List.of(attribute));
    var second =
        Map.of(
            "id",
            b,
            "name",
            "Cliente",
            "abstract",
            false,
            "position",
            Map.of("x", 500, "y", 200),
            "attributes",
            List.of());
    var relation =
        Map.of(
            "id",
            UUID.randomUUID().toString(),
            "type",
            "association",
            "sourceId",
            a,
            "targetId",
            b,
            "name",
            "pertenece",
            "sourceMultiplicity",
            "0..*",
            "targetMultiplicity",
            "1");
    return new HashMap<>(
        Map.of(
            "schemaVersion",
            1,
            "id",
            UUID.randomUUID().toString(),
            "name",
            "Ventas",
            "localRevision",
            0,
            "updatedAt",
            "2026-09-20T00:00:00Z",
            "classes",
            List.of(first, second),
            "relations",
            List.of(relation)));
  }

  @Test
  void untypedAttributePersistsCanBeTypedAndKeepsHistory() throws Exception {
    var doc = copy(document());
    var attribute = ((List<Map<String,Object>>)((List<Map<String,Object>>)doc.get("classes")).get(0).get("attributes")).get(0);
    var attributeId = UUID.fromString((String)attribute.get("id"));
    attribute.remove("dataType");
    create(doc, admin).andExpect(status().isCreated())
        .andExpect(jsonPath("$.document.classes[0].attributes[0].dataType").value(""));
    assertThat(jdbc.queryForObject("select tipo_dato from atributo_uml where id=?", String.class, attributeId)).isEmpty();
    attribute.put("dataType", "String");
    propose(doc, UUID.randomUUID(), 0, admin).andExpect(status().isOk());
    mvc.perform(get(path()+"/"+doc.get("id")).with(actor(admin)))
        .andExpect(jsonPath("$.document.classes[0].attributes[0].dataType").value("String"));
    attribute.put("dataType", "");
    propose(doc, UUID.randomUUID(), 1, admin).andExpect(status().isOk());
    assertThat(jdbc.queryForObject("select tipo_dato from atributo_uml where id=?", String.class, attributeId)).isEmpty();
    assertThat(jdbc.queryForObject("select contenido #>> '{classes,0,attributes,0,dataType}' from version_diagrama where diagrama_id=? and numero=2", String.class, UUID.fromString((String)doc.get("id")))).isEqualTo("String");
    attribute.put("dataType", "inventado");
    propose(doc, UUID.randomUUID(), 2, admin).andExpect(status().isBadRequest());
    assertThat(jdbc.queryForObject("select tipo_dato from atributo_uml where id=?", String.class, attributeId)).isEmpty();
  }

  @Test
  void floatingTypesPersistAndKeepPreviousVersion() throws Exception {
    var doc = copy(document());
    var attribute = ((List<Map<String,Object>>)((List<Map<String,Object>>)doc.get("classes")).get(0).get("attributes")).get(0);
    var attributeId = UUID.fromString((String)attribute.get("id"));
    attribute.put("dataType", "Float");
    create(doc, admin).andExpect(status().isCreated());
    assertThat(jdbc.queryForObject("select tipo_dato from atributo_uml where id=?", String.class, attributeId)).isEqualTo("Float");
    attribute.put("dataType", "Double");
    propose(doc, UUID.randomUUID(), 0, admin).andExpect(status().isOk());
    mvc.perform(get(path()+"/"+doc.get("id")).with(actor(admin)))
        .andExpect(jsonPath("$.document.classes[0].attributes[0].dataType").value("Double"));
    assertThat(jdbc.queryForObject("select tipo_dato from atributo_uml where id=?", String.class, attributeId)).isEqualTo("Double");
    assertThat(jdbc.queryForObject("select contenido #>> '{classes,0,attributes,0,dataType}' from version_diagrama where diagrama_id=? and numero=1", String.class, UUID.fromString((String)doc.get("id")))).isEqualTo("Float");
  }

  @Test
  void spanishNamesPersistWithoutLosingAccents() throws Exception {
    var doc = copy(document());
    var clazz = ((List<Map<String,Object>>)doc.get("classes")).get(0);
    clazz.put("name", "automóvil");
    var attribute = ((List<Map<String,Object>>)clazz.get("attributes")).get(0);
    attribute.put("name", "año");
    create(doc, admin).andExpect(status().isCreated());
    mvc.perform(get(path()+"/"+doc.get("id")).with(actor(admin)))
        .andExpect(jsonPath("$.document.classes[0].name").value("automóvil"))
        .andExpect(jsonPath("$.document.classes[0].attributes[0].name").value("año"));
    assertThat(jdbc.queryForObject("select nombre from clase_uml where id=?", String.class, UUID.fromString((String)clazz.get("id")))).isEqualTo("automóvil");
    assertThat(jdbc.queryForObject("select nombre from atributo_uml where id=?", String.class, UUID.fromString((String)attribute.get("id")))).isEqualTo("año");
    clazz.put("name", "auto movil");
    propose(doc, UUID.randomUUID(), 0, admin).andExpect(status().isBadRequest());
  }

  ResultActions create(Map<String, Object> doc, Usuario user) throws Exception {
    return mvc.perform(
        post(path())
            .with(actor(user))
            .with(csrf())
            .contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(doc)));
  }

  ResultActions update(Map<String, Object> doc, long revision, Usuario user) throws Exception {
    return mvc.perform(
        put(path() + "/" + doc.get("id"))
            .with(actor(user))
            .with(csrf())
            .contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(Map.of("revision", revision, "document", doc))));
  }

  @Test
  void persistsGraphAndImmutableInitialSnapshot() throws Exception {
    var doc = document();
    create(doc, admin)
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.versionActual").value(1));
    mvc.perform(get(path() + "/" + doc.get("id")).with(actor(admin)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.document.classes[0].attributes[0].dataType").value("UUID"))
        .andExpect(jsonPath("$.document.classes[1].position.x").value(500));
    doc.put("name", "Ventas editadas");
    update(doc, 0, admin).andExpect(status().isOk()).andExpect(jsonPath("$.revision").value(1));
    assertThat(
            jdbc.queryForObject(
                "select count(*) from version_diagrama where diagrama_id=?",
                Integer.class,
                UUID.fromString((String) doc.get("id"))))
        .isEqualTo(2);
    assertThat(
            jdbc.queryForObject(
                "select contenido->>'name' from version_diagrama where diagrama_id=? and numero=1",
                String.class,
                UUID.fromString((String) doc.get("id"))))
        .isEqualTo("Ventas");
    assertThat(
            jdbc.queryForObject(
                "select count(*) from clase_uml where diagrama_id=?",
                Integer.class,
                UUID.fromString((String) doc.get("id"))))
        .isEqualTo(2);
  }

  @Test
  void repeatedCreateIsIdempotentButChangedPayloadConflicts() throws Exception {
    var doc = document();
    create(doc, admin).andExpect(status().isCreated());
    create(doc, admin).andExpect(status().isCreated());
    doc.put("name", "Otro");
    create(doc, admin).andExpect(status().isConflict());
    assertThat(
            jdbc.queryForObject(
                "select count(*) from diagrama where proyecto_id=?", Integer.class, project.id))
        .isEqualTo(1);
  }

  @Test
  void readerCanOpenButCannotWriteCreateOrDelete() throws Exception {
    members.saveAndFlush(new Participacion(collaborator, project, Participacion.Permiso.CONSULTA));
    var doc = document();
    create(doc, admin).andExpect(status().isCreated());
    mvc.perform(get(path()).with(actor(collaborator)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.total").value(1));
    mvc.perform(get(path() + "/" + doc.get("id")).with(actor(collaborator)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.permiso").value("CONSULTA"));
    create(document(), collaborator).andExpect(status().isForbidden());
    update(doc, 0, collaborator).andExpect(status().isForbidden());
    mvc.perform(
            delete(path() + "/" + doc.get("id"))
                .param("revision", "0")
                .with(actor(collaborator))
                .with(csrf()))
        .andExpect(status().isForbidden());
  }

  @Test
  void editorCanWriteAndRevocationAppliesImmediately() throws Exception {
    var membership =
        members.saveAndFlush(
            new Participacion(collaborator, project, Participacion.Permiso.EDICION));
    var doc = document();
    create(doc, collaborator).andExpect(status().isCreated());
    doc.put("name", "Por colaborador");
    update(doc, 0, collaborator).andExpect(status().isOk());
    members.deleteById(membership.id);
    update(doc, 1, collaborator).andExpect(status().isNotFound());
    mvc.perform(get(path() + "/" + doc.get("id")).with(actor(collaborator)))
        .andExpect(status().isNotFound());
  }

  @Test
  void crossProjectIdsAndDeletedProjectsAreRejected() throws Exception {
    var doc = document();
    create(doc, admin).andExpect(status().isCreated());
    mvc.perform(get("/api/projects/" + other.id + "/diagrams/" + doc.get("id")).with(actor(admin)))
        .andExpect(status().isNotFound());
    create(document(), collaborator).andExpect(status().isNotFound());
    project.eliminadoEn = java.time.Instant.now();
    projects.saveAndFlush(project);
    mvc.perform(get(path()).with(actor(admin))).andExpect(status().isNotFound());
    update(doc, 0, admin).andExpect(status().isNotFound());
  }

  @Test
  void staleUpdateAndDeletionDoNotOverwrite() throws Exception {
    var doc = document();
    create(doc, admin).andExpect(status().isCreated());
    doc.put("name", "Primero");
    update(doc, 0, admin).andExpect(status().isOk());
    doc.put("name", "Desactualizado");
    update(doc, 0, admin).andExpect(status().isConflict());
    mvc.perform(
            delete(path() + "/" + doc.get("id"))
                .param("revision", "0")
                .with(actor(admin))
                .with(csrf()))
        .andExpect(status().isConflict());
    mvc.perform(get(path() + "/" + doc.get("id")).with(actor(admin)))
        .andExpect(jsonPath("$.document.name").value("Primero"));
  }

  @Test
  void deletionPreservesGraphAndHistory() throws Exception {
    var doc = document();
    create(doc, admin).andExpect(status().isCreated());
    mvc.perform(
            delete(path() + "/" + doc.get("id"))
                .param("revision", "0")
                .with(actor(admin))
                .with(csrf()))
        .andExpect(status().isNoContent());
    mvc.perform(get(path() + "/" + doc.get("id")).with(actor(admin)))
        .andExpect(status().isNotFound());
    mvc.perform(get(path()).with(actor(admin))).andExpect(jsonPath("$.total").value(0));
    assertThat(
            jdbc.queryForObject(
                "select count(*) from version_diagrama where diagrama_id=?",
                Integer.class,
                UUID.fromString((String) doc.get("id"))))
        .isEqualTo(1);
  }

  @Test
  void concurrentRequestsAcceptExactlyOneRevision() throws Exception {
    var doc = document();
    create(doc, admin).andExpect(status().isCreated());
    var first = new HashMap<>(doc);
    first.put("name", "Uno");
    var second = new HashMap<>(doc);
    second.put("name", "Dos");
    try (var pool = Executors.newFixedThreadPool(2)) {
      var gate = new CountDownLatch(1);
      Callable<Integer> a =
          () -> {
            gate.await();
            return update(first, 0, admin).andReturn().getResponse().getStatus();
          };
      Callable<Integer> b =
          () -> {
            gate.await();
            return update(second, 0, admin).andReturn().getResponse().getStatus();
          };
      var x = pool.submit(a);
      var y = pool.submit(b);
      gate.countDown();
      assertThat(List.of(x.get(15, TimeUnit.SECONDS), y.get(15, TimeUnit.SECONDS)))
          .containsExactlyInAnyOrder(200, 409);
    }
  }

  @Test
  void malformedGraphRollsBackWithoutNewSnapshot() throws Exception {
    var doc = document();
    create(doc, admin).andExpect(status().isCreated());
    var broken = new HashMap<>(doc);
    broken.put("classes", List.of());
    update(broken, 0, admin).andExpect(status().isBadRequest());
    broken = new HashMap<>(doc);
    broken.put("schemaVersion", 99);
    update(broken, 0, admin).andExpect(status().isBadRequest());
    mvc.perform(get(path() + "/" + doc.get("id")).with(actor(admin)))
        .andExpect(jsonPath("$.revision").value(0))
        .andExpect(jsonPath("$.document.classes.length()").value(2));
  }

  @Test
  void cannotReuseAnElementFromAnotherDiagramAndTransactionRollsBack() throws Exception {
    var original = document();
    create(original, admin).andExpect(status().isCreated());
    var copied = new HashMap<>(original);
    copied.put("id", UUID.randomUUID().toString());
    create(copied, admin).andExpect(status().isConflict());
    assertThat(
            jdbc.queryForObject(
                "select count(*) from diagrama where proyecto_id=?", Integer.class, project.id))
        .isEqualTo(1);
  }
}
