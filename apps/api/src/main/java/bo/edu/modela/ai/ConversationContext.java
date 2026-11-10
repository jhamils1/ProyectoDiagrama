package bo.edu.modela.ai;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.Arrays;
import java.util.stream.Collectors;
import java.text.Normalizer;
import java.util.Comparator;
import java.util.regex.Pattern;

/** Formats a bounded, chronological window without splitting authors from messages. */
final class ConversationContext {
  private static final int MAX_HISTORY = 1000;
  private static final String OMITTED = "[Hay mensajes anteriores omitidos.]\n";
  private static final Set<String> COMMON = Set.of("para", "como", "donde", "cuando", "sobre", "cual", "cuales", "esta", "este", "esto", "tiene", "tienen", "seria", "puede", "podria", "hacer", "hemos", "habia", "antes", "ahora", "segun", "diagrama", "clase", "clases", "atributo", "atributos", "cambios", "equipo", "anterior", "anteriores", "decidimos", "acordamos", "explica", "quiero", "puedes", "necesito", "deberia", "trabajo", "pregunta");
  private static final Pattern DECISION_QUERY = Pattern.compile("\\b(?:decid\\w*|acord\\w*|acuerdo\\w*|decision\\w*|elegim\\w*)\\b");
  private static final Pattern DECISION_STATEMENT = DECISION_QUERY;
  private static final Pattern PROPOSAL_QUERY = Pattern.compile("\\b(?:propu\\w*|propon\\w*|propone\\w*|suger\\w*|sugir\\w*|sugier\\w*)\\b");
  private static final Pattern PROPOSAL_STATEMENT = Pattern.compile("\\b(?:propongo|proponemos|propone|proponia|propuse|propuso|propusimos|propusieron|sugiero|sugerimos|sugiere|sugeri|sugirio|sugirieron)\\b");
  record Entry(String author, String content, String kind, long revision) {}
  private ConversationContext() {}

  /** Selects recent entries plus bounded, explicitly attributed historical excerpts. */
  static String relevant(List<Entry> entries, String question, boolean hasEarlier) {
    int recentStart = Math.max(0, entries.size() - 8);
    var terms = terms(question);
    boolean decisionQuery = DECISION_QUERY.matcher(normalize(question)).find();
    boolean proposalQuery = PROPOSAL_QUERY.matcher(normalize(question)).find();
    record Match(int index, int score) {}
    var matches = new ArrayList<Match>();
    for (int i = 0; i < recentStart; i++) {
      var words = terms(entries.get(i).content());
      int score = (int) terms.stream().filter(words::contains).count();
      boolean questionEntry = entries.get(i).content().contains("?") || entries.get(i).content().contains("¿");
      if ((proposalQuery || decisionQuery) && questionEntry) continue;
      if (proposalQuery && (score > 0 || terms.isEmpty()) && "PERSONA".equals(entries.get(i).kind())
          && PROPOSAL_STATEMENT.matcher(normalize(entries.get(i).content())).find()) score += 3;
      boolean decisionMention = decisionQuery && "PERSONA".equals(entries.get(i).kind())
          && DECISION_STATEMENT.matcher(normalize(entries.get(i).content())).find();
      // An unspecific "qué decidimos" may retrieve a participant's stated decision,
      // but never promotes an assistant suggestion into a team decision.
      if (decisionMention && (score > 0 || terms.isEmpty())) score += 2;
      if (score > 0) matches.add(new Match(i, score));
    }
    if (matches.isEmpty()) return format(entries.subList(recentStart, entries.size()), hasEarlier || recentStart > 0);
    matches.sort(Comparator.comparingInt(Match::score).reversed().thenComparing(Comparator.comparingInt(Match::index).reversed()));
    // Reserve room for the relevant entry and recent context within the same 1,000-character budget.
    int tailStart = Math.max(recentStart, entries.size() - 2);
    var selected = new ArrayList<Entry>();
    matches.stream().limit(2).sorted(Comparator.comparingInt(Match::index)).forEach(match -> {
      var entry = entries.get(match.index());
      selected.add(new Entry(clean(entry.author(), 40), clean(entry.content(), 130), entry.kind(), entry.revision()));
    });
    for (var entry : entries.subList(tailStart, entries.size()))
      selected.add(new Entry(clean(entry.author(), 40), clean(entry.content(), 130), entry.kind(), entry.revision()));
    return format(selected, hasEarlier || selected.size() < entries.size());
  }

  static Set<String> terms(String text) {
    if (text == null) return Set.of();
    String normalized = normalize(text);
    return Arrays.stream(normalized.split("[^\\p{L}\\p{N}_]+"))
        .filter(s -> s.length() >= 4 && !COMMON.contains(s) && !DECISION_QUERY.matcher(s).matches()
            && !PROPOSAL_QUERY.matcher(s).matches())
        .map(s -> s.length() > 5 && s.endsWith("s") ? s.substring(0, s.length() - 1) : s)
        .collect(Collectors.toSet());
  }

  private static String normalize(String text) {
    return Normalizer.normalize(text == null ? "" : text, Normalizer.Form.NFD)
        .replaceAll("\\p{M}+", "").toLowerCase(Locale.ROOT);
  }

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
