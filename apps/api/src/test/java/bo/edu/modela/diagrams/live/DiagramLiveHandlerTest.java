package bo.edu.modela.diagrams.live;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import bo.edu.modela.auth.SessionPrincipal;
import bo.edu.modela.diagrams.DiagramService;
import bo.edu.modela.shared.ApiException;
import bo.edu.modela.users.Usuario;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.http.server.*;
import org.springframework.mock.web.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.web.socket.*;
import tools.jackson.databind.ObjectMapper;

class DiagramLiveHandlerTest {
  final DiagramService diagrams = mock(DiagramService.class);
  final ObjectMapper json = new ObjectMapper();
  final DiagramLiveHandler handler = new DiagramLiveHandler(diagrams, json);
  final UUID project = UUID.randomUUID(), diagram = UUID.randomUUID(), user = UUID.randomUUID();

  record Client(WebSocketSession socket, MockHttpSession http, List<String> messages) {}

  @BeforeEach void setup() {
    when(diagrams.liveState(any(), any(), any())).thenAnswer(invocation ->
        new DiagramService.LiveState(invocation.getArgument(2), "Ana", 0, "EDICION"));
  }

  MockHttpServletRequest request(UUID target, MockHttpSession http, String origin) {
    var request = new MockHttpServletRequest("GET", "/api/projects/" + project + "/diagrams/" + target + "/live");
    request.setScheme("http"); request.setServerName("localhost"); request.setServerPort(8080);
    request.setSession(http);
    if (origin != null) request.addHeader("Origin", origin);
    return request;
  }

  MockHttpSession session(UUID actor) {
    var http = new MockHttpSession();
    var context = SecurityContextHolder.createEmptyContext();
    context.setAuthentication(new UsernamePasswordAuthenticationToken(
        new SessionPrincipal(actor, Usuario.Rol.COLABORADOR), null, List.of()));
    http.setAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY, context);
    return http;
  }

  Client connect(UUID target, UUID actor) throws Exception {
    var http = session(actor);
    var attrs = new HashMap<String, Object>();
    assertThat(handler.beforeHandshake(new ServletServerHttpRequest(request(target, http, "http://localhost:8080")),
        new ServletServerHttpResponse(new MockHttpServletResponse()), handler, attrs)).isTrue();
    WebSocketSession socket = mock(WebSocketSession.class);
    when(socket.getId()).thenReturn(UUID.randomUUID().toString());
    when(socket.getAttributes()).thenReturn(attrs);
    when(socket.isOpen()).thenReturn(true);
    List<String> messages = new ArrayList<>();
    doAnswer(i -> { messages.add(((TextMessage) i.getArgument(0)).getPayload()); return null; })
        .when(socket).sendMessage(any());
    handler.afterConnectionEstablished(socket);
    return new Client(socket, http, messages);
  }

  @Test void deduplicatesUsersCountsConnectionsAndRemovesClosedTabs() throws Exception {
    var first = connect(diagram, user);
    var second = connect(diagram, user);
    var third = connect(diagram, UUID.randomUUID());
    var message = json.readTree(first.messages().getLast());
    assertThat(message.get("users").size()).isEqualTo(2);
    assertThat(message.get("users").toString()).contains("\"sessions\":2");
    handler.afterConnectionClosed(second.socket(), CloseStatus.NORMAL);
    assertThat(first.messages().getLast()).doesNotContain("\"sessions\":2");
    handler.afterConnectionClosed(third.socket(), CloseStatus.NORMAL);
    assertThat(json.readTree(first.messages().getLast()).get("users").size()).isEqualTo(1);
  }

  @Test void notificationsAreIsolatedByDiagramAndContainNoGraph() throws Exception {
    var first = connect(diagram, user);
    var other = connect(UUID.randomUUID(), user);
    int count = other.messages().size();
    when(diagrams.liveState(project, diagram, user)).thenReturn(new DiagramService.LiveState(user, "Ana", 7, "CONSULTA"));
    handler.changed(new DiagramService.Changed(project, diagram));
    assertThat(first.messages().getLast()).contains("\"revision\":7", "CONSULTA").doesNotContain("document", "correo");
    assertThat(other.messages()).hasSize(count);
  }

  @Test void invalidatedHttpSessionClosesBeforeAnyFurtherInformationIsSent() throws Exception {
    var first = connect(diagram, user);
    int count = first.messages().size();
    first.http().invalidate();
    handler.changed(new DiagramService.Changed(project, diagram));
    verify(first.socket()).close(argThat(status -> status.getCode() == 4403));
    assertThat(first.messages()).hasSize(count);
  }

  @Test void permissionRevocationClosesOnPeriodicAudit() throws Exception {
    var first = connect(diagram, user);
    int count = first.messages().size();
    when(diagrams.liveState(project, diagram, user)).thenThrow(ApiException.notFound());
    handler.heartbeat();
    verify(first.socket()).close(argThat(status -> status.getCode() == 4403));
    assertThat(first.messages()).hasSize(count);
  }

  @Test void rejectsForeignOrMissingOriginAndUnauthorizedDiagram() {
    for (String origin : new String[] {"http://evil.example", null}) {
      var response = new MockHttpServletResponse();
      assertThat(handler.beforeHandshake(new ServletServerHttpRequest(request(diagram, session(user), origin)),
          new ServletServerHttpResponse(response), handler, new HashMap<>())).isFalse();
      assertThat(response.getStatus()).isEqualTo(403);
    }
    when(diagrams.liveState(project, diagram, user)).thenThrow(ApiException.notFound());
    var response = new MockHttpServletResponse();
    assertThat(handler.beforeHandshake(new ServletServerHttpRequest(request(diagram, session(user), "http://localhost:8080")),
        new ServletServerHttpResponse(response), handler, new HashMap<>())).isFalse();
    assertThat(response.getStatus()).isEqualTo(404);
  }

  @Test void socketDoesNotAcceptModelWrites() throws Exception {
    var first = connect(diagram, user);
    handler.handleTextMessage(first.socket(), new TextMessage("pong"));
    verify(first.socket(), never()).close(any());
    handler.handleTextMessage(first.socket(), new TextMessage("{\"type\":\"update\"}"));
    verify(first.socket()).close(CloseStatus.POLICY_VIOLATION);
    verify(diagrams, never()).update(any(), any(), anyLong(), any());
  }
}
