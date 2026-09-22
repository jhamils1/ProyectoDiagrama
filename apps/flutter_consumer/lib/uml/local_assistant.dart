import 'model.dart';

class AssistantHint {
  const AssistantHint(this.title, this.detail);
  final String title;
  final String detail;
}

/// Deterministic, on-device guidance. It never sends the diagram to a service.
List<AssistantHint> localHints(UmlDiagram diagram) {
  final hints = <AssistantHint>[];
  if (diagram.classes.isEmpty) {
    hints.add(
      const AssistantHint(
        'Empieza con una clase',
        'Agrega una clase que represente una entidad del dominio, por ejemplo Cliente o Producto.',
      ),
    );
    return hints;
  }
  if (diagram.classes.every((item) => item.attributes.isEmpty)) {
    hints.add(
      const AssistantHint(
        'Define atributos',
        'Selecciona cada clase y agrega los datos que necesita guardar.',
      ),
    );
  }
  final withoutIdentifier = diagram.classes.where(
    (item) => !item.attributes.any((attribute) => attribute.identifier),
  );
  if (withoutIdentifier.isNotEmpty) {
    hints.add(
      AssistantHint(
        'Revisa identificadores',
        '${withoutIdentifier.map((item) => item.name).join(', ')} no tiene un atributo identificador.',
      ),
    );
  }
  if (diagram.classes.length > 1 && diagram.relations.isEmpty) {
    hints.add(
      const AssistantHint(
        'Conecta las clases',
        'Crea una asociación o una herencia para expresar cómo se relacionan las entidades.',
      ),
    );
  }
  if (diagram.relations.any(
    (item) =>
        item.type == 'association' &&
        item.sourceMultiplicity == item.targetMultiplicity,
  )) {
    hints.add(
      const AssistantHint(
        'Revisa multiplicidades',
        'Comprueba que cada extremo represente cuántas instancias puede relacionar.',
      ),
    );
  }
  if (hints.isEmpty) {
    hints.add(
      const AssistantHint(
        'El modelo tiene buena base',
        'Revisa nombres, tipos y multiplicidades antes de sincronizar o generar el backend.',
      ),
    );
  }
  return hints;
}
