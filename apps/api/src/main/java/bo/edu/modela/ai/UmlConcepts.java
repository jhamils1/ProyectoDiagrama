package bo.edu.modela.ai;

import java.util.regex.Pattern;

/** Curated answers for specific UML concepts. Other questions use the model. */
final class UmlConcepts {
  private static final Pattern CLASS_CONCEPT = Pattern.compile(
      "^\\s*¿?(?:qu[eé] es|qu[eé] significa|explica|define|definici[oó]n de)\\s+(?:(?:una|la) )?clase(?: en (?:uml|un diagrama de clases))?\\s*\\??[.!]?\\s*$",
      Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
  private static final Pattern DERIVED_ATTRIBUTE = Pattern.compile(
      "^\\s*¿?(?:qu[eé] es|qu[eé] significa|explica)\\s+(?:un |el )?atributo derivado(?: en uml)?\\s*\\??[.!]?\\s*$",
      Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
  private static final Pattern DERIVED_NOTATION = Pattern.compile(
      "^\\s*¿?(?:qu[eé] significa|para qu[eé] sirve) (?:la barra|/) (?:antes|delante) (?:del nombre )?de un atributo(?: en uml)?\\s*\\??[.!]?\\s*$",
      Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
  private UmlConcepts() {}

  static String answer(String question) {
    if (CLASS_CONCEPT.matcher(question).matches())
      return "Una clase en UML describe un conjunto de objetos que comparten características y comportamientos. "
          + "Se representa como un rectángulo con su nombre y puede incluir atributos y métodos. "
          + "Por ejemplo, Producto podría tener los atributos nombre y precio.";
    if (!DERIVED_ATTRIBUTE.matcher(question).matches() && !DERIVED_NOTATION.matcher(question).matches()) return null;
    return "Un atributo derivado tiene un valor que puede calcularse a partir de otros datos. "
        + "En un diagrama de clases UML se puede indicar con / antes de su nombre; por ejemplo, /total. "
        + "Que sea derivado no determina por sí solo si se almacena o se calcula al consultarlo.";
  }
}
