package bo.edu.modela.diagrams.live;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.web.socket.config.annotation.*;

@Configuration
@EnableWebSocket
@EnableScheduling
public class DiagramLiveConfig implements WebSocketConfigurer {
  private final DiagramLiveHandler handler;

  public DiagramLiveConfig(DiagramLiveHandler handler) {
    this.handler = handler;
  }

  @Override
  public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
    registry.addHandler(handler, "/api/projects/*/diagrams/*/live").addInterceptors(handler);
  }
}
