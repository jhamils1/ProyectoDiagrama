package bo.edu.modela;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.mockito.Mockito.*;

import bo.edu.modela.auth.*;
import bo.edu.modela.ai.GeminiClient;
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
  @MockitoBean GeminiClient gemini;
  String assistantPath(Map<String, Object> doc) { return path() + "/" + doc.get("id") + "/conversation/assistant"; }
  ResultActions askAssistant(Map<String, Object> doc, UUID id, Usuario user) throws Exception {
    return mvc.perform(post(assistantPath(doc)).with(actor(user)).with(csrf()).contentType(MediaType.APPLICATION_JSON)
        .content(json.writeValueAsString(Map.of("id", id, "content", "¿Cómo se relacionan?"))));
  }
  tools.jackson.databind.JsonNode claimAssistant(Map<String, Object> doc, Usuario user) throws Exception {
    return json.readTree(mvc.perform(post(assistantPath(doc) + "/claim").with(actor(user)).with(csrf()))
        .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
        .andReturn().getResponse().getContentAsString());
  }
  ResultActions finishAssistant(Map<String, Object> doc, tools.jackson.databind.JsonNode claim, Usuario user,
      String answer, boolean failed) throws Exception {
    return mvc.perform(post(assistantPath(doc) + "/" + claim.get("id").asString() + "/complete")
        .with(actor(user)).with(csrf()).contentType(MediaType.APPLICATION_JSON)
        .content(json.writeValueAsString(Map.of("token", claim.get("token").asString(), "content", answer, "failed", failed))));
  }

  @Test
  void failedLocalQuestionCanBeExplicitlyCompletedViaInternetWithoutDuplicatingQuestion() throws Exception {
    when(gemini.configured()).thenReturn(true);
    when(gemini.generate(anyList())).thenReturn("Considera una fecha si el requisito lo necesita.");
    members.saveAndFlush(new Participacion(collaborator, project, Participacion.Permiso.CONSULTA));
    var doc = document(); create(doc, admin).andExpect(status().isCreated());
    UUID id = UUID.randomUUID();
    askAssistant(doc, id, collaborator).andExpect(status().isAccepted());
    var claim = claimAssistant(doc, admin);
    finishAssistant(doc, claim, admin, "", true).andExpect(jsonPath("$.status").value("FALLIDA"));
    mvc.perform(post(assistantPath(doc) + "/" + id + "/switch-internet").with(actor(admin)).with(csrf())).andExpect(status().isForbidden());
    verify(gemini, never()).generate(anyList());
    mvc.perform(post(assistantPath(doc) + "/" + id + "/switch-internet").with(actor(collaborator)).with(csrf()))
        .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("COMPLETADA"));
    for (var user : List.of(admin, collaborator))
      mvc.perform(get(path()+"/"+doc.get("id")+"/conversation").with(actor(user)))
          .andExpect(jsonPath("$.items.length()").value(2))
          .andExpect(jsonPath("$.items[1].authorName").value("Gemini · IA por internet"));
    verify(gemini, times(1)).generate(anyList());
  }

  @Test
  void internetModeUsesServerProviderOnceAndSharesTheResponse() throws Exception {
    when(gemini.configured()).thenReturn(true);
    when(gemini.generate(anyList())).thenReturn("Podrías añadir un atributo nombre según los requisitos.");
    members.saveAndFlush(new Participacion(collaborator, project, Participacion.Permiso.CONSULTA));
    var doc = document(); create(doc, admin).andExpect(status().isCreated());
    UUID id = UUID.randomUUID();
    mvc.perform(post(assistantPath(doc)).with(actor(collaborator)).with(csrf()).contentType(MediaType.APPLICATION_JSON)
        .content(json.writeValueAsString(Map.of("id", id, "content", "¿Cómo mejorarías este diseño?", "mode", "INTERNET"))))
        .andExpect(status().isAccepted()).andExpect(jsonPath("$.mode").value("INTERNET"));
    mvc.perform(post(assistantPath(doc) + "/claim").with(actor(admin)).with(csrf())).andExpect(status().isNoContent());
    mvc.perform(post(assistantPath(doc) + "/" + id + "/internet").with(actor(admin)).with(csrf())).andExpect(status().isForbidden());
    mvc.perform(post(assistantPath(doc) + "/" + id + "/internet").with(actor(collaborator)).with(csrf()))
        .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("COMPLETADA"));
    mvc.perform(post(assistantPath(doc) + "/" + id + "/internet").with(actor(collaborator)).with(csrf())).andExpect(status().isNoContent());
    verify(gemini, times(1)).generate(argThat(messages -> messages.get(0).content().contains("Eres el asistente UML")
        && !messages.get(0).content().contains("/no_think") && messages.get(1).content().contains("Pedido")));
    for (var user : List.of(admin, collaborator))
      mvc.perform(get(path()+"/"+doc.get("id")+"/conversation").with(actor(user)))
          .andExpect(jsonPath("$.items[1].authorName").value("Gemini · IA por internet"))
          .andExpect(jsonPath("$.items[1].content", org.hamcrest.Matchers.containsString("atributo nombre")));
    mvc.perform(get(path()+"/"+doc.get("id")+"/state").with(actor(admin))).andExpect(jsonPath("$.revision").value(0));
  }

  @Test
  void internetModeFailsSafelyIfNotConfigured() throws Exception {
    var doc = document(); create(doc, admin).andExpect(status().isCreated());
    mvc.perform(post(assistantPath(doc)).with(actor(admin)).with(csrf()).contentType(MediaType.APPLICATION_JSON)
        .content(json.writeValueAsString(Map.of("id", UUID.randomUUID(), "content", "Explícame el modelo", "mode", "INTERNET"))))
        .andExpect(status().isServiceUnavailable());
    verify(gemini, never()).generate(anyList());
  }

  @Test
  void pendingQuestionCanBeCancelledByRequesterOrAdministratorWithoutChangingMode() throws Exception {
    members.saveAndFlush(new Participacion(collaborator, project, Participacion.Permiso.CONSULTA));
    var doc = document(); create(doc, admin).andExpect(status().isCreated());
    UUID id = UUID.randomUUID();
    askAssistant(doc, id, admin).andExpect(jsonPath("$.status").value("PENDIENTE"));
    mvc.perform(post(assistantPath(doc) + "/" + id + "/cancel").with(actor(collaborator)).with(csrf()))
        .andExpect(status().isForbidden());
    var claim = claimAssistant(doc, collaborator);
    mvc.perform(post(assistantPath(doc) + "/" + id + "/cancel").with(actor(admin)).with(csrf()))
        .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("FALLIDA"))
        .andExpect(jsonPath("$.mode").value("LOCAL"));
    finishAssistant(doc, claim, collaborator, "Respuesta tardía", false).andExpect(status().isConflict());
    askAssistant(doc, UUID.randomUUID(), collaborator).andExpect(jsonPath("$.status").value("PENDIENTE"));
    verify(gemini, never()).generate(anyList());
  }

  @Test
  void requesterCanCancelPendingInternetQuestionWithoutCallingGemini() throws Exception {
    when(gemini.configured()).thenReturn(true);
    members.saveAndFlush(new Participacion(collaborator, project, Participacion.Permiso.CONSULTA));
    var doc = document(); create(doc, admin).andExpect(status().isCreated());
    UUID id = UUID.randomUUID();
    mvc.perform(post(assistantPath(doc)).with(actor(collaborator)).with(csrf()).contentType(MediaType.APPLICATION_JSON)
        .content(json.writeValueAsString(Map.of("id", id, "content", "Explica este diseño", "mode", "INTERNET"))))
        .andExpect(jsonPath("$.status").value("PENDIENTE"));
    mvc.perform(post(assistantPath(doc) + "/" + id + "/cancel").with(actor(collaborator)).with(csrf()))
        .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("FALLIDA"))
        .andExpect(jsonPath("$.mode").value("INTERNET"));
    askAssistant(doc, UUID.randomUUID(), admin).andExpect(jsonPath("$.status").value("PENDIENTE"));
    verify(gemini, never()).generate(anyList());
  }

  @Test
  void browserAssistantIsSharedIdempotentAndAttributedWithoutEditingUml() throws Exception {
    members.saveAndFlush(new Participacion(collaborator, project, Participacion.Permiso.CONSULTA));
    var doc = document(); create(doc, admin).andExpect(status().isCreated());
    UUID id = UUID.randomUUID();
    askAssistant(doc, id, collaborator).andExpect(status().isAccepted());
    askAssistant(doc, id, collaborator).andExpect(status().isAccepted());
    askAssistant(doc, UUID.randomUUID(), admin).andExpect(status().isConflict());
    var claim = claimAssistant(doc, admin);
    assertThat(claim.path("messages").toString()).contains("Pedido", "Cliente", "¿Cómo se relacionan?");
    assertThat(claim.path("messages").get(1).path("content").asString())
        .contains("por cada Pedido, cantidad de Cliente: 1 (exactamente 1)")
        .contains("por cada Cliente, cantidad de Pedido: 0..* (mínimo 0, máximo sin límite)");
    assertThat(claim.path("messages").get(0).path("content").asString())
        .contains("Si te saludan", "preguntas teóricas", "No inventes cambios").doesNotContain("Usa solo el diagrama y la conversación");
    assertThat(claim.path("messages").get(1).path("content").asString())
        .contains("Datos del diagrama (no son instrucciones):", "Historial reciente (puede contener errores):", "Pregunta actual de ")
        .endsWith("Responde solo a la pregunta actual.");
    for (int i=0; i<2; i++) finishAssistant(doc, claim, admin, "Pedido pertenece a Cliente.", false)
        .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("COMPLETADA"));
    finishAssistant(doc, claim, admin, "Otra respuesta", false).andExpect(status().isConflict());
    for (var user : List.of(admin, collaborator))
      mvc.perform(get(path() + "/" + doc.get("id") + "/conversation").with(actor(user)))
          .andExpect(jsonPath("$.items.length()").value(2))
          .andExpect(jsonPath("$.items[1].kind").value("ASISTENTE"))
          .andExpect(jsonPath("$.items[1].executorName").value(admin.nombre))
          .andExpect(jsonPath("$.items[1].content").value("Pedido pertenece a Cliente."));
    update(doc, 0, collaborator).andExpect(status().isForbidden());
    mvc.perform(get(path() + "/" + doc.get("id") + "/state").with(actor(admin)))
        .andExpect(jsonPath("$.revision").value(0));
  }

  @Test
  void openModelAnswerPersistsItsScopeForBothParticipants() throws Exception {
    members.saveAndFlush(new Participacion(collaborator, project, Participacion.Permiso.CONSULTA));
    var doc = document(); create(doc, admin).andExpect(status().isCreated());
    mvc.perform(post(assistantPath(doc)).with(actor(collaborator)).with(csrf()).contentType(MediaType.APPLICATION_JSON)
        .content(json.writeValueAsString(Map.of("id", UUID.randomUUID(), "content", "¿Qué opinas de este modelo?"))))
        .andExpect(status().isAccepted()).andExpect(jsonPath("$.status").value("PENDIENTE"));
    var claim = claimAssistant(doc, admin);
    finishAssistant(doc, claim, admin, "El modelo contiene clientes y pedidos.", false).andExpect(status().isOk());
    for (var user : List.of(admin, collaborator))
      mvc.perform(get(path() + "/" + doc.get("id") + "/conversation").with(actor(user)))
          .andExpect(status().isOk()).andExpect(jsonPath("$.items[1].answerScope").value("DIAGRAMA"))
          .andExpect(jsonPath("$.items[1].diagramRevision").value(0));
  }

  @Test
  void sharedConversationContextKeepsRecentAuthorsAndMarksEarlierMessagesOmitted() throws Exception {
    members.saveAndFlush(new Participacion(collaborator, project, Participacion.Permiso.CONSULTA));
    var doc = document(); create(doc, admin).andExpect(status().isCreated());
    for (int i = 0; i < 10; i++)
      message(doc, UUID.randomUUID(), "Comentario " + i, i % 2 == 0 ? admin : collaborator)
          .andExpect(status().isCreated());
    UUID question = UUID.randomUUID();
    mvc.perform(post(assistantPath(doc)).with(actor(collaborator)).with(csrf()).contentType(MediaType.APPLICATION_JSON)
        .content(json.writeValueAsString(Map.of("id", question, "content", "¿Puedes explicar este diseño?"))))
        .andExpect(status().isAccepted()).andExpect(jsonPath("$.status").value("PENDIENTE"));
    var claim = claimAssistant(doc, admin);
    String context = claim.path("messages").get(1).path("content").asString();
    assertThat(context).contains("[Hay mensajes anteriores omitidos.]", "Comentario 2", "Comentario 9",
        admin.nombre, collaborator.nombre, "Pregunta actual de " + collaborator.nombre)
        .doesNotContain("Comentario 0", "Comentario 1\n");
    assertThat(context.indexOf("Comentario 2")).isLessThan(context.indexOf("Comentario 9"));
    finishAssistant(doc, claim, admin, "El diseño tiene Cliente y Pedido.", false).andExpect(status().isOk());
    for (var user : List.of(admin, collaborator))
      mvc.perform(get(path() + "/" + doc.get("id") + "/conversation").with(actor(user)))
          .andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(12))
          .andExpect(jsonPath("$.items[11].content").value("El diseño tiene Cliente y Pedido."));
  }

  @Test
  void classConceptAndObviousNonAnswersAreSharedWithoutChangingTheDiagram() throws Exception {
    members.saveAndFlush(new Participacion(collaborator, project, Participacion.Permiso.CONSULTA));
    var doc = document(); create(doc, admin).andExpect(status().isCreated());
    mvc.perform(post(assistantPath(doc)).with(actor(admin)).with(csrf()).contentType(MediaType.APPLICATION_JSON)
        .content(json.writeValueAsString(Map.of("id", UUID.randomUUID(), "content", "que es una clase?"))))
        .andExpect(status().isAccepted()).andExpect(jsonPath("$.status").value("COMPLETADA"));
    UUID id = UUID.randomUUID();
    askAssistant(doc, id, collaborator).andExpect(status().isAccepted());
    var claim = claimAssistant(doc, admin);
    for (int i = 0; i < 2; i++) finishAssistant(doc, claim, admin, "Hola.", false)
        .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("COMPLETADA"));
    for (var user : List.of(admin, collaborator))
      mvc.perform(get(path() + "/" + doc.get("id") + "/conversation").with(actor(user)))
          .andExpect(jsonPath("$.items.length()").value(4))
          .andExpect(jsonPath("$.items[1].authorName").value("Asistente · conceptos UML"))
          .andExpect(jsonPath("$.items[1].content", org.hamcrest.Matchers.containsString("objetos")))
          .andExpect(jsonPath("$.items[3].authorName").value("Asistente · respuesta no disponible"))
          .andExpect(jsonPath("$.items[3].content", org.hamcrest.Matchers.containsString("Actualmente no tengo una respuesta adecuada")));
    mvc.perform(get(path() + "/" + doc.get("id") + "/state").with(actor(admin)))
        .andExpect(jsonPath("$.revision").value(0));
  }

  @Test
  void preciseMultiplicityQuestionIsAnsweredOnceFromTheSavedDiagram() throws Exception {
    var doc = document(); create(doc, admin).andExpect(status().isCreated());
    UUID id = UUID.randomUUID();
    for (int i=0; i<2; i++)
      mvc.perform(post(assistantPath(doc)).with(actor(admin)).with(csrf()).contentType(MediaType.APPLICATION_JSON)
          .content(json.writeValueAsString(Map.of("id", id, "content", "¿Cuántos pedidos puede tener un cliente?"))))
          .andExpect(status().isAccepted()).andExpect(jsonPath("$.status").value("COMPLETADA"));
    mvc.perform(get(path()+"/"+doc.get("id")+"/conversation").with(actor(admin)))
        .andExpect(jsonPath("$.items.length()").value(2))
        .andExpect(jsonPath("$.items[1].authorName").value("Asistente · datos del diagrama"))
        .andExpect(jsonPath("$.items[1].content", org.hamcrest.Matchers.containsString("0..* (mínimo 0, máximo sin límite)")));
    mvc.perform(post(assistantPath(doc)+"/claim").with(actor(admin)).with(csrf())).andExpect(status().isNoContent());
    mvc.perform(get(path()+"/"+doc.get("id")+"/state").with(actor(admin))).andExpect(jsonPath("$.revision").value(0));
  }

  @Test
  void exactCreateClassRequestGetsAccurateGuidanceWithoutRunningQwen() throws Exception {
    members.saveAndFlush(new Participacion(collaborator, project, Participacion.Permiso.CONSULTA));
    var doc = document(); create(doc, admin).andExpect(status().isCreated());
    for (var user : List.of(admin, collaborator))
      mvc.perform(post(assistantPath(doc)).with(actor(user)).with(csrf()).contentType(MediaType.APPLICATION_JSON)
          .content(json.writeValueAsString(Map.of("id", UUID.randomUUID(), "content", "crea la clase factura"))))
          .andExpect(status().isAccepted()).andExpect(jsonPath("$.status").value("COMPLETADA"));
    mvc.perform(get(path()+"/"+doc.get("id")+"/conversation").with(actor(admin)))
        .andExpect(jsonPath("$.items.length()").value(4))
        .andExpect(jsonPath("$.items[1].authorName").value("Asistente · guía de edición"))
        .andExpect(jsonPath("$.items[1].content", org.hamcrest.Matchers.containsString("No se ha creado ninguna clase")))
        .andExpect(jsonPath("$.items[3].content", org.hamcrest.Matchers.containsString("necesitas permiso de edición")));
    mvc.perform(post(assistantPath(doc)+"/claim").with(actor(admin)).with(csrf())).andExpect(status().isNoContent());
    mvc.perform(get(path()+"/"+doc.get("id")+"/state").with(actor(admin))).andExpect(jsonPath("$.revision").value(0));
    mvc.perform(post(assistantPath(doc)).with(actor(admin)).with(csrf()).contentType(MediaType.APPLICATION_JSON)
        .content(json.writeValueAsString(Map.of("id", UUID.randomUUID(), "content", "crea la clase factura y explica sus atributos"))))
        .andExpect(status().isAccepted()).andExpect(jsonPath("$.status").value("PENDIENTE"));
  }

  @Test
  void commonDiagramAndConceptQuestionsAreSharedAndAttributedToTheirSources() throws Exception {
    members.saveAndFlush(new Participacion(collaborator, project, Participacion.Permiso.CONSULTA));
    var doc = document(); create(doc, admin).andExpect(status().isCreated());
    for (String text : List.of("¿Qué clases hay en el diagrama?", "¿Qué es un atributo derivado en UML?"))
      mvc.perform(post(assistantPath(doc)).with(actor(admin)).with(csrf()).contentType(MediaType.APPLICATION_JSON)
          .content(json.writeValueAsString(Map.of("id", UUID.randomUUID(), "content", text))))
          .andExpect(status().isAccepted()).andExpect(jsonPath("$.status").value("COMPLETADA"));
    mvc.perform(get(path()+"/"+doc.get("id")+"/conversation").with(actor(collaborator)))
        .andExpect(jsonPath("$.items.length()").value(4))
        .andExpect(jsonPath("$.items[1].authorName").value("Asistente · datos del diagrama"))
        .andExpect(jsonPath("$.items[1].content", org.hamcrest.Matchers.containsString("Pedido, Cliente")))
        .andExpect(jsonPath("$.items[3].authorName").value("Asistente · conceptos UML"))
        .andExpect(jsonPath("$.items[3].content", org.hamcrest.Matchers.containsString("no determina por sí solo si se almacena")));
    mvc.perform(get(path()+"/"+doc.get("id")+"/state").with(actor(admin))).andExpect(jsonPath("$.revision").value(0));
  }

  @Test @SuppressWarnings("unchecked")
  void largeDiagramsStillAnswerRecordedFactsWithoutStartingQwen() throws Exception {
    var doc = copy(document());
    var classes = (List<Map<String, Object>>) doc.get("classes");
    var attributes = (List<Map<String, Object>>) classes.get(0).get("attributes");
    for (int i = 0; i < 90; i++) attributes.add(Map.of(
        "id", UUID.randomUUID().toString(), "name", "atributo_largo_para_el_diagrama_de_prueba_numero_" + i,
        "dataType", "String", "visibility", "private", "identifier", false, "required", false));
    create(doc, admin).andExpect(status().isCreated());
    for (String question : List.of("¿Qué clases hay en el diagrama?", "¿Qué atributos tiene Pedido?",
        "¿Qué es un atributo derivado en UML?", "Actividad"))
      mvc.perform(post(assistantPath(doc)).with(actor(admin)).with(csrf()).contentType(MediaType.APPLICATION_JSON)
          .content(json.writeValueAsString(Map.of("id", UUID.randomUUID(), "content", question))))
          .andExpect(status().isAccepted()).andExpect(jsonPath("$.status").value("COMPLETADA"));
    var result = json.readTree(mvc.perform(get(path()+"/"+doc.get("id")+"/conversation").with(actor(admin)))
        .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    assertThat(result.path("items").get(1).path("content").asString()).contains("Pedido", "Cliente");
    assertThat(result.path("items").get(3).path("content").asString()).contains("Respuesta parcial");
    assertThat(result.path("items").get(3).path("content").asString().codePointCount(0,
        result.path("items").get(3).path("content").asString().length())).isLessThanOrEqualTo(4000);
    assertThat(result.path("items").get(5).path("authorName").asString()).contains("conceptos UML");
    assertThat(result.path("items").get(7).path("authorName").asString()).contains("actividad registrada");
    mvc.perform(post(assistantPath(doc)).with(actor(admin)).with(csrf()).contentType(MediaType.APPLICATION_JSON)
        .content(json.writeValueAsString(Map.of("id", UUID.randomUUID(), "content", "Dame ideas para mejorar este modelo"))))
        .andExpect(status().isBadRequest());
    mvc.perform(get(path()+"/"+doc.get("id")+"/conversation").with(actor(admin)))
        .andExpect(jsonPath("$.items.length()").value(8));
    mvc.perform(post(assistantPath(doc)+"/claim").with(actor(admin)).with(csrf())).andExpect(status().isNoContent());
    mvc.perform(get(path()+"/"+doc.get("id")+"/state").with(actor(admin)))
        .andExpect(jsonPath("$.revision").value(0));
  }

  @Test
  @SuppressWarnings("unchecked")
  void namedRelationResolvesAnAmbiguousQuestionForBothParticipants() throws Exception {
    members.saveAndFlush(new Participacion(collaborator, project, Participacion.Permiso.CONSULTA));
    var doc = document();
    var original = ((List<Map<String,Object>>)doc.get("relations")).getFirst();
    var second = new HashMap<String,Object>(original);
    second.put("id", UUID.randomUUID().toString()); second.put("name", "devolución");
    second.put("sourceMultiplicity", "1..*");
    doc.put("relations", List.of(original, second));
    create(doc, admin).andExpect(status().isCreated());
    for (String question : List.of("¿Cuál es la multiplicidad entre Pedido y Cliente?", "la relacion devolucion"))
      mvc.perform(post(assistantPath(doc)).with(actor(collaborator)).with(csrf()).contentType(MediaType.APPLICATION_JSON)
          .content(json.writeValueAsString(Map.of("id", UUID.randomUUID(), "content", question))))
          .andExpect(status().isAccepted()).andExpect(jsonPath("$.status").value("COMPLETADA"));
    for (var user : List.of(admin, collaborator))
      mvc.perform(get(path()+"/"+doc.get("id")+"/conversation").with(actor(user)))
          .andExpect(jsonPath("$.items.length()").value(4))
          .andExpect(jsonPath("$.items[1].content", org.hamcrest.Matchers.containsString("varias asociaciones")))
          .andExpect(jsonPath("$.items[3].content", org.hamcrest.Matchers.containsString("1..* (mínimo 1, máximo sin límite)")));
    mvc.perform(get(path()+"/"+doc.get("id")+"/state").with(actor(admin))).andExpect(jsonPath("$.revision").value(0));
  }

  @Test
  void assistantReceivesOnlyRecordedActivityAtTheRequestedRevision() throws Exception {
    members.saveAndFlush(new Participacion(collaborator, project, Participacion.Permiso.EDICION));
    var doc = document(); create(doc, admin).andExpect(status().isCreated());
    doc.put("name", "Ventas revisadas");
    update(doc, 0, collaborator).andExpect(status().isOk());
    UUID id = UUID.randomUUID();
    mvc.perform(post(assistantPath(doc)).with(actor(admin)).with(csrf()).contentType(MediaType.APPLICATION_JSON)
        .content(json.writeValueAsString(Map.of("id", id, "content", "Resume el trabajo más reciente"))))
        .andExpect(status().isAccepted()).andExpect(jsonPath("$.status").value("PENDIENTE"));
    doc.put("name", "Edicion posterior");
    update(doc, 1, admin).andExpect(status().isOk());
    var claim = claimAssistant(doc, collaborator);
    String prompt = claim.path("messages").get(1).path("content").asString();
    assertThat(claim.path("revision").asLong()).isEqualTo(1);
    assertThat(prompt).contains("Actividad confirmada reciente", "Versión 2", collaborator.nombre,
        "cambió nombre de diagrama", "Ventas revisadas").doesNotContain("Edicion posterior");
    finishAssistant(doc, claim, collaborator, "Hubo un cambio en el nombre.", false).andExpect(status().isOk());
    mvc.perform(get(path()+"/"+doc.get("id")+"/state").with(actor(admin)))
        .andExpect(jsonPath("$.revision").value(2));
  }

  @Test
  void assistantClarifiesCapabilitiesAndRejectsAnUnrelatedQuestionFromTheModel() throws Exception {
    members.saveAndFlush(new Participacion(collaborator, project, Participacion.Permiso.CONSULTA));
    var doc = document(); create(doc, admin).andExpect(status().isCreated());
    for (String question : List.of("que puedes realizar?", "que atributos coloco"))
      mvc.perform(post(assistantPath(doc)).with(actor(collaborator)).with(csrf()).contentType(MediaType.APPLICATION_JSON)
          .content(json.writeValueAsString(Map.of("id", UUID.randomUUID(), "content", question))))
          .andExpect(status().isAccepted()).andExpect(jsonPath("$.status").value("COMPLETADA"));
    askAssistant(doc, UUID.randomUUID(), collaborator).andExpect(status().isAccepted());
    var claim = claimAssistant(doc, admin);
    finishAssistant(doc, claim, admin, "¿Qué cambios se realizaron en la clase lámpara?", false).andExpect(status().isOk());
    for (var user : List.of(admin, collaborator))
      mvc.perform(get(path()+"/"+doc.get("id")+"/conversation").with(actor(user)))
          .andExpect(jsonPath("$.items[1].content", org.hamcrest.Matchers.containsString("consultar el diagrama")))
          .andExpect(jsonPath("$.items[3].content", org.hamcrest.Matchers.containsString("¿Para qué clase")))
          .andExpect(jsonPath("$.items[5].authorName").value("Asistente · respuesta no disponible"))
          .andExpect(jsonPath("$.items[5].content", org.hamcrest.Matchers.containsString("Actualmente no tengo una respuesta adecuada")));
  }

  @Test
  void sharedDiagramReviewSuggestsStepsWithoutChangingTheDiagram() throws Exception {
    members.saveAndFlush(new Participacion(collaborator, project, Participacion.Permiso.CONSULTA));
    var doc = document();
    var classes = new ArrayList<>((List<Map<String, Object>>) doc.get("classes"));
    classes.add(Map.of("id", UUID.randomUUID().toString(), "name", "Factura", "abstract", false,
        "position", Map.of("x", 25, "y", 25), "attributes", List.of(), "methods", List.of(Map.of(
            "id", UUID.randomUUID().toString(), "name", "calcular", "returnType", "", "visibility", "public"))));
    doc.put("classes", classes);
    create(doc, admin).andExpect(status().isCreated());
    mvc.perform(post(assistantPath(doc)).with(actor(collaborator)).with(csrf()).contentType(MediaType.APPLICATION_JSON)
        .content(json.writeValueAsString(Map.of("id", UUID.randomUUID(), "content", "¿Cómo puedo resolver los problemas de la clase Factura?"))))
        .andExpect(status().isAccepted()).andExpect(jsonPath("$.status").value("COMPLETADA"));
    for (var user : List.of(admin, collaborator))
      mvc.perform(get(path()+"/"+doc.get("id")+"/conversation").with(actor(user)))
          .andExpect(status().isOk()).andExpect(jsonPath("$.items[1].answerScope").value("DIAGRAMA"))
          .andExpect(jsonPath("$.items[1].content", org.hamcrest.Matchers.containsString("calcular() no tiene retorno")))
          .andExpect(jsonPath("$.items[1].content", org.hamcrest.Matchers.containsString("usa void")))
          .andExpect(jsonPath("$.items[1].content", org.hamcrest.Matchers.containsString("no modifica el diagrama")));
    mvc.perform(get(path()+"/"+doc.get("id")+"/state").with(actor(admin))).andExpect(jsonPath("$.revision").value(0));
  }

  @Test
  void participantReviewIsSharedAndUsesOnlyRecordedChanges() throws Exception {
    members.saveAndFlush(new Participacion(collaborator, project, Participacion.Permiso.EDICION));
    var doc = document(); create(doc, admin).andExpect(status().isCreated());
    var classes = new ArrayList<>((List<Map<String, Object>>) doc.get("classes"));
    classes.add(Map.of("id", UUID.randomUUID().toString(), "name", "Factura", "abstract", false,
        "position", Map.of("x", 25, "y", 25), "attributes", List.of(), "methods", List.of()));
    doc.put("classes", classes);
    update(doc, 0, collaborator).andExpect(status().isOk());
    mvc.perform(post(assistantPath(doc)).with(actor(admin)).with(csrf()).contentType(MediaType.APPLICATION_JSON)
        .content(json.writeValueAsString(Map.of("id", UUID.randomUUID(), "content", "Revisa el trabajo de " + collaborator.nombre))))
        .andExpect(status().isAccepted()).andExpect(jsonPath("$.status").value("COMPLETADA"));
    for (var user : List.of(admin, collaborator)) {
      String answer = json.readTree(mvc.perform(get(path()+"/"+doc.get("id")+"/conversation").with(actor(user)))
          .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).path("items").get(1).path("content").asString();
      assertThat(answer).contains(collaborator.nombre, "Factura", "no tiene atributos ni métodos", "otras personas pudieron modificar")
          .doesNotContain("clase Cliente no tiene");
    }
    mvc.perform(get(path()+"/"+doc.get("id")+"/state").with(actor(admin))).andExpect(jsonPath("$.revision").value(1));
  }

  @Test
  void activityQuestionsShowRecordedAuthorsWithoutGuessingHistoricalAuthors() throws Exception {
    members.saveAndFlush(new Participacion(collaborator, project, Participacion.Permiso.EDICION));
    var doc = document(); create(doc, admin).andExpect(status().isCreated());
    UUID diagram = UUID.fromString(doc.get("id").toString());
    jdbc.update("update version_diagrama set autor_id=null, autor_nombre=null where diagrama_id=?", diagram);
    doc.put("name", "Cambio del compañero");
    update(doc, 0, collaborator).andExpect(status().isOk());
    for (String question : List.of("¿Qué hizo Carlos?", "¿Quién creó el diagrama?"))
      mvc.perform(post(assistantPath(doc)).with(actor(admin)).with(csrf()).contentType(MediaType.APPLICATION_JSON)
          .content(json.writeValueAsString(Map.of("id", UUID.randomUUID(), "content", question))))
          .andExpect(status().isAccepted()).andExpect(jsonPath("$.status").value("COMPLETADA"));
    for (var user : List.of(admin, collaborator))
      mvc.perform(get(path()+"/"+diagram+"/conversation").with(actor(user)))
          .andExpect(jsonPath("$.items.length()").value(4))
          .andExpect(jsonPath("$.items[1].authorName").value("Asistente · actividad registrada"))
          .andExpect(jsonPath("$.items[1].content", org.hamcrest.Matchers.containsString("No encontré cambios atribuidos")))
          .andExpect(jsonPath("$.items[1].content", org.hamcrest.Matchers.containsString("autores no registrados")))
          .andExpect(jsonPath("$.items[3].content", org.hamcrest.Matchers.containsString("autor no registrado")));
    mvc.perform(get(path()+"/"+diagram+"/state").with(actor(admin))).andExpect(jsonPath("$.revision").value(1));
  }

  @Test
  void activityQuestionSearchesBeyondTheLastThreeVersionsAndFiltersTheAuthor() throws Exception {
    members.saveAndFlush(new Participacion(collaborator, project, Participacion.Permiso.EDICION));
    var doc = document(); create(doc, admin).andExpect(status().isCreated());
    doc.put("name", "Cambio del integrante");
    update(doc, 0, collaborator).andExpect(status().isOk());
    for (int i=1; i<=4; i++) {
      doc.put("name", "Cambio de administracion " + i);
      update(doc, i, admin).andExpect(status().isOk());
    }
    String question = "¿Qué hizo " + collaborator.nombre + "?";
    mvc.perform(post(assistantPath(doc)).with(actor(admin)).with(csrf()).contentType(MediaType.APPLICATION_JSON)
        .content(json.writeValueAsString(Map.of("id", UUID.randomUUID(), "content", question))))
        .andExpect(status().isAccepted()).andExpect(jsonPath("$.status").value("COMPLETADA"));
    String content = json.readTree(mvc.perform(get(path()+"/"+doc.get("id")+"/conversation").with(actor(collaborator)))
        .andExpect(status().isOk()).andReturn().getResponse().getContentAsString())
        .path("items").get(1).path("content").asString();
    assertThat(content).contains("Versión 2", collaborator.nombre, "Cambio del integrante", "hasta 20 versiones")
        .doesNotContain("Versión 6", "Cambio de administracion 4");
    mvc.perform(get(path()+"/"+doc.get("id")+"/state").with(actor(admin))).andExpect(jsonPath("$.revision").value(5));
  }

  @Test
  void assistantPaginatesOlderActivityWithoutSkippingVersionsOrChangingTheDiagram() throws Exception {
    var doc = document(); create(doc, admin).andExpect(status().isCreated());
    for (int i = 1; i <= 24; i++) {
      doc.put("name", "Cambio número " + i + " " + "L".repeat(55));
      update(doc, i - 1, admin).andExpect(status().isOk());
    }
    String question = "Actividad";
    var versions = new ArrayList<Long>();
    var versionPattern = java.util.regex.Pattern.compile("Versión (\\d+); fecha");
    for (int page = 0; page < 30; page++) {
      mvc.perform(post(assistantPath(doc)).with(actor(admin)).with(csrf()).contentType(MediaType.APPLICATION_JSON)
          .content(json.writeValueAsString(Map.of("id", UUID.randomUUID(), "content", question))))
          .andExpect(status().isAccepted()).andExpect(jsonPath("$.status").value("COMPLETADA"));
      var response = json.readTree(mvc.perform(get(path()+"/"+doc.get("id")+"/conversation?size=50").with(actor(admin)))
          .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
      var answer = response.path("items").get(response.path("items").size() - 1);
      String content = answer.path("content").asString();
      var matcher = versionPattern.matcher(content);
      while (matcher.find()) versions.add(Long.parseLong(matcher.group(1)));
      var continuation = answer.path("continuationQuestion");
      if (continuation.isNull() || continuation.isMissingNode()) break;
      question = continuation.asString();
      assertThat(content).contains(question);
    }
    assertThat(versions).containsExactlyElementsOf(java.util.stream.LongStream.iterate(25, v -> v - 1)
        .limit(25).boxed().toList());
    mvc.perform(get(path()+"/"+doc.get("id")+"/state").with(actor(admin))).andExpect(jsonPath("$.revision").value(24));
    mvc.perform(post(assistantPath(doc)).with(actor(admin)).with(csrf()).contentType(MediaType.APPLICATION_JSON)
        .content(json.writeValueAsString(Map.of("id", UUID.randomUUID(), "content", "Actividad antes de la versión 0"))))
        .andExpect(status().isBadRequest());
  }

  @Test
  void assistantCanContinueSearchingForAnAuthorBeyondTheFirstTwentyVersions() throws Exception {
    members.saveAndFlush(new Participacion(collaborator, project, Participacion.Permiso.EDICION));
    var doc = document(); create(doc, admin).andExpect(status().isCreated());
    doc.put("name", "Cambio antiguo de integrante"); update(doc, 0, collaborator).andExpect(status().isOk());
    for (int i=1; i<=23; i++) { doc.put("name", "Cambio reciente " + i); update(doc, i, admin).andExpect(status().isOk()); }
    String base = "Qué hizo " + collaborator.nombre;
    for (String question : List.of(base, base + " antes de la versión 6"))
      mvc.perform(post(assistantPath(doc)).with(actor(admin)).with(csrf()).contentType(MediaType.APPLICATION_JSON)
          .content(json.writeValueAsString(Map.of("id", UUID.randomUUID(), "content", question))))
          .andExpect(status().isAccepted()).andExpect(jsonPath("$.status").value("COMPLETADA"));
    var response = json.readTree(mvc.perform(get(path()+"/"+doc.get("id")+"/conversation").with(actor(collaborator)))
        .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    assertThat(response.path("items").get(1).path("content").asString())
        .contains("No encontré cambios atribuidos", "antes de la versión 6");
    assertThat(response.path("items").get(3).path("content").asString())
        .contains("Versión 2", "Cambio antiguo de integrante", collaborator.nombre)
        .doesNotContain("Cambio reciente 23");
  }

  @Test
  void twoParticipantsRecoverSharedQuestionsChangesAndAnAbandonedExecution() throws Exception {
    members.saveAndFlush(new Participacion(collaborator, project, Participacion.Permiso.EDICION));
    var doc = copy(document());
    create(doc, admin).andExpect(status().isCreated());
    doc.put("name", "Ventas actualizado por colaborador");
    update(doc, 0, collaborator).andExpect(status().isOk());
    for (String question : List.of("¿Cuáles son las clases?", "¿Puedes revisar mi diagrama?"))
      mvc.perform(post(assistantPath(doc)).with(actor(admin)).with(csrf()).contentType(MediaType.APPLICATION_JSON)
          .content(json.writeValueAsString(Map.of("id", UUID.randomUUID(), "content", question))))
          .andExpect(status().isAccepted()).andExpect(jsonPath("$.status").value("COMPLETADA"));
    UUID questionId = UUID.randomUUID();
    askAssistant(doc, questionId, collaborator).andExpect(status().isAccepted());
    var first = claimAssistant(doc, admin);
    // An abrupt disconnect cannot release its lease: expiration permits another participant to take over.
    jdbc.update("update solicitud_ia_diagrama set vencimiento=now()-interval '1 minute' where id=?", questionId);
    mvc.perform(get(path() + "/" + doc.get("id") + "/conversation").with(actor(collaborator)))
        .andExpect(jsonPath("$.assistant.status").value("PENDIENTE"));
    var second = claimAssistant(doc, collaborator);
    finishAssistant(doc, first, admin, "Resultado antiguo", false).andExpect(status().isConflict());
    finishAssistant(doc, second, collaborator, "Pedido se relaciona con Cliente.", false).andExpect(status().isOk());
    for (var user : List.of(admin, collaborator)) {
      mvc.perform(get(path() + "/" + doc.get("id")).with(actor(user)))
          .andExpect(jsonPath("$.document.name").value("Ventas actualizado por colaborador"))
          .andExpect(jsonPath("$.revision").value(1));
      mvc.perform(get(path() + "/" + doc.get("id") + "/conversation").with(actor(user)))
          .andExpect(jsonPath("$.items.length()").value(6))
          .andExpect(jsonPath("$.items[1].content", org.hamcrest.Matchers.containsString("Pedido, Cliente")))
          .andExpect(jsonPath("$.items[3].content", org.hamcrest.Matchers.containsString("Revisión básica")))
          .andExpect(jsonPath("$.items[5].content").value("Pedido se relaciona con Cliente."));
    }
  }

  @Test
  void onlyOneBrowserClaimsAndStaleOrForeignExecutionsCannotPublish() throws Exception {
    members.saveAndFlush(new Participacion(collaborator, project, Participacion.Permiso.CONSULTA));
    var doc = document(); create(doc, admin).andExpect(status().isCreated());
    UUID id = UUID.randomUUID(); askAssistant(doc, id, admin).andExpect(status().isAccepted());
    try (var pool = Executors.newFixedThreadPool(2)) {
      var gate = new CountDownLatch(1);
      Callable<MvcResult> claimCall = () -> { gate.await(); return mvc.perform(post(assistantPath(doc)+"/claim").with(actor(admin)).with(csrf())).andReturn(); };
      var a = pool.submit(claimCall); var b = pool.submit(claimCall); gate.countDown();
      var results = List.of(a.get(10, TimeUnit.SECONDS), b.get(10, TimeUnit.SECONDS));
      assertThat(results.stream().map(r -> r.getResponse().getStatus())).containsExactlyInAnyOrder(200,204);
      var first = json.readTree(results.stream().filter(r -> r.getResponse().getStatus()==200).findFirst().orElseThrow().getResponse().getContentAsString());
      finishAssistant(doc, first, collaborator, "No autorizada", false).andExpect(status().isConflict());
      jdbc.update("update solicitud_ia_diagrama set vencimiento=now()-interval '1 minute' where id=?", id);
      mvc.perform(get(path() + "/" + doc.get("id") + "/conversation").with(actor(admin)))
          .andExpect(jsonPath("$.assistant.status").value("PENDIENTE"));
      var second = claimAssistant(doc, collaborator);
      finishAssistant(doc, first, admin, "Respuesta vieja", false).andExpect(status().isConflict());
      mvc.perform(post(assistantPath(doc)+"/"+id+"/release").with(actor(collaborator)).with(csrf())
          .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("token",second.get("token").asString()))))
          .andExpect(status().isNoContent());
      var third = claimAssistant(doc, admin);
      finishAssistant(doc, third, admin, "", true).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("FALLIDA"));
    }
    assertThat(jdbc.queryForObject("select count(*) from mensaje_diagrama where diagrama_id=?", Integer.class,
        UUID.fromString(doc.get("id").toString()))).isEqualTo(1);
  }

  @Test
  void contextLimitFailureIsSharedIdempotentlyWithoutAcceptingArbitraryMessages() throws Exception {
    members.saveAndFlush(new Participacion(collaborator, project, Participacion.Permiso.CONSULTA));
    var doc = document(); create(doc, admin).andExpect(status().isCreated());
    UUID id = UUID.randomUUID(); askAssistant(doc, id, admin).andExpect(status().isAccepted());
    var claim = claimAssistant(doc, collaborator);
    String url = assistantPath(doc) + "/" + id + "/complete";
    var body = Map.of("token", claim.get("token").asString(), "content", "", "failed", true, "failureReason", "CONTEXT_TOO_LONG");
    for (int i = 0; i < 2; i++) mvc.perform(post(url).with(actor(collaborator)).with(csrf())
        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)))
        .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("FALLIDA"))
        .andExpect(jsonPath("$.error", org.hamcrest.Matchers.containsString("contexto superan")));
    mvc.perform(post(url).with(actor(collaborator)).with(csrf()).contentType(MediaType.APPLICATION_JSON)
        .content(json.writeValueAsString(Map.of("token", claim.get("token").asString(), "content", "", "failed", true,
            "failureReason", "mensaje arbitrario")))).andExpect(status().isBadRequest());
    for (var user : List.of(admin, collaborator))
      mvc.perform(get(path()+"/"+doc.get("id")+"/conversation").with(actor(user)))
          .andExpect(jsonPath("$.assistant.status").value("FALLIDA"))
          .andExpect(jsonPath("$.assistant.error", org.hamcrest.Matchers.containsString("pregunta más breve")))
          .andExpect(jsonPath("$.items.length()").value(1));
  }

  @Test
  void browserAssistantRevalidatesRequesterAndExecutorAndIsolatesProjects() throws Exception {
    members.saveAndFlush(new Participacion(collaborator, project, Participacion.Permiso.CONSULTA));
    var doc = document(); create(doc, admin).andExpect(status().isCreated());
    askAssistant(doc, UUID.randomUUID(), collaborator).andExpect(status().isAccepted());
    var claim = claimAssistant(doc, admin);
    jdbc.update("delete from participacion where proyecto_id=? and usuario_id=?", project.id, collaborator.id);
    finishAssistant(doc, claim, admin, "No debe publicarse", false)
        .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("FALLIDA"));
    mvc.perform(post(assistantPath(doc)+"/claim").with(actor(collaborator)).with(csrf())).andExpect(status().isNotFound());
    mvc.perform(post("/api/projects/"+other.id+"/diagrams/"+doc.get("id")+"/conversation/assistant/claim")
        .with(actor(admin)).with(csrf())).andExpect(status().isNotFound());
    mvc.perform(post(assistantPath(doc)+"/claim").with(actor(admin))).andExpect(status().isForbidden());
    mvc.perform(post(assistantPath(doc)+"/claim").with(csrf())).andExpect(status().isUnauthorized());
    assertThat(jdbc.queryForObject("select count(*) from mensaje_diagrama where diagrama_id=?", Integer.class,
        UUID.fromString(doc.get("id").toString()))).isEqualTo(1);
    members.saveAndFlush(new Participacion(collaborator, project, Participacion.Permiso.CONSULTA));
    askAssistant(doc, UUID.randomUUID(), admin).andExpect(status().isAccepted());
    var second = claimAssistant(doc, collaborator);
    jdbc.update("delete from participacion where proyecto_id=? and usuario_id=?", project.id, collaborator.id);
    finishAssistant(doc, second, collaborator, "No debe publicarse", false).andExpect(status().isNotFound());
  }

  @Test
  void browserAssistantValidatesAnswerAndCancelsRevokedPendingRequest() throws Exception {
    members.saveAndFlush(new Participacion(collaborator, project, Participacion.Permiso.CONSULTA));
    var doc = document(); create(doc, admin).andExpect(status().isCreated());
    askAssistant(doc, UUID.randomUUID(), collaborator).andExpect(status().isAccepted());
    jdbc.update("delete from participacion where proyecto_id=? and usuario_id=?", project.id, collaborator.id);
    mvc.perform(post(assistantPath(doc)+"/claim").with(actor(admin)).with(csrf())).andExpect(status().isNoContent());
    askAssistant(doc, UUID.randomUUID(), admin).andExpect(status().isAccepted());
    var claim = claimAssistant(doc, admin);
    finishAssistant(doc, claim, admin, "", false).andExpect(status().isBadRequest());
    finishAssistant(doc, claim, admin, "x".repeat(4001), false).andExpect(status().isBadRequest());
    finishAssistant(doc, claim, admin, "", true).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("FALLIDA"));
  }
  ResultActions message(Map<String, Object> doc, UUID messageId, String content, Usuario user) throws Exception {
    return mvc.perform(post(path() + "/" + doc.get("id") + "/conversation")
        .with(actor(user)).with(csrf()).contentType(MediaType.APPLICATION_JSON)
        .content(json.writeValueAsString(Map.of("id", messageId, "content", content))));
  }

  @Test
  void conversationIsSharedPersistentAndDoesNotGrantDiagramWritePermission() throws Exception {
    members.saveAndFlush(new Participacion(collaborator, project, Participacion.Permiso.CONSULTA));
    var doc = document();
    create(doc, admin).andExpect(status().isCreated());
    UUID id = UUID.randomUUID();
    message(doc, id, " Revisemos las multiplicidades. ", collaborator)
        .andExpect(status().isCreated()).andExpect(header().string("Cache-Control", "no-store"))
        .andExpect(jsonPath("$.authorId").value(collaborator.id.toString()))
        .andExpect(jsonPath("$.authorName").value(collaborator.nombre))
        .andExpect(jsonPath("$.content").value("Revisemos las multiplicidades."))
        .andExpect(jsonPath("$.diagramRevision").value(0));
    message(doc, UUID.randomUUID(), "De acuerdo.", admin).andExpect(status().isCreated());
    for (var user : List.of(admin, collaborator))
      mvc.perform(get(path() + "/" + doc.get("id") + "/conversation").with(actor(user)))
          .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
          .andExpect(jsonPath("$.items.length()").value(2))
          .andExpect(jsonPath("$.items[0].id").value(id.toString()))
          .andExpect(jsonPath("$.items[1].content").value("De acuerdo."));
    update(doc, 0, collaborator).andExpect(status().isForbidden());
    mvc.perform(get(path() + "/" + doc.get("id") + "/state").with(actor(admin)))
        .andExpect(jsonPath("$.revision").value(0));
    assertThat(jdbc.queryForObject("select count(*) from version_diagrama where diagrama_id=?", Integer.class,
        UUID.fromString((String)doc.get("id")))).isEqualTo(1);
  }

  @Test
  void conversationRetriesAreIdempotentEvenConcurrently() throws Exception {
    var doc = document();
    create(doc, admin).andExpect(status().isCreated());
    UUID id = UUID.randomUUID();
    try (var pool = Executors.newFixedThreadPool(2)) {
      var gate = new CountDownLatch(1);
      Callable<Integer> send = () -> {
        gate.await();
        return message(doc, id, "Una sola vez", admin).andReturn().getResponse().getStatus();
      };
      var first = pool.submit(send); var second = pool.submit(send); gate.countDown();
      assertThat(List.of(first.get(15, TimeUnit.SECONDS), second.get(15, TimeUnit.SECONDS)))
          .containsExactly(201, 201);
    }
    message(doc, id, "Otro contenido", admin).andExpect(status().isConflict());
    members.saveAndFlush(new Participacion(collaborator, project, Participacion.Permiso.EDICION));
    message(doc, id, "Una sola vez", collaborator).andExpect(status().isConflict());
    mvc.perform(get(path() + "/" + doc.get("id") + "/conversation").with(actor(admin)))
        .andExpect(jsonPath("$.items.length()").value(1)).andExpect(jsonPath("$.items[0].sequence").value(1));
  }

  @Test
  void conversationCursorsKeepChronologicalOrderAcrossNewMessages() throws Exception {
    var doc = document();
    create(doc, admin).andExpect(status().isCreated());
    String endpoint = path() + "/" + doc.get("id") + "/conversation";
    for (int i = 1; i <= 4; i++) message(doc, UUID.randomUUID(), "Mensaje " + i, admin).andExpect(status().isCreated());
    mvc.perform(get(endpoint + "?size=2").with(actor(admin)))
        .andExpect(jsonPath("$.items[0].sequence").value(3))
        .andExpect(jsonPath("$.items[1].sequence").value(4))
        .andExpect(jsonPath("$.nextBefore").value(3));
    message(doc, UUID.randomUUID(), "Mensaje 5", admin).andExpect(status().isCreated());
    mvc.perform(get(endpoint + "?before=3&size=2").with(actor(admin)))
        .andExpect(jsonPath("$.items[0].sequence").value(1))
        .andExpect(jsonPath("$.items[1].sequence").value(2))
        .andExpect(jsonPath("$.nextBefore").isEmpty());
    mvc.perform(get(endpoint + "?after=2&size=2").with(actor(admin)))
        .andExpect(jsonPath("$.items[0].sequence").value(3))
        .andExpect(jsonPath("$.items[1].sequence").value(4))
        .andExpect(jsonPath("$.nextAfter").value(4));
    mvc.perform(get(endpoint + "?after=4").with(actor(admin)))
        .andExpect(jsonPath("$.items[0].sequence").value(5))
        .andExpect(jsonPath("$.nextAfter").isEmpty());
    mvc.perform(get(endpoint + "?after=5").with(actor(admin))).andExpect(jsonPath("$.items").isEmpty());
    for (String query : List.of("?after=-1", "?before=0", "?before=3&after=0"))
      mvc.perform(get(endpoint + query).with(actor(admin))).andExpect(status().isBadRequest());
  }

  @Test
  void conversationEnforcesAccessCsrfScopeAndPayloadLimits() throws Exception {
    var doc = document();
    create(doc, admin).andExpect(status().isCreated());
    String endpoint = path() + "/" + doc.get("id") + "/conversation";
    mvc.perform(get(endpoint)).andExpect(status().isUnauthorized());
    mvc.perform(get(endpoint).with(actor(collaborator))).andExpect(status().isNotFound());
    message(doc, UUID.randomUUID(), "Ajeno", collaborator).andExpect(status().isNotFound());
    mvc.perform(post(endpoint).with(actor(admin)).contentType(MediaType.APPLICATION_JSON)
        .content(json.writeValueAsString(Map.of("id", UUID.randomUUID(), "content", "Sin CSRF"))))
        .andExpect(status().isForbidden());
    for (String text : List.of("  ", "x".repeat(4001), "texto\u0000inválido"))
      message(doc, UUID.randomUUID(), text, admin).andExpect(status().isBadRequest());
    message(doc, UUID.randomUUID(), "x".repeat(4000), admin).andExpect(status().isCreated());
    mvc.perform(get("/api/projects/" + other.id + "/diagrams/" + doc.get("id") + "/conversation")
        .with(actor(admin))).andExpect(status().isNotFound());
    var membership = members.saveAndFlush(new Participacion(collaborator, project, Participacion.Permiso.CONSULTA));
    message(doc, UUID.randomUUID(), "Permitido", collaborator).andExpect(status().isCreated());
    members.deleteById(membership.id);
    mvc.perform(get(endpoint).with(actor(collaborator))).andExpect(status().isNotFound());
    message(doc, UUID.randomUUID(), "Revocado", collaborator).andExpect(status().isNotFound());
    mvc.perform(delete(path() + "/" + doc.get("id") + "?revision=0").with(actor(admin)).with(csrf()))
        .andExpect(status().isNoContent());
    mvc.perform(get(endpoint).with(actor(admin))).andExpect(status().isNotFound());
    message(doc, UUID.randomUUID(), "Eliminado", admin).andExpect(status().isNotFound());
  }

  @Test
  void activityRecordsAuthorsAndCommittedChangesAndSurvivesRepeatedReads() throws Exception {
    members.saveAndFlush(new Participacion(collaborator, project, Participacion.Permiso.EDICION));
    var doc = document();
    create(doc, admin).andExpect(status().isCreated());
    doc.put("name", "Inventario compartido");
    UUID requestId = UUID.randomUUID();
    propose(doc, requestId, 0, collaborator).andExpect(status().isOk());
    propose(doc, requestId, 0, collaborator).andExpect(status().isOk());
    String endpoint = path() + "/" + doc.get("id") + "/activity";
    for (var user : List.of(admin, collaborator)) {
      mvc.perform(get(endpoint).with(actor(user)))
          .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
          .andExpect(jsonPath("$.items.length()").value(2))
          .andExpect(jsonPath("$.items[0].version").value(2))
          .andExpect(jsonPath("$.items[0].authorId").value(collaborator.id.toString()))
          .andExpect(jsonPath("$.items[0].authorName").value(collaborator.nombre))
          .andExpect(jsonPath("$.items[0].changes[0].before").value("Ventas"))
          .andExpect(jsonPath("$.items[0].changes[0].after").value("Inventario compartido"))
          .andExpect(jsonPath("$.items[1].authorId").value(admin.id.toString()))
          .andExpect(jsonPath("$.items[1].changes[0].action").value("created"));
    }
    mvc.perform(get(path() + "/" + doc.get("id") + "/state").with(actor(admin)))
        .andExpect(jsonPath("$.revision").value(1));
  }

  @Test
  void sharedProposalIsReadOnlyAuthorizedIdempotentAndBoundToRevision() throws Exception {
    var member = members.saveAndFlush(new Participacion(collaborator, project, Participacion.Permiso.CONSULTA));
    var doc = document(); create(doc, admin).andExpect(status().isCreated());
    String conversation = path() + "/" + doc.get("id") + "/conversation";
    UUID proposalId = UUID.randomUUID();
    String proposalData = "{\"status\":\"propose\",\"operations\":[{\"type\":\"addClass\",\"name\":\"Factura\"}]}";
    var body = Map.of("id", proposalId, "baseRevision", 0, "instruction", "Crea Factura",
        "changes", List.of("Crear clase Factura."), "proposalData", proposalData);
    mvc.perform(post(conversation + "/proposals").with(actor(collaborator)).with(csrf())
        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body))).andExpect(status().isForbidden());
    for (int i=0; i<2; i++) mvc.perform(post(conversation + "/proposals").with(actor(admin)).with(csrf())
        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)))
        .andExpect(status().isCreated()).andExpect(jsonPath("$.kind").value("PROPUESTA"))
        .andExpect(jsonPath("$.proposalInstruction").value("Crea Factura"))
        .andExpect(jsonPath("$.proposalData").value(proposalData))
        .andExpect(jsonPath("$.authorId").value(admin.id.toString()));
    mvc.perform(get(conversation).with(actor(collaborator)))
        .andExpect(jsonPath("$.items.length()").value(1)).andExpect(jsonPath("$.items[0].kind").value("PROPUESTA"))
        .andExpect(jsonPath("$.items[0].proposalInstruction").value("Crea Factura"))
        .andExpect(jsonPath("$.items[0].proposalData").value(proposalData))
        .andExpect(jsonPath("$.items[0].content", org.hamcrest.Matchers.containsString("Sin aplicar")));
    doc.put("name", "Cambio posterior"); update(doc, 0, admin).andExpect(status().isOk());
    mvc.perform(post(conversation + "/proposals").with(actor(admin)).with(csrf())
        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body))).andExpect(status().isCreated());
    var stale = Map.of("id", UUID.randomUUID(), "baseRevision", 0, "instruction", "Crea Factura",
        "changes", List.of("Crear clase Factura."));
    mvc.perform(post(conversation + "/proposals").with(actor(admin)).with(csrf())
        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(stale))).andExpect(status().isConflict());
    var changed = Map.of("id", proposalId, "baseRevision", 0, "instruction", "Crea Otra",
        "changes", List.of("Crear clase Otra."));
    mvc.perform(post(conversation + "/proposals").with(actor(admin)).with(csrf())
        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(changed))).andExpect(status().isConflict());
    members.deleteById(member.id);
    mvc.perform(get(conversation).with(actor(collaborator))).andExpect(status().isNotFound());
    mvc.perform(get(path()+"/"+doc.get("id")+"/state").with(actor(admin)))
        .andExpect(jsonPath("$.revision").value(1));
    // Earlier proposals have no structured instruction; do not infer it from free text.
    jdbc.update("UPDATE mensaje_diagrama SET instruccion_propuesta=NULL WHERE id=?", proposalId);
    mvc.perform(get(conversation).with(actor(admin))).andExpect(jsonPath("$.items[0].proposalInstruction").isEmpty());
  }

  @Test
  void activityPaginationIsStableAndLegacyAuthorsRemainUnknown() throws Exception {
    var doc = document();
    create(doc, admin).andExpect(status().isCreated());
    UUID id = UUID.fromString((String) doc.get("id"));
    // Simulate a snapshot that predates V8. Do not guess its author from surrounding changes.
    jdbc.update("update version_diagrama set autor_id=null, autor_nombre=null where diagrama_id=?", id);
    doc.put("name", "Segunda");
    update(doc, 0, admin).andExpect(status().isOk());
    String endpoint = path() + "/" + id + "/activity";
    mvc.perform(get(endpoint + "?size=1").with(actor(admin)))
        .andExpect(jsonPath("$.items.length()").value(1))
        .andExpect(jsonPath("$.nextBeforeVersion").value(2));
    doc.put("name", "Tercera");
    update(doc, 1, admin).andExpect(status().isOk());
    mvc.perform(get(endpoint + "?beforeVersion=2&size=1").with(actor(admin)))
        .andExpect(jsonPath("$.items[0].version").value(1))
        .andExpect(jsonPath("$.items[0].authorId").isEmpty())
        .andExpect(jsonPath("$.items[0].authorName").isEmpty())
        .andExpect(jsonPath("$.nextBeforeVersion").isEmpty());
    mvc.perform(get(endpoint + "?beforeVersion=0").with(actor(admin)))
        .andExpect(status().isBadRequest());
  }

  @Test
  void activityRechecksSessionMembershipAndDiagramScope() throws Exception {
    var doc = document();
    create(doc, admin).andExpect(status().isCreated());
    String endpoint = path() + "/" + doc.get("id") + "/activity";
    mvc.perform(get(endpoint)).andExpect(status().isUnauthorized());
    mvc.perform(get(endpoint).with(actor(collaborator))).andExpect(status().isNotFound());
    var membership = members.saveAndFlush(new Participacion(collaborator, project, Participacion.Permiso.CONSULTA));
    mvc.perform(get(endpoint).with(actor(collaborator))).andExpect(status().isOk());
    mvc.perform(get("/api/projects/" + other.id + "/diagrams/" + doc.get("id") + "/activity")
        .with(actor(admin))).andExpect(status().isNotFound());
    members.deleteById(membership.id);
    mvc.perform(get(endpoint).with(actor(collaborator))).andExpect(status().isNotFound());
    mvc.perform(delete(path() + "/" + doc.get("id") + "?revision=0").with(actor(admin)).with(csrf()))
        .andExpect(status().isNoContent());
    mvc.perform(get(endpoint).with(actor(admin))).andExpect(status().isNotFound());
  }

  @Test @SuppressWarnings("unchecked")
  void versionDetailsPageAllChangesAndRecheckAccess() throws Exception {
    var original = document();
    create(original, admin).andExpect(status().isCreated());
    var edited = copy(original);
    var classes = (List<Map<String, Object>>) edited.get("classes");
    for (int c = 0; c < 2; c++) {
      var attributes = (List<Map<String, Object>>) classes.get(c).get("attributes");
      for (int i = 0; i < 60; i++) attributes.add(Map.of(
          "id", UUID.randomUUID().toString(), "name", "campo" + i, "dataType", "String",
          "visibility", "private", "identifier", false, "required", false));
    }
    update(edited, 0, admin).andExpect(status().isOk());
    String endpoint = path() + "/" + original.get("id") + "/activity";
    mvc.perform(get(endpoint).with(actor(admin)))
        .andExpect(jsonPath("$.items[0].totalChanges").value(120))
        .andExpect(jsonPath("$.items[0].changes.length()").value(100));
    var first = mvc.perform(get(endpoint + "/2/changes?offset=0&size=100").with(actor(admin)))
        .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
        .andExpect(jsonPath("$.totalChanges").value(120)).andExpect(jsonPath("$.nextOffset").value(100))
        .andReturn().getResponse().getContentAsString();
    var second = mvc.perform(get(endpoint + "/2/changes?offset=100&size=100").with(actor(admin)))
        .andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(20))
        .andExpect(jsonPath("$.nextOffset").isEmpty()).andReturn().getResponse().getContentAsString();
    var firstItems = (List<Map<String,Object>>) json.readValue(first, Map.class).get("items");
    var secondItems = (List<Map<String,Object>>) json.readValue(second, Map.class).get("items");
    var ids = new HashSet<Object>();
    firstItems.forEach(item -> ids.add(item.get("elementId")));
    secondItems.forEach(item -> ids.add(item.get("elementId")));
    assertThat(ids).hasSize(120);
    mvc.perform(get(endpoint + "/2/changes?offset=-1").with(actor(admin))).andExpect(status().isBadRequest());
    mvc.perform(get(endpoint + "/2/changes?size=101").with(actor(admin))).andExpect(status().isBadRequest());
    mvc.perform(get(endpoint + "/99/changes").with(actor(admin))).andExpect(status().isNotFound());
    mvc.perform(get(endpoint + "/2/changes")).andExpect(status().isUnauthorized());
    mvc.perform(get(endpoint + "/2/changes").with(actor(collaborator))).andExpect(status().isNotFound());
    var member = members.saveAndFlush(new Participacion(collaborator, project, Participacion.Permiso.CONSULTA));
    mvc.perform(get(endpoint + "/2/changes?offset=100").with(actor(collaborator))).andExpect(status().isOk());
    members.deleteById(member.id);
    mvc.perform(get(endpoint + "/2/changes?offset=100").with(actor(collaborator))).andExpect(status().isNotFound());
    mvc.perform(get(path() + "/" + original.get("id") + "/state").with(actor(admin)))
        .andExpect(jsonPath("$.revision").value(1));
    jdbc.update("delete from version_diagrama where diagrama_id=? and numero=1", UUID.fromString((String) original.get("id")));
    mvc.perform(get(endpoint + "/2/changes").with(actor(admin))).andExpect(status().isConflict());
  }

  @Test
  void pendingOrRejectedProposalsNeverAppearAsAppliedActivity() throws Exception {
    var original = document();
    create(original, admin).andExpect(status().isCreated());
    var remote = copy(original); remote.put("name", "Confirmado");
    update(remote, 0, admin).andExpect(status().isOk());
    var proposal = copy(original); proposal.put("name", "Pendiente");
    propose(proposal, UUID.randomUUID(), 0, admin).andExpect(jsonPath("$.status").value("PENDIENTE"));
    var invalid = copy(remote); invalid.put("schemaVersion", 99);
    update(invalid, 1, admin).andExpect(status().isBadRequest());
    mvc.perform(get(path() + "/" + original.get("id") + "/activity").with(actor(admin)))
        .andExpect(jsonPath("$.items.length()").value(2))
        .andExpect(jsonPath("$.items[0].changes[0].after").value("Confirmado"));
  }

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
    parent.put("abstract", true);
    var child = new HashMap<String,Object>(parent);
    child.put("id", UUID.randomUUID().toString()); child.put("name", "ClientePremium");
    child.put("abstract", false);
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
        assertThat(names).doesNotContain("src/main/java/com/example/generated/controller/ClienteController.java");
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

  @Test
  void xmiDownloadChecksPermissionsRevisionAndPreservesModel() throws Exception {
    var doc = document(); create(doc, admin).andExpect(status().isCreated());
    String endpoint = path()+"/"+doc.get("id")+"/xmi?revision=0";
    mvc.perform(get(endpoint)).andExpect(status().isUnauthorized());
    mvc.perform(get(endpoint).with(actor(collaborator))).andExpect(status().isNotFound());
    var member = members.saveAndFlush(new Participacion(collaborator, project, Participacion.Permiso.CONSULTA));
    mvc.perform(get(endpoint).with(actor(collaborator))).andExpect(status().isForbidden());
    member.permiso=Participacion.Permiso.EDICION; members.saveAndFlush(member);
    for (var user : List.of(admin, collaborator)) {
      var response = mvc.perform(get(endpoint).with(actor(user))).andExpect(status().isOk())
          .andExpect(content().contentType("application/xml"))
          .andExpect(header().string("Cache-Control", "no-store"))
          .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.containsString(".xml")))
          .andReturn().getResponse();
      var inventory=bo.edu.modela.interoperability.EaXmiReader.read(response.getContentAsByteArray());
      assertThat(inventory.issues()).isEmpty();
      assertThat(inventory.classes()).hasSize(2);
      assertThat(inventory.relations()).hasSize(1);
    }
    mvc.perform(get(path()+"/"+doc.get("id")+"/xmi?revision=1").with(actor(admin))).andExpect(status().isConflict());
    mvc.perform(get("/api/projects/"+other.id+"/diagrams/"+doc.get("id")+"/xmi?revision=0").with(actor(admin)))
        .andExpect(status().isNotFound());
    assertThat(jdbc.queryForObject("select count(*) from version_diagrama where diagrama_id=?", Integer.class,
        UUID.fromString((String)doc.get("id")))).isEqualTo(1);
    members.deleteById(member.id);
    mvc.perform(get(endpoint).with(actor(collaborator))).andExpect(status().isNotFound());
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
  @Test @SuppressWarnings("unchecked")
  void appliedAssistantEditPublishesInstructionAndVerifiedAnswerOnce() throws Exception {
    members.saveAndFlush(new Participacion(collaborator, project, Participacion.Permiso.CONSULTA));
    var base = document(); create(base, admin).andExpect(status().isCreated());
    var edited = copy(base);
    ((List<Map<String,Object>>) edited.get("classes")).add(new HashMap<>(Map.of(
        "id", UUID.randomUUID().toString(), "name", "camion", "abstract", false,
        "position", Map.of("x", 200, "y", 300), "attributes", List.of())));
    UUID change = UUID.randomUUID();
    var body = Map.of("id", change, "baseRevision", 0, "document", edited,
        "assistantInstruction", "crea la clase camion");
    for (int i = 0; i < 2; i++)
      mvc.perform(post(path()+"/"+base.get("id")+"/changes").with(actor(admin)).with(csrf())
          .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)))
          .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("APLICADO"))
          .andExpect(jsonPath("$.assistantRecorded").value(true));
    for (var user : List.of(admin, collaborator))
      mvc.perform(get(path()+"/"+base.get("id")+"/conversation").with(actor(user)))
          .andExpect(jsonPath("$.items.length()").value(2))
          .andExpect(jsonPath("$.items[0].content").value("crea la clase camion"))
          .andExpect(jsonPath("$.items[0].authorName").value(admin.nombre))
          .andExpect(jsonPath("$.items[1].content").value("La clase camion ha sido creada."))
          .andExpect(jsonPath("$.items[1].authorName").value("Asistente · edición"));
    var refused = new HashMap<>(body); refused.put("id", UUID.randomUUID());
    mvc.perform(post(path()+"/"+base.get("id")+"/changes").with(actor(collaborator)).with(csrf())
        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(refused)))
        .andExpect(status().isForbidden());
    mvc.perform(get(path()+"/"+base.get("id")+"/conversation").with(actor(admin)))
        .andExpect(jsonPath("$.items.length()").value(2));
  }
  @Test @SuppressWarnings("unchecked")
  void deletingClassRecordsSharedAnswerAndRemovesItsRelations() throws Exception {
    members.saveAndFlush(new Participacion(collaborator, project, Participacion.Permiso.CONSULTA));
    var base = document(); create(base, admin).andExpect(status().isCreated());
    var edited = copy(base);
    ((List<Map<String,Object>>) edited.get("classes")).removeIf(c -> c.get("name").equals("Pedido"));
    ((List<Map<String,Object>>) edited.get("relations")).clear();
    var body = Map.of("id", UUID.randomUUID(), "baseRevision", 0, "document", edited, "assistantInstruction", "elimina la clase Pedido");
    mvc.perform(post(path()+"/"+base.get("id")+"/changes").with(actor(admin)).with(csrf())
        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)))
        .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("APLICADO"));
    mvc.perform(get(path()+"/"+base.get("id")+"/conversation").with(actor(collaborator)))
        .andExpect(jsonPath("$.items[1].content", org.hamcrest.Matchers.containsString("La clase Pedido ha sido eliminada.")))
        .andExpect(jsonPath("$.items[1].content", org.hamcrest.Matchers.containsString("Relaciones eliminadas: 1")));
    mvc.perform(get(path()+"/"+base.get("id")).with(actor(collaborator)))
        .andExpect(jsonPath("$.document.classes.length()").value(1))
        .andExpect(jsonPath("$.document.relations.length()").value(0));
  }
  @Test @SuppressWarnings("unchecked")
  void deletingAssociationClassKeepsAssociationAndClearsReference() throws Exception {
    var base = copy(document());
    String detail = UUID.randomUUID().toString();
    ((List<Map<String,Object>>) base.get("classes")).add(new HashMap<>(Map.of(
        "id", detail, "name", "Detalle", "abstract", false, "position", Map.of("x", 10, "y", 10), "attributes", List.of())));
    ((List<Map<String,Object>>) base.get("relations")).getFirst().put("associationClassId", detail);
    create(base, admin).andExpect(status().isCreated());
    var edited = copy(base);
    ((List<Map<String,Object>>) edited.get("classes")).removeIf(c -> c.get("name").equals("Detalle"));
    ((List<Map<String,Object>>) edited.get("relations")).getFirst().put("associationClassId", null);
    var body = Map.of("id", UUID.randomUUID(), "baseRevision", 0, "document", edited, "assistantInstruction", "elimina la clase Detalle");
    mvc.perform(post(path()+"/"+base.get("id")+"/changes").with(actor(admin)).with(csrf())
        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)))
        .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("APLICADO"));
    mvc.perform(get(path()+"/"+base.get("id")+"/conversation").with(actor(admin)))
        .andExpect(jsonPath("$.items[1].content", org.hamcrest.Matchers.containsString("Asociaciones desvinculadas: 1")));
    mvc.perform(get(path()+"/"+base.get("id")).with(actor(admin)))
        .andExpect(jsonPath("$.document.relations.length()").value(1))
        .andExpect(jsonPath("$.document.relations[0].associationClassId").doesNotExist());
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
      jdbc.update("delete from archivo_compartido where proyecto_id=?", p.id);
      jdbc.update("delete from solicitud_ia_diagrama where proyecto_id=?", p.id);
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

  @Test
  void projectFilesAreSharedBoundedIdempotentAndAuthorized() throws Exception {
    members.saveAndFlush(new Participacion(collaborator, project, Participacion.Permiso.CONSULTA));
    String url = "/api/projects/" + project.id + "/files";
    UUID id = UUID.randomUUID();
    var upload = new org.springframework.mock.web.MockMultipartFile("file", "modelo.xml", "application/xml", "<modelo/>".getBytes(java.nio.charset.StandardCharsets.UTF_8));
    for (int i=0; i<2; i++)
      mvc.perform(multipart(url).file(upload).param("id",id.toString()).with(actor(collaborator)).with(csrf()))
          .andExpect(status().isNoContent());
    mvc.perform(get(url).with(actor(admin))).andExpect(status().isOk())
        .andExpect(jsonPath("$[0].name").value("modelo.xml"))
        .andExpect(jsonPath("$[0].author").value(collaborator.nombre));
    mvc.perform(get(url+"/"+id).with(actor(admin))).andExpect(status().isOk())
        .andExpect(content().bytes("<modelo/>".getBytes(java.nio.charset.StandardCharsets.UTF_8)))
        .andExpect(header().string("Content-Type", "application/octet-stream"));
    mvc.perform(get("/api/projects/"+other.id+"/files/"+id).with(actor(collaborator))).andExpect(status().isNotFound());
    mvc.perform(get("/api/projects/"+other.id+"/files").with(actor(collaborator))).andExpect(status().isNotFound());
    var executable = new org.springframework.mock.web.MockMultipartFile("file", "virus.exe", "application/octet-stream", new byte[]{1});
    mvc.perform(multipart(url).file(executable).param("id",UUID.randomUUID().toString()).with(actor(collaborator)).with(csrf()))
        .andExpect(status().isBadRequest());
    var oversized = new org.springframework.mock.web.MockMultipartFile("file", "enorme.pdf", "application/pdf", new byte[5 * 1024 * 1024 + 1]);
    mvc.perform(multipart(url).file(oversized).param("id",UUID.randomUUID().toString()).with(actor(collaborator)).with(csrf()))
        .andExpect(status().isBadRequest());
    mvc.perform(multipart(url).file(upload).param("id",UUID.randomUUID().toString()).with(actor(collaborator)))
        .andExpect(status().isForbidden());
    var different = new org.springframework.mock.web.MockMultipartFile("file", "modelo.xml", "application/xml", new byte[]{1});
    mvc.perform(multipart(url).file(different).param("id",id.toString()).with(actor(collaborator)).with(csrf()))
        .andExpect(status().isConflict());
    mvc.perform(delete(url+"/"+id).with(actor(collaborator)).with(csrf())).andExpect(status().isNoContent());
    mvc.perform(get(url+"/"+id).with(actor(admin))).andExpect(status().isNotFound());
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
  @SuppressWarnings("unchecked")
  void methodsAreSavedEditedDeletedAndRecovered() throws Exception {
    var doc = document();
    create(doc, admin).andExpect(status().isCreated());
    var classes = (List<Map<String, Object>>) doc.get("classes");
    var first = new HashMap<>(classes.getFirst());
    String methodId = UUID.randomUUID().toString();
    first.put("methods", List.of(Map.of("id", methodId, "name", "calcularTotal", "returnType", "Decimal", "visibility", "public")));
    doc.put("classes", List.of(first, classes.get(1)));
    update(doc, 0, admin).andExpect(status().isOk());
    mvc.perform(get(path() + "/" + doc.get("id")).with(actor(admin)))
        .andExpect(status().isOk()).andExpect(jsonPath("$.document.classes[0].methods[0].name").value("calcularTotal"))
        .andExpect(jsonPath("$.document.classes[0].methods[0].returnType").value("Decimal"));
    first.put("methods", List.of(Map.of("id", methodId, "name", "encender", "returnType", "void", "visibility", "private")));
    update(doc, 1, admin).andExpect(status().isOk());
    mvc.perform(get(path() + "/" + doc.get("id")).with(actor(admin)))
        .andExpect(jsonPath("$.document.classes[0].methods[0].name").value("encender"))
        .andExpect(jsonPath("$.document.classes[0].methods[0].returnType").value("void"))
        .andExpect(jsonPath("$.document.classes[0].methods[0].visibility").value("private"));
    first.put("methods", List.of());
    update(doc, 2, admin).andExpect(status().isOk());
    mvc.perform(get(path() + "/" + doc.get("id")).with(actor(admin)))
        .andExpect(jsonPath("$.document.classes[0].methods.length()").value(0));
  }

  @Test @SuppressWarnings("unchecked")
  void oldClientsCannotEraseMethodsAndConcurrentChangesAreMerged() throws Exception {
    members.saveAndFlush(new Participacion(collaborator, project, Participacion.Permiso.EDICION));
    var initial = copy(document());
    create(initial, admin).andExpect(status().isCreated());
    var newer = copy(initial);
    var newerClasses = (List<Map<String,Object>>) newer.get("classes");
    var method = Map.of("id", UUID.randomUUID().toString(), "name", "encender", "returnType", "void", "visibility", "public");
    newerClasses.getFirst().put("methods", List.of(method));
    propose(newer, UUID.randomUUID(), 0, admin).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("APLICADO"));
    var legacy = copy(initial); legacy.put("name", "Cambio de versión antigua");
    propose(legacy, UUID.randomUUID(), 0, collaborator).andExpect(status().isConflict())
        .andExpect(jsonPath("$.message", org.hamcrest.Matchers.containsString("métodos")));
    update(legacy, 1, admin).andExpect(status().isConflict());
    var concurrent = copy(initial);
    ((List<Map<String,Object>>)concurrent.get("classes")).getFirst().put("methods", List.of());
    concurrent.put("name", "Venta actualizada");
    propose(concurrent, UUID.randomUUID(), 0, collaborator).andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("APLICADO"))
        .andExpect(jsonPath("$.current.document.name").value("Venta actualizada"))
        .andExpect(jsonPath("$.current.document.classes[0].methods[0].name").value("encender"));
    mvc.perform(get(path()+"/"+initial.get("id")).with(actor(collaborator)))
        .andExpect(jsonPath("$.document.classes[0].methods[0].returnType").value("void"));
  }

  @Test @SuppressWarnings("unchecked")
  void conflictingMethodEditsRequireResolution() throws Exception {
    members.saveAndFlush(new Participacion(collaborator, project, Participacion.Permiso.EDICION));
    var base = copy(document());
    String id = UUID.randomUUID().toString();
    ((List<Map<String,Object>>)base.get("classes")).getFirst().put("methods", List.of(
        Map.of("id", id, "name", "encender", "returnType", "void", "visibility", "public")));
    create(base, admin).andExpect(status().isCreated());
    var first = copy(base); var second = copy(base);
    ((List<Map<String,Object>>)first.get("classes")).getFirst().put("methods", List.of(
        Map.of("id", id, "name", "activar", "returnType", "void", "visibility", "public")));
    ((List<Map<String,Object>>)second.get("classes")).getFirst().put("methods", List.of(
        Map.of("id", id, "name", "iniciar", "returnType", "void", "visibility", "public")));
    propose(first, UUID.randomUUID(), 0, admin).andExpect(jsonPath("$.status").value("APLICADO"));
    propose(second, UUID.randomUUID(), 0, collaborator).andExpect(jsonPath("$.status").value("PENDIENTE"))
        .andExpect(jsonPath("$.conflicts.length()", org.hamcrest.Matchers.greaterThan(0)));
    mvc.perform(get(path()+"/"+base.get("id")).with(actor(admin)))
        .andExpect(jsonPath("$.document.classes[0].methods[0].name").value("activar"));
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
    members.saveAndFlush(new Participacion(collaborator, project, Participacion.Permiso.EDICION));
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
            return update(second, 0, collaborator).andReturn().getResponse().getStatus();
          };
      var x = pool.submit(a);
      var y = pool.submit(b);
      gate.countDown();
      assertThat(List.of(x.get(15, TimeUnit.SECONDS), y.get(15, TimeUnit.SECONDS)))
          .containsExactlyInAnyOrder(200, 409);
    }
    var ownerView = mvc.perform(get(path() + "/" + doc.get("id")).with(actor(admin))).andExpect(status().isOk())
        .andExpect(jsonPath("$.revision").value(1)).andReturn().getResponse().getContentAsString();
    var collaboratorView = mvc.perform(get(path() + "/" + doc.get("id")).with(actor(collaborator))).andExpect(status().isOk())
        .andExpect(jsonPath("$.revision").value(1)).andReturn().getResponse().getContentAsString();
    assertThat(json.readTree(ownerView).path("document")).isEqualTo(json.readTree(collaboratorView).path("document"));
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
