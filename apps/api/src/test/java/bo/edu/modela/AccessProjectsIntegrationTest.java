package bo.edu.modela;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import bo.edu.modela.auth.*;
import bo.edu.modela.projects.*;
import bo.edu.modela.users.*;
import java.util.*;
import javax.sql.DataSource;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.*;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class AccessProjectsIntegrationTest {
  @Autowired MockMvc mvc;
  @Autowired UsuarioRepository users;
  @Autowired ProyectoRepository projects;
  @Autowired ParticipacionRepository members;
  @Autowired PasswordEncoder encoder;
  @Autowired ObjectMapper json;
  @Autowired DataSource datasource;
  @MockitoBean GoogleTokenVerifier google;

  @BeforeEach
  void isolatedDatabase() throws Exception {
    try (var connection = datasource.getConnection()) {
      assertThat(connection.getCatalog()).isEqualTo("modela_test");
    }
    // La base de prueba puede conservar una contraseña de pruebas manuales anteriores.
    // El cambio queda dentro de la transacción de la prueba y se revierte al terminar.
    var admin = users.findByCorreo("admin@test.local").orElseThrow();
    admin.passwordHash = encoder.encode("test-only-admin-password-123");
    admin.activo = true;
    users.saveAndFlush(admin);
  }

  MockHttpSession admin() throws Exception {
    var result =
        mvc.perform(
                post("/api/auth/admin")
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        "{\"correo\":\"admin@test.local\",\"password\":\"test-only-admin-password-123\"}"))
            .andExpect(status().isOk())
            .andReturn();
    return (MockHttpSession) result.getRequest().getSession(false);
  }

  Usuario collaborator(String email) {
    var u = new Usuario("Colaborador", email, Usuario.Rol.COLABORADOR, null);
    return users.saveAndFlush(u);
  }

  MockHttpSession loginGoogle(Usuario user) throws Exception {
    String sub = user.googleId == null ? UUID.randomUUID().toString() : user.googleId;
    when(google.verify(anyString(), anyString()))
        .thenReturn(new GoogleTokenVerifier.Identity(sub, user.correo, user.nombre, true));
    var challenge =
        mvc.perform(get("/api/auth/google/challenge")).andExpect(status().isOk()).andReturn();
    var session = (MockHttpSession) challenge.getRequest().getSession(false);
    return (MockHttpSession)
        mvc.perform(
                post("/api/auth/google")
                    .session(session)
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"credential\":\"test-token\",\"intent\":\"LOGIN\"}"))
            .andExpect(status().isOk())
            .andReturn()
            .getRequest()
            .getSession(false);
  }

  Proyecto project(String name) {
    return projects.saveAndFlush(
        new Proyecto(name, "Descripción", users.findByCorreo("admin@test.local").orElseThrow()));
  }

  String payload(Object value) throws Exception {
    return json.writeValueAsString(value);
  }

  @Test
  void anonymousCannotAccessData() throws Exception {
    mvc.perform(get("/api/projects")).andExpect(status().isUnauthorized());
    mvc.perform(get("/api/users")).andExpect(status().isUnauthorized());
  }

  @Test
  void adminCanRenameOwnAccountAndOthersCannot() throws Exception {
    var session = admin();
    var account = users.findByCorreo("admin@test.local").orElseThrow();
    long revision = account.revision;
    mvc.perform(put("/api/users/me/name").session(session).with(csrf())
            .contentType(MediaType.APPLICATION_JSON)
            .content(payload(Map.of("nombre", "  Jhamil Serrudo  ", "revision", revision))))
        .andExpect(status().isOk()).andExpect(jsonPath("$.nombre").value("Jhamil Serrudo"));
    mvc.perform(get("/api/auth/me").session(session)).andExpect(status().isOk())
        .andExpect(jsonPath("$.nombre").value("Jhamil Serrudo"));
    mvc.perform(put("/api/users/me/name").session(session).with(csrf())
            .contentType(MediaType.APPLICATION_JSON).content(payload(Map.of("nombre", "Otro", "revision", revision))))
        .andExpect(status().isConflict());
    mvc.perform(put("/api/users/me/name").session(session).with(csrf())
            .contentType(MediaType.APPLICATION_JSON).content(payload(Map.of("nombre", "   ", "revision", revision + 1))))
        .andExpect(status().isBadRequest());
    var colab = loginGoogle(collaborator("nombre-test@gmail.com"));
    mvc.perform(put("/api/users/me/name").session(colab).with(csrf())
            .contentType(MediaType.APPLICATION_JSON).content(payload(Map.of("nombre", "Otro", "revision", 0))))
        .andExpect(status().isForbidden());
    mvc.perform(put("/api/users/me/name").with(csrf()).contentType(MediaType.APPLICATION_JSON)
            .content(payload(Map.of("nombre", "Otro", "revision", 0))))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void loginRequiresCsrf() throws Exception {
    mvc.perform(
            post("/api/auth/admin")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"correo\":\"admin@test.local\",\"password\":\"test-only-admin-password-123\"}"))
        .andExpect(status().isForbidden());
  }

  @Test
  void adminLoginReturnsNoSecretsAndRotatesSession() throws Exception {
    MockHttpSession session = new MockHttpSession();
    String old = session.getId();
    var result =
        mvc.perform(
                post("/api/auth/admin")
                    .session(session)
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        "{\"correo\":\"admin@test.local\",\"password\":\"test-only-admin-password-123\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.rol").value("ADMINISTRADOR"))
            .andExpect(jsonPath("$.passwordHash").doesNotExist())
            .andExpect(jsonPath("$.googleId").doesNotExist())
            .andReturn();
    assertThat(result.getRequest().getSession().getId()).isNotEqualTo(old);
    assertThat(users.findByCorreo("admin@test.local").orElseThrow().passwordHash).startsWith("$2");
  }

  @Test
  void wrongPasswordAndCollaboratorPasswordRejected() throws Exception {
    collaborator("colab@gmail.com");
    for (String email : List.of("admin@test.local", "colab@gmail.com"))
      mvc.perform(
              post("/api/auth/admin")
                  .with(csrf())
                  .contentType(MediaType.APPLICATION_JSON)
                  .content(payload(Map.of("correo", email, "password", "wrong"))))
          .andExpect(status().isUnauthorized());
  }

  @Test
  void adminCreatesUpdatesAndDeactivatesCollaborator() throws Exception {
    var session = admin();
    var created =
        mvc.perform(
                post("/api/users")
                    .session(session)
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"nombre\":\"Ana\",\"correo\":\"ana@gmail.com\"}"))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.rol").value("COLABORADOR"))
            .andReturn();
    var node = json.readTree(created.getResponse().getContentAsString());
    mvc.perform(
            put("/api/users/" + node.get("id").asText())
                .session(session)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"nombre\":\"Ana actualizada\",\"activo\":false,\"revision\":0}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.activo").value(false));
    assertThat(users.findByCorreo("ana@gmail.com").orElseThrow().passwordHash).isNull();
  }

  @Test
  void registrationCreatesCollaboratorWithoutProjects() throws Exception {
    when(google.verify(anyString(), anyString()))
        .thenReturn(new GoogleTokenVerifier.Identity("new-sub", "new@gmail.com", "Nueva", true));
    var session =
        (MockHttpSession)
            mvc.perform(get("/api/auth/google/challenge")).andReturn().getRequest().getSession();
    mvc.perform(
            post("/api/auth/google")
                .session(session)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"credential\":\"test\",\"intent\":\"REGISTER\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.rol").value("COLABORADOR"));
    mvc.perform(get("/api/projects").session(session))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.total").value(0));
  }

  @Test
  void linkingPreservesAccountAndPermissions() throws Exception {
    var user = collaborator("linked@gmail.com");
    var project = project("Privado");
    members.saveAndFlush(new Participacion(user, project, Participacion.Permiso.CONSULTA));
    var session = loginGoogle(user);
    assertThat(users.findByCorreo(user.correo).orElseThrow().id).isEqualTo(user.id);
    mvc.perform(get("/api/projects").session(session))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.total").value(1))
        .andExpect(jsonPath("$.items[0].permiso").value("CONSULTA"));
  }

  @Test
  void thirdPartyEmailCannotAutoLink() throws Exception {
    var user = collaborator("person@example.com");
    when(google.verify(anyString(), anyString()))
        .thenReturn(new GoogleTokenVerifier.Identity("third-party", user.correo, "Persona", false));
    var session =
        (MockHttpSession)
            mvc.perform(get("/api/auth/google/challenge")).andReturn().getRequest().getSession();
    mvc.perform(
            post("/api/auth/google")
                .session(session)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"credential\":\"test\",\"intent\":\"LOGIN\"}"))
        .andExpect(status().isConflict());
    assertThat(users.findById(user.id).orElseThrow().googleId).isNull();
  }

  @Test
  void googleChallengeCannotBeReplayed() throws Exception {
    var user = collaborator("replay@gmail.com");
    var session = loginGoogle(user);
    mvc.perform(
            post("/api/auth/google")
                .session(session)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"credential\":\"test-token\",\"intent\":\"LOGIN\"}"))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void collaboratorCannotManageUsersProjectsOrParticipants() throws Exception {
    var session = loginGoogle(collaborator("restricted@gmail.com"));
    var project = project("Restringido");
    mvc.perform(get("/api/users").session(session)).andExpect(status().isForbidden());
    mvc.perform(
            post("/api/projects")
                .session(session)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"nombre\":\"No permitido\",\"descripcion\":\"\"}"))
        .andExpect(status().isForbidden());
    mvc.perform(get("/api/projects/" + project.id + "/members").session(session))
        .andExpect(status().isForbidden());
  }

  @Test
  void listAndDirectAccessExcludeOtherProjects() throws Exception {
    var u = collaborator("scoped@gmail.com");
    var allowed = project("Permitido");
    var other = project("Ajeno");
    members.saveAndFlush(new Participacion(u, allowed, Participacion.Permiso.EDICION));
    var session = loginGoogle(u);
    mvc.perform(get("/api/projects").session(session))
        .andExpect(jsonPath("$.total").value(1))
        .andExpect(jsonPath("$.items[0].id").value(allowed.id.toString()));
    mvc.perform(get("/api/projects/" + other.id).session(session)).andExpect(status().isNotFound());
  }

  @Test
  void removeParticipationImmediatelyRevokesProjectAccess() throws Exception {
    var u = collaborator("removed@gmail.com");
    var p = project("Equipo");
    var m = members.saveAndFlush(new Participacion(u, p, Participacion.Permiso.CONSULTA));
    var collaborator = loginGoogle(u);
    var admin = admin();
    mvc.perform(
            delete("/api/projects/" + p.id + "/members/" + m.id)
                .param("revision", "0")
                .session(admin)
                .with(csrf()))
        .andExpect(status().isNoContent());
    mvc.perform(get("/api/projects/" + p.id).session(collaborator))
        .andExpect(status().isNotFound());
  }

  @Test
  void deactivationRejectsExistingSession() throws Exception {
    var u = collaborator("inactive@gmail.com");
    var session = loginGoogle(u);
    u = users.findById(u.id).orElseThrow();
    u.activo = false;
    users.saveAndFlush(u);
    mvc.perform(get("/api/auth/me").session(session)).andExpect(status().isUnauthorized());
  }

  @Test
  void adminCrudProjectAndStaleWriteRejection() throws Exception {
    var session = admin();
    var created =
        mvc.perform(
                post("/api/projects")
                    .session(session)
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"nombre\":\"Inventario\",\"descripcion\":\"Inicial\"}"))
            .andExpect(status().isCreated())
            .andReturn();
    String id = json.readTree(created.getResponse().getContentAsString()).get("id").asText();
    String body = "{\"nombre\":\"Inventario nuevo\",\"descripcion\":\"Editado\",\"revision\":0}";
    mvc.perform(
            put("/api/projects/" + id)
                .session(session)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
        .andExpect(status().isOk());
    mvc.perform(
            put("/api/projects/" + id)
                .session(session)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
        .andExpect(status().isConflict());
    mvc.perform(delete("/api/projects/" + id).param("revision", "1").session(session).with(csrf()))
        .andExpect(status().isNoContent());
    mvc.perform(get("/api/projects/" + id).session(session)).andExpect(status().isNotFound());
    assertThat(projects.findById(UUID.fromString(id)).orElseThrow().eliminadoEn).isNotNull();
  }

  @Test
  void logoutInvalidatesSession() throws Exception {
    var session = admin();
    mvc.perform(post("/api/auth/logout").session(session).with(csrf()))
        .andExpect(status().isNoContent());
    assertThat(session.isInvalid()).isTrue();
    mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
  }

  @Test
  void accountAndProjectValidation() throws Exception {
    var session = admin();
    mvc.perform(
            post("/api/users")
                .session(session)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"nombre\":\"\",\"correo\":\"invalid\"}"))
        .andExpect(status().isBadRequest());
    mvc.perform(
            post("/api/projects")
                .session(session)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"nombre\":\"   \",\"descripcion\":\"\"}"))
        .andExpect(status().isBadRequest());
  }

  @Test
  void duplicateEmailRejectedWithoutLeakingSql() throws Exception {
    collaborator("duplicate@gmail.com");
    mvc.perform(
            post("/api/users")
                .session(admin())
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"nombre\":\"Otra persona\",\"correo\":\"DUPLICATE@gmail.com\"}"))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("DUPLICADO"))
        .andExpect(
            content()
                .string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("INSERT"))));
  }

  @Test
  void duplicateProjectNameRejectedCaseInsensitively() throws Exception {
    project("Inventario único");
    mvc.perform(
            post("/api/projects")
                .session(admin())
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"nombre\":\" INVENTARIO ÚNICO \",\"descripcion\":\"\"}"))
        .andExpect(status().isConflict());
  }

  @Test
  void duplicateParticipantRejectedByDatabase() throws Exception {
    var p = project("Sin duplicados");
    var u = collaborator("duplicate-member@gmail.com");
    members.saveAndFlush(new Participacion(u, p, Participacion.Permiso.CONSULTA));
    mvc.perform(
            post("/api/projects/" + p.id + "/members")
                .session(admin())
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload(Map.of("usuarioId", u.id, "permiso", "EDICION"))))
        .andExpect(status().isConflict());
  }

  @Test
  void membershipUpdatesEnforceScopeVersionAndValidUser() throws Exception {
    var session = admin();
    var p = project("Equipo uno");
    var other = project("Equipo dos");
    var u = collaborator("member@gmail.com");
    var created =
        mvc.perform(
                post("/api/projects/" + p.id + "/members")
                    .session(session)
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(payload(Map.of("usuarioId", u.id, "permiso", "CONSULTA"))))
            .andExpect(status().isCreated())
            .andReturn();
    String id = json.readTree(created.getResponse().getContentAsString()).get("id").asText();
    String body = "{\"permiso\":\"EDICION\",\"revision\":0}";
    mvc.perform(
            put("/api/projects/" + other.id + "/members/" + id)
                .session(session)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
        .andExpect(status().isNotFound());
    mvc.perform(
            put("/api/projects/" + p.id + "/members/" + id)
                .session(session)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.usuario.correo").value(u.correo))
        .andExpect(jsonPath("$.permiso").value("EDICION"));
    mvc.perform(
            delete("/api/projects/" + p.id + "/members/" + id)
                .param("revision", "0")
                .session(session)
                .with(csrf()))
        .andExpect(status().isConflict());
    mvc.perform(
            post("/api/projects/" + p.id + "/members")
                .session(session)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload(Map.of("usuarioId", UUID.randomUUID(), "permiso", "CONSULTA"))))
        .andExpect(status().isNotFound());
    mvc.perform(
            post("/api/projects/" + p.id + "/members")
                .session(session)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload(Map.of("usuarioId", u.id, "permiso", "ADMINISTRACION"))))
        .andExpect(status().isBadRequest());
  }
}
