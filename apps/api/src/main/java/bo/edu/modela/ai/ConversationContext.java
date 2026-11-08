package bo.edu.modela.ai;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/** Formats a bounded, chronological window without splitting authors from messages. */
final class ConversationContext {
  private static final int MAX_HISTORY = 1000;
  private static final String OMITTED = "[Hay mensajes anteriores omitidos.]\n";
  record Entry(String author, String content, String kind, long revision) {}
  private ConversationContext() {}

  /** Entries must be supplied in chronological order. */
  static String format(List<Entry> entries, boolean hasEarlier) {
    if (entries.isEmpty()) return hasEarlier ? OMITTED.strip() : "Sin mensajes anteriores.";
    var selected = new ArrayList<String>();
    int length = OMITTED.length();
    for (int i = entries.size() - 1; i >= 0; i--) {
      Entry entry = entries.get(i);
      String role = "ASISTENTE".equals(entry.kind()) ? "Asistente" : "PROPUESTA".equals(entry.kind()) ? "Propuesta histórica" : "Participante";
      String line = role + " · " + clean(entry.author(), 60) + " (revisión " + entry.revision() + "): "
          + clean(entry.content(), 240);
      int needed = line.length() + (selected.isEmpty() ? 0 : 1);
      if (length + needed > MAX_HISTORY) break;
      selected.add(line);
      length += needed;
    }
    Collections.reverse(selected);
    return (hasEarlier || selected.size() < entries.size() ? OMITTED : "") + String.join("\n", selected);
  }

  private static String clean(String value, int limit) {
    if (value == null || value.isBlank()) return "sin contenido";
    String text = value.replaceAll("[\\p{Cc}\\p{Zl}\\p{Zp}\\s]+", " ").strip();
    int count = text.codePointCount(0, text.length());
    return count <= limit ? text : text.substring(0, text.offsetByCodePoints(0, limit)) + "… [mensaje recortado]";
  }
}
