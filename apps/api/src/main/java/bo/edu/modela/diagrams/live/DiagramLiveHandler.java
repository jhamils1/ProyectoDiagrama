package bo.edu.modela.diagrams.live;

import bo.edu.modela.auth.SessionPrincipal;
import bo.edu.modela.diagrams.DiagramService;
import jakarta.servlet.http.HttpSession;
import java.net.URI;
import java.util.*;
import org.springframework.http.*;
import org.springframework.http.server.*;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.*;
import org.springframework.web.socket.server.HandshakeInterceptor;
import tools.jackson.databind.ObjectMapper;

@Component
public class DiagramLiveHandler extends TextWebSocketHandler implements HandshakeInterceptor {
  private record Room(UUID project, UUID diagram) {}
  private record Identity(Room room, UUID user, HttpSession http) {}
  private static class Peer {
    final WebSocketSession socket;
    final Identity identity;
    long pong = System.nanoTime();
    Peer(WebSocketSession socket, Identity identity) {
      this.socket = new ConcurrentWebSocketSessionDecorator(socket, 3000, 65536);
      this.identity = identity;
    }
  }
  public record Presence(UUID id, String name, int sessions) {}
  private final Map<String, Peer> peers = new HashMap<>();
  private final DiagramService diagrams;
  private final ObjectMapper json;

  public DiagramLiveHandler(DiagramService diagrams, ObjectMapper json) {
    this.diagrams = diagrams;
    this.json = json;
  }

  @Override
  public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
      WebSocketHandler handler, Map<String, Object> attributes) {
    try {
      // Require an explicit same-origin header; browsers set it on WebSocket handshakes.
      String origin = request.getHeaders().getOrigin();
      URI uri = request.getURI();
      URI source = origin == null ? null : URI.create(origin);
      if (source == null || !Objects.equals(source.getScheme(), uri.getScheme())
          || !Objects.equals(source.getRawAuthority(), uri.getRawAuthority())) {
        response.setStatusCode(HttpStatus.FORBIDDEN);
        return false;
      }
      var servlet = ((ServletServerHttpRequest) request).getServletRequest();
      HttpSession http = servlet.getSession(false);
      UUID user = sessionUser(http);
      String[] parts = uri.getPath().split("/");
      Room room = new Room(UUID.fromString(parts[3]), UUID.fromString(parts[5]));
      diagrams.liveState(room.project(), room.diagram(), user);
      attributes.put("identity", new Identity(room, user, http));
      return true;
    } catch (RuntimeException ex) {
      response.setStatusCode(HttpStatus.NOT_FOUND);
      return false;
    }
  }

  private UUID sessionUser(HttpSession http) {
    if (http == null) throw new IllegalStateException("No session");
    Object value = http.getAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY);
    if (!(value instanceof SecurityContext context) || context.getAuthentication() == null
        || !(context.getAuthentication().getPrincipal() instanceof SessionPrincipal principal))
      throw new IllegalStateException("No identity");
    return principal.id();
  }

  @Override
  public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response,
      WebSocketHandler handler, Exception exception) {}

  @Override
  public synchronized void afterConnectionEstablished(WebSocketSession socket) {
    socket.setTextMessageSizeLimit(128);
    socket.setBinaryMessageSizeLimit(128);
    Identity identity = (Identity) socket.getAttributes().get("identity");
    if (identity == null || peers.size() >= 500
        || peers.values().stream().filter(p -> p.identity.user().equals(identity.user())).count() >= 20) {
      close(socket, CloseStatus.POLICY_VIOLATION);
      return;
    }
    peers.put(socket.getId(), new Peer(socket, identity));
    broadcast(identity.room());
  }

  @Override
  public synchronized void afterConnectionClosed(WebSocketSession socket, CloseStatus status) {
    Peer peer = peers.remove(socket.getId());
    if (peer != null) broadcast(peer.identity.room());
  }

  @Override
  protected synchronized void handleTextMessage(WebSocketSession socket, TextMessage message) {
    Peer peer = peers.get(socket.getId());
    if (peer == null) return;
    if ("pong".equals(message.getPayload())) peer.pong = System.nanoTime();
    else remove(peer, CloseStatus.POLICY_VIOLATION);
  }

  @Override
  public synchronized void handleTransportError(WebSocketSession socket, Throwable error) {
    Peer peer = peers.get(socket.getId());
    if (peer != null) {
      remove(peer, CloseStatus.SERVER_ERROR);
      broadcast(peer.identity.room());
    }
  }

  @TransactionalEventListener
  public synchronized void changed(DiagramService.Changed event) {
    // Channel failures cannot change the outcome of an already committed HTTP write.
    try { broadcast(new Room(event.project(), event.diagram())); }
    catch (RuntimeException ignored) { /* Periodic audit and HTTP fallback recover state. */ }
  }

  @Scheduled(fixedDelay = 10000)
  public synchronized void heartbeat() {
    for (Peer peer : List.copyOf(peers.values())) {
      if (System.nanoTime() - peer.pong > 35_000_000_000L) remove(peer, CloseStatus.SESSION_NOT_RELIABLE);
    }
    var rooms = peers.values().stream().map(p -> p.identity.room()).distinct().toList();
    for (Room room : rooms) broadcast(room);
  }

  private void broadcast(Room room) {
    Map<Peer, DiagramService.LiveState> authorized = new LinkedHashMap<>();
    for (Peer peer : List.copyOf(peers.values())) {
      if (!peer.identity.room().equals(room)) continue;
      try {
        if (!peer.identity.user().equals(sessionUser(peer.identity.http())))
          throw new IllegalStateException("Session changed");
        var state = diagrams.liveState(room.project(), room.diagram(), peer.identity.user());
        authorized.put(peer, state);
      } catch (bo.edu.modela.shared.ApiException | IllegalStateException ex) {
        remove(peer, new CloseStatus(4403, "Access unavailable"));
      } catch (RuntimeException ex) {
        remove(peer, CloseStatus.SERVER_ERROR);
      }
    }
    Map<UUID, Presence> users = new TreeMap<>();
    for (var state : authorized.values()) {
      var prior = users.get(state.userId());
      users.put(state.userId(), new Presence(state.userId(), state.name(), prior == null ? 1 : prior.sessions() + 1));
    }
    for (var entry : authorized.entrySet()) {
      try {
        var state = entry.getValue();
        entry.getKey().socket.sendMessage(new TextMessage(json.writeValueAsString(Map.of(
            "type", "state", "revision", state.revision(), "permiso", state.permiso(),
            "users", users.values()))));
      } catch (Exception ex) {
        remove(entry.getKey(), CloseStatus.SERVER_ERROR);
      }
    }
  }

  private void remove(Peer peer, CloseStatus status) {
    peers.remove(peer.socket.getId());
    close(peer.socket, status);
  }

  private void close(WebSocketSession socket, CloseStatus status) {
    try { socket.close(status); } catch (Exception ignored) { /* Already disconnected. */ }
  }
}
